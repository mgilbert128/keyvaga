import "server-only";
import { db } from "@/lib/db";
import { todayIn } from "@/lib/dates";
import { seam, locksConfigured, SeamError } from "./seam";
import { jobWindow, randomCode, stayWindow } from "./time";

/**
 * Smart locks: owners connect their lock-brand account (via Seam), assign each lock to a listing,
 * and Keyvaga then creates a time-limited door code for every confirmed booking (check-in → checkout)
 * and for hired service jobs (the scheduled day). Codes are removed when a booking or job is cancelled.
 * Everything here is best-effort: a lock problem never blocks a booking. Problems are logged as
 * LockEvents the owner sees on the Smart locks page, with a Retry button.
 */

export { locksConfigured };

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

async function logEvent(data: { ownerId: string; kind: string; message: string; lockId?: string | null; bookingId?: string | null; jobId?: string | null; retryable?: boolean }) {
  await db.lockEvent.create({ data: { ...data, retryable: data.retryable ?? false } }).catch(() => {});
}

// ---------- Connecting accounts ----------

/** Starts Seam's "sign in to your lock account" flow. Returns the URL to send the owner to. */
export async function startConnect(ownerId: string, returnUrl: string): Promise<string> {
  const w = await seam().createConnectWebview(returnUrl);
  await db.lockConnectSession.create({ data: { id: w.id, ownerId } });
  return w.url;
}

/** Finishes any connect flows the owner started (called when they land back on the page). */
export async function finishPendingConnects(ownerId: string) {
  if (!locksConfigured()) return 0;
  const pending = await db.lockConnectSession.findMany({ where: { ownerId, createdAt: { gte: new Date(Date.now() - 86_400_000) } } });
  let connected = 0;
  for (const p of pending) {
    try {
      const w = await seam().getConnectWebview(p.id);
      if (w.status === "authorized" && w.connectedAccountId) {
        const acct = await seam().getConnectedAccount(w.connectedAccountId);
        await db.lockAccount.upsert({
          where: { seamAccountId: w.connectedAccountId },
          create: { ownerId, seamAccountId: w.connectedAccountId, provider: acct.provider, label: acct.label },
          update: { provider: acct.provider, label: acct.label },
        });
        await db.lockConnectSession.delete({ where: { id: p.id } });
        await logEvent({ ownerId, kind: "connected", message: `Connected ${acct.provider}${acct.label ? ` (${acct.label})` : ""}` });
        connected++;
      } else if (w.status === "failed") {
        await db.lockConnectSession.delete({ where: { id: p.id } });
        await logEvent({ ownerId, kind: "error", message: "Connecting a lock account didn't finish. Try again." });
      }
    } catch (e) {
      console.error("finish lock connect failed", p.id, message(e));
    }
  }
  if (connected) await syncLocks(ownerId);
  await db.lockConnectSession.deleteMany({ where: { ownerId, createdAt: { lt: new Date(Date.now() - 86_400_000) } } });
  return connected;
}

/** Refreshes the owner's lock list and online status from their connected accounts. */
export async function syncLocks(ownerId: string) {
  const accounts = await db.lockAccount.findMany({ where: { ownerId } });
  const now = new Date();
  for (const a of accounts) {
    let devices;
    try {
      devices = (await seam().listDevices(a.seamAccountId)).filter((d) => d.supportsCodes);
    } catch (e) {
      await logEvent({ ownerId, kind: "error", message: `Couldn't reach your ${a.provider} account: ${message(e)}` });
      continue;
    }
    for (const d of devices) {
      await db.lock.upsert({
        where: { seamDeviceId: d.id },
        create: { ownerId, lockAccountId: a.id, seamDeviceId: d.id, name: d.name, provider: d.provider || a.provider, online: d.online, lastSyncedAt: now },
        update: { name: d.name, online: d.online, lastSyncedAt: now },
      });
    }
    // Locks removed from the brand account disappear here too.
    await db.lock.deleteMany({ where: { lockAccountId: a.id, seamDeviceId: { notIn: devices.map((d) => d.id) } } });
  }
}

export async function disconnectAccount(ownerId: string, accountId: string) {
  const a = await db.lockAccount.findFirst({ where: { id: accountId, ownerId } });
  if (!a) return;
  await seam().deleteConnectedAccount(a.seamAccountId).catch((e) => console.error("seam disconnect failed", message(e)));
  await db.lockAccount.delete({ where: { id: a.id } });
  await logEvent({ ownerId, kind: "disconnected", message: `Disconnected ${a.provider}` });
}

/** Puts a lock on a listing (or none). Upcoming confirmed bookings on that listing get codes right away. */
export async function assignLock(ownerId: string, lockId: string, listingId: string | null) {
  const lock = await db.lock.findFirst({ where: { id: lockId, ownerId } });
  if (!lock) throw new Error("Lock not found.");
  if (listingId && !(await db.listing.findFirst({ where: { id: listingId, ownerId }, select: { id: true } }))) throw new Error("Listing not found.");
  if (lock.listingId === listingId) return;
  // Codes for the old listing's guests stop working on this lock.
  const old = await db.accessCode.findMany({ where: { lockId, status: { in: ["SETTING", "SET", "FAILED"] } } });
  for (const c of old) await removeCode(c.id);
  await db.lock.update({ where: { id: lockId }, data: { listingId } });
  if (listingId) await issueUpcomingForListing(listingId);
}

export async function issueUpcomingForListing(listingId: string) {
  const today = todayIn();
  const bookings = await db.booking.findMany({ where: { listingId, status: "CONFIRMED", checkOut: { gt: today } }, select: { id: true } });
  for (const b of bookings) await issueBookingCodes(b.id);
  const jobs = await db.job.findMany({ where: { listingId, status: "ASSIGNED", scheduledDate: { gte: today } }, select: { id: true } });
  for (const j of jobs) await issueJobCodes(j.id);
}

// ---------- Codes ----------

async function createCode(args: { lock: { id: string; ownerId: string; seamDeviceId: string; name: string }; name: string; code: string; startsAt: Date; endsAt: Date; bookingId?: string; jobId?: string }) {
  const row = await db.accessCode.create({
    data: { lockId: args.lock.id, bookingId: args.bookingId, jobId: args.jobId, name: args.name, code: args.code, startsAt: args.startsAt, endsAt: args.endsAt },
  });
  return pushCode(row.id);
}

/** Sends a stored code to the lock. Used for first attempts and retries. */
async function pushCode(accessCodeId: string) {
  const row = await db.accessCode.findUniqueOrThrow({ where: { id: accessCodeId }, include: { lock: true } });
  const lock = row.lock;
  const input = { deviceId: lock.seamDeviceId, name: row.name, startsAt: row.startsAt, endsAt: row.endsAt };
  try {
    let created;
    try {
      created = await seam().createAccessCode({ ...input, code: row.code ?? undefined });
    } catch (e) {
      // Some locks only accept certain code lengths: let the lock pick one instead.
      if (!(e instanceof SeamError) || e.status >= 500 || !row.code) throw e;
      created = await seam().createAccessCode(input);
    }
    await db.accessCode.update({
      where: { id: row.id },
      data: { seamCodeId: created.id, code: created.code ?? row.code, status: created.status === "set" ? "SET" : "SETTING", error: created.error },
    });
    await logEvent({ ownerId: lock.ownerId, lockId: lock.id, bookingId: row.bookingId, jobId: row.jobId, kind: "code_created", message: `Code for ${row.name} added to ${lock.name}` });
    return true;
  } catch (e) {
    await db.accessCode.update({ where: { id: row.id }, data: { status: "FAILED", error: message(e).slice(0, 300) } });
    await logEvent({
      ownerId: lock.ownerId,
      lockId: lock.id,
      bookingId: row.bookingId,
      jobId: row.jobId,
      kind: "error",
      retryable: true,
      message: `Couldn't add the code for ${row.name} to ${lock.name}: ${message(e)}`.slice(0, 500),
    });
    return false;
  }
}

async function removeCode(accessCodeId: string) {
  const c = await db.accessCode.findUnique({ where: { id: accessCodeId }, include: { lock: true } });
  if (!c || c.status === "REMOVED") return;
  try {
    if (c.seamCodeId) await seam().deleteAccessCode(c.seamCodeId);
    await db.accessCode.update({ where: { id: c.id }, data: { status: "REMOVED", error: null } });
    await logEvent({ ownerId: c.lock.ownerId, lockId: c.lockId, bookingId: c.bookingId, jobId: c.jobId, kind: "code_removed", message: `Code for ${c.name} removed from ${c.lock.name}` });
  } catch (e) {
    await logEvent({
      ownerId: c.lock.ownerId,
      lockId: c.lockId,
      bookingId: c.bookingId,
      jobId: c.jobId,
      kind: "error",
      retryable: true,
      message: `Couldn't remove the code for ${c.name} from ${c.lock.name}: ${message(e)}`.slice(0, 500),
    });
  }
}

/** Creates the guest's door code on every lock assigned to the booked listing. Safe to call more than once. */
export async function issueBookingCodes(bookingId: string) {
  if (!locksConfigured()) return 0;
  const b = await db.booking.findUnique({
    where: { id: bookingId },
    include: { guest: { select: { name: true } }, listing: { include: { locks: true } }, accessCodes: { where: { status: { not: "REMOVED" } } } },
  });
  if (!b || b.status !== "CONFIRMED" || !b.listing.locks.length) return 0;
  const window = stayWindow(b, b.listing);
  if (window.endsAt <= new Date()) return 0;
  // Same code on every door of the property, unless a lock insists on picking its own.
  const code = b.accessCodes.find((c) => c.code)?.code ?? randomCode();
  const first = b.guest.name.split(" ")[0] || "Guest";
  let made = 0;
  for (const lock of b.listing.locks) {
    if (b.accessCodes.some((c) => c.lockId === lock.id)) continue;
    if (await createCode({ lock, name: `${first} ${fmtShort(b.checkIn)}`.slice(0, 20), code, ...window, bookingId: b.id })) made++;
  }
  return made;
}

export async function revokeBookingCodes(bookingId: string) {
  const codes = await db.accessCode.findMany({ where: { bookingId, status: { not: "REMOVED" } }, select: { id: true } });
  for (const c of codes) await removeCode(c.id);
  return codes.length;
}

/** Code for the hired provider on the job's scheduled day. */
export async function issueJobCodes(jobId: string) {
  if (!locksConfigured()) return 0;
  const job = await db.job.findUnique({
    where: { id: jobId },
    include: { listing: { include: { locks: true } }, acceptedQuote: { include: { provider: { select: { businessName: true } } } }, accessCodes: { where: { status: { not: "REMOVED" } } } },
  });
  if (!job || job.status !== "ASSIGNED" || !job.scheduledDate || !job.listing.locks.length) return 0;
  const window = jobWindow(job.scheduledDate, job.listing.timeZone);
  if (window.endsAt <= new Date()) return 0;
  const code = job.accessCodes.find((c) => c.code)?.code ?? randomCode();
  const who = job.acceptedQuote?.provider.businessName || "Service";
  let made = 0;
  for (const lock of job.listing.locks) {
    if (job.accessCodes.some((c) => c.lockId === lock.id)) continue;
    if (await createCode({ lock, name: `${who} ${fmtShort(job.scheduledDate)}`.slice(0, 20), code, ...window, jobId: job.id })) made++;
  }
  return made;
}

export async function revokeJobCodes(jobId: string) {
  const codes = await db.accessCode.findMany({ where: { jobId, status: { not: "REMOVED" } }, select: { id: true } });
  for (const c of codes) await removeCode(c.id);
  return codes.length;
}

/** Retry button on a logged problem: re-sends failed codes or re-tries a removal. */
export async function retryEvent(ownerId: string, eventId: string) {
  const ev = await db.lockEvent.findFirst({ where: { id: eventId, ownerId, retryable: true, resolvedAt: null } });
  if (!ev) return false;
  const where = ev.bookingId ? { bookingId: ev.bookingId } : ev.jobId ? { jobId: ev.jobId } : null;
  if (where) {
    const codes = await db.accessCode.findMany({ where: { ...where, ...(ev.lockId ? { lockId: ev.lockId } : {}) } });
    const cancelled = ev.bookingId
      ? (await db.booking.findUnique({ where: { id: ev.bookingId }, select: { status: true } }))?.status !== "CONFIRMED"
      : (await db.job.findUnique({ where: { id: ev.jobId! }, select: { status: true } }))?.status !== "ASSIGNED";
    for (const c of codes) {
      if (cancelled) await removeCode(c.id);
      else if (c.status === "FAILED") await pushCode(c.id);
    }
    if (!cancelled && ev.bookingId) await issueBookingCodes(ev.bookingId);
    if (!cancelled && ev.jobId) await issueJobCodes(ev.jobId);
  }
  await db.lockEvent.update({ where: { id: ev.id }, data: { resolvedAt: new Date() } });
  return true;
}

/** Updates "setting" codes with what the lock reports (e.g. set, or an error). */
export async function refreshCodeStatuses(ownerId: string) {
  if (!locksConfigured()) return;
  const codes = await db.accessCode.findMany({ where: { lock: { ownerId }, status: "SETTING", seamCodeId: { not: null }, endsAt: { gt: new Date() } }, take: 30 });
  for (const c of codes) {
    try {
      const s = await seam().getAccessCode(c.seamCodeId!);
      if (!s) continue;
      if (s.status === "set") await db.accessCode.update({ where: { id: c.id }, data: { status: "SET", code: s.code ?? c.code, error: null } });
      else if (s.error && s.error !== c.error) await db.accessCode.update({ where: { id: c.id }, data: { error: s.error } });
    } catch {
      // Status check only; try again next time.
    }
  }
}

/** Daily: refresh locks, and add codes for bookings/jobs that are missing them (e.g. a lock connected after booking). */
export async function runLockTasks() {
  if (!locksConfigured()) return { skipped: true };
  const owners = (await db.lockAccount.findMany({ select: { ownerId: true }, distinct: ["ownerId"] })).map((o) => o.ownerId);
  for (const o of owners) await syncLocks(o).catch(() => {});
  const listings = await db.listing.findMany({ where: { locks: { some: {} } }, select: { id: true } });
  for (const l of listings) await issueUpcomingForListing(l.id).catch(() => {});
  return { owners: owners.length, listings: listings.length };
}

// ---------- What people see ----------

export type DoorCode = { lockName: string; code: string | null; status: "SETTING" | "SET" | "FAILED"; startsAt: Date; endsAt: Date };

/** Codes for a guest's booking or a provider's job, plus the owner's backup codes when a code didn't work out. */
export async function doorCodesFor(where: { bookingId: string } | { jobId: string }) {
  const rows = await db.accessCode.findMany({ where: { ...where, status: { not: "REMOVED" } }, include: { lock: true }, orderBy: { createdAt: "asc" } });
  const codes: (DoorCode & { backupCode: string | null; online: boolean })[] = rows.map((r) => ({
    lockName: r.lock.name,
    code: r.code,
    status: r.status as DoorCode["status"],
    startsAt: r.startsAt,
    endsAt: r.endsAt,
    backupCode: r.status === "FAILED" || !r.lock.online ? r.lock.backupCode : null,
    online: r.lock.online,
  }));
  return codes;
}

/** One-line text for the {door_code} message fill-in. */
export async function doorCodeText(bookingId: string): Promise<string> {
  const codes = await doorCodesFor({ bookingId });
  const usable = codes.map((c) => (c.status !== "FAILED" && c.code ? { name: c.lockName, code: c.code } : c.backupCode ? { name: c.lockName, code: c.backupCode } : null)).filter(Boolean) as { name: string; code: string }[];
  if (!usable.length) return "";
  if (new Set(usable.map((u) => u.code)).size === 1) return usable[0]!.code;
  return usable.map((u) => `${u.name}: ${u.code}`).join(", ");
}

const shortFmt = new Intl.DateTimeFormat("en-US", { month: "numeric", day: "numeric", timeZone: "UTC" });
function fmtShort(d: Date) {
  return shortFmt.format(d);
}
