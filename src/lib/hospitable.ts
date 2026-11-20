import "server-only";
import { db } from "@/lib/db";
import { addDays, todayIn } from "@/lib/dates";
import { putImage } from "@/lib/storage";
import { MAX_PHOTOS_PER_LISTING, MAX_UPLOAD_BYTES, sniffImageType } from "@/lib/images";
import { slugify } from "@/lib/slug";
import { calendarToKeyvaga, listingFromProperty, medianRate, stayNights, type HCalendarDay, type HProperty } from "@/lib/hospitable-map";

/**
 * Hospitable connection for the owner's own Hospitable account, using a personal access token
 * (HOSPITABLE_PAT) that belongs to the Keyvaga owner with email HOSPITABLE_OWNER_EMAIL. Hospitable
 * allows this without partner approval because it's the account holder's own integration; the
 * partner (OAuth) version for every host comes after Hospitable approves Keyvaga (Q1 2027).
 *
 * - Import: create a draft Keyvaga listing from a Hospitable property (details + photos), or link an existing one.
 * - Sync in: nightly prices → DateRate, unavailable days → CalendarBlock(source HOSPITABLE). Daily, hourly on
 *   page views, and right before every booking.
 * - Sync out: a confirmed Keyvaga booking blocks those nights on the Hospitable calendar (closing Airbnb, Vrbo…);
 *   a cancellation reopens them.
 */
const BASE = "https://public.api.hospitable.com/v2";
const HORIZON_DAYS = 365;

export class HospitableError extends Error {}

export function hospitableConfigured(): boolean {
  return Boolean(process.env.HOSPITABLE_PAT && process.env.HOSPITABLE_OWNER_EMAIL);
}

/** Only the Keyvaga owner whose Hospitable account the token belongs to can use it. */
export function canUseHospitable(user: { email: string }): boolean {
  return hospitableConfigured() && user.email.trim().toLowerCase() === process.env.HOSPITABLE_OWNER_EMAIL!.trim().toLowerCase();
}

async function api<T>(path: string, init: { method?: string; query?: Record<string, string | number | undefined>; body?: unknown } = {}): Promise<T> {
  const token = process.env.HOSPITABLE_PAT;
  if (!token) throw new HospitableError("Hospitable isn't connected (HOSPITABLE_PAT is not set).");
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(init.query ?? {})) if (v !== undefined) url.searchParams.set(k, String(v));
  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(30_000),
    cache: "no-store",
  });
  if (res.status === 401 || res.status === 403) throw new HospitableError("Hospitable refused the access token. Check it in Hospitable (Apps → API access) and in Vercel.");
  if (res.status === 429) throw new HospitableError("Hospitable is rate-limiting requests. We'll try again shortly.");
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 200);
    throw new HospitableError(`Hospitable returned an error (${res.status})${detail ? `: ${detail}` : ""}.`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

type Page<T> = { data: T[]; meta?: { current_page?: number; last_page?: number } };

export async function listHospitableProperties(): Promise<HProperty[]> {
  const out: HProperty[] = [];
  for (let page = 1; page <= 20; page++) {
    const r = await api<Page<HProperty>>("/properties", { query: { page, per_page: 100 } });
    out.push(...(r.data ?? []));
    if (!r.meta?.last_page || page >= r.meta.last_page) break;
  }
  return out;
}

/** Calendar days in [start, end), fetched in ~3-month chunks so no single request is too large or slow. */
async function getCalendar(propertyId: string, start: Date, end: Date): Promise<HCalendarDay[]> {
  const days: HCalendarDay[] = [];
  for (let from = start; from < end; from = addDays(from, 90)) {
    const to = addDays(from, 89) < addDays(end, -1) ? addDays(from, 89) : addDays(end, -1);
    const r = await api<{ data?: { days?: HCalendarDay[] } | HCalendarDay[]; days?: HCalendarDay[] }>(`/properties/${encodeURIComponent(propertyId)}/calendar`, {
      query: { start_date: from.toISOString().slice(0, 10), end_date: to.toISOString().slice(0, 10) },
    });
    const chunk = Array.isArray(r.data) ? r.data : (r.data?.days ?? r.days ?? []);
    days.push(...chunk);
  }
  return days;
}

/** PUT dates in batches of 60 (Hospitable's limit). */
async function updateCalendar(propertyId: string, dates: { date: string; available: boolean; note?: string | null }[]) {
  for (let i = 0; i < dates.length; i += 60) {
    await api(`/properties/${encodeURIComponent(propertyId)}/calendar`, { method: "PUT", body: { dates: dates.slice(i, i + 60) } });
  }
}

/** Hospitable properties for the connections page, with which Keyvaga listing each is linked to. */
export async function hospitableOverview(ownerId: string) {
  const [props, linked] = await Promise.all([
    listHospitableProperties(),
    db.listing.findMany({ where: { ownerId, hospitablePropertyId: { not: null } }, select: { id: true, title: true, hospitablePropertyId: true, hospitableSyncedAt: true, hospitableSyncError: true } }),
  ]);
  const byProp = new Map(linked.map((l) => [l.hospitablePropertyId!, l]));
  return props.map((p) => ({ id: p.id, name: p.public_name || p.name || "Untitled", city: p.address?.city ?? "", state: p.address?.state ?? "", listing: byProp.get(p.id) ?? null }));
}

/** Creates a draft Keyvaga listing from a Hospitable property, copies its photos, and syncs its calendar. */
export async function importHospitableProperty(ownerId: string, propertyId: string): Promise<string> {
  if (await db.listing.findUnique({ where: { hospitablePropertyId: propertyId }, select: { id: true } })) throw new HospitableError("That property is already linked to a Keyvaga listing.");
  const r = await api<{ data: HProperty }>(`/properties/${encodeURIComponent(propertyId)}`);
  const fields = listingFromProperty(r.data);
  const today = todayIn(fields.timeZone);
  const days = await getCalendar(propertyId, today, addDays(today, 90)).catch(() => []);
  const base = medianRate(calendarToKeyvaga(days).rates);
  const listing = await db.listing.create({
    data: {
      ...fields,
      ownerId,
      slug: `${slugify(fields.title)}-${crypto.randomUUID().slice(0, 6)}`,
      nightlyRateCents: base,
      status: "DRAFT",
      hospitablePropertyId: propertyId,
    },
  });
  await copyPhotos(listing.id, listing.title, propertyId).catch((e) => console.error("hospitable photo import failed", e));
  await syncHospitableListing(listing.id);
  return listing.id;
}

/** Links an existing Keyvaga listing (keeps its details and photos) and syncs the calendar. */
export async function linkHospitableProperty(ownerId: string, listingId: string, propertyId: string) {
  const l = await db.listing.findUnique({ where: { id: listingId }, select: { ownerId: true, pricelabsListingId: true } });
  if (!l || l.ownerId !== ownerId) throw new HospitableError("Listing not found.");
  if (l.pricelabsListingId) throw new HospitableError("That listing gets its prices straight from PriceLabs. Unlink it on the PriceLabs page first.");
  const taken = await db.listing.findUnique({ where: { hospitablePropertyId: propertyId }, select: { id: true } });
  if (taken && taken.id !== listingId) throw new HospitableError("That Hospitable property is already linked to another listing.");
  await db.listing.update({ where: { id: listingId }, data: { hospitablePropertyId: propertyId } });
  await syncHospitableListing(listingId);
}

export async function unlinkHospitableListing(ownerId: string, listingId: string) {
  const l = await db.listing.findUnique({ where: { id: listingId }, select: { ownerId: true } });
  if (!l || l.ownerId !== ownerId) throw new HospitableError("Listing not found.");
  await db.$transaction([
    db.calendarBlock.deleteMany({ where: { listingId, source: "HOSPITABLE" } }),
    db.listing.update({ where: { id: listingId }, data: { hospitablePropertyId: null, hospitableSyncedAt: null, hospitableSyncError: null } }),
  ]);
}

async function copyPhotos(listingId: string, title: string, propertyId: string) {
  const r = await api<{ data?: { url?: string }[] }>(`/properties/${encodeURIComponent(propertyId)}/images`);
  const urls = (r.data ?? []).map((i) => i.url).filter((u): u is string => typeof u === "string" && u.startsWith("https://")).slice(0, MAX_PHOTOS_PER_LISTING);
  let position = 0;
  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) continue;
      const bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.length > MAX_UPLOAD_BYTES * 3) continue;
      const type = sniffImageType(bytes);
      if (!type) continue;
      const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
      const stored = await putImage(`listings/${listingId}/${crypto.randomUUID()}.${ext}`, bytes, type);
      const { width, height } = imageSize(bytes, type);
      await db.listingPhoto.create({ data: { listingId, url: stored.url, storageKey: stored.storageKey, width, height, alt: `${title} photo`, position: position++ } });
    } catch (e) {
      console.error("hospitable photo copy failed", e instanceof Error ? e.message : e);
    }
  }
}

/** Width/height from image headers (JPEG, PNG, WebP); falls back to 3:2. */
function imageSize(b: Buffer, type: string): { width: number; height: number } {
  try {
    if (type === "image/png") return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
    if (type === "image/webp") {
      const chunk = b.toString("ascii", 12, 16);
      if (chunk === "VP8X") return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
      if (chunk === "VP8 ") return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
      if (chunk === "VP8L") { const n = b.readUInt32LE(21); return { width: 1 + (n & 0x3fff), height: 1 + ((n >> 14) & 0x3fff) }; }
    }
    if (type === "image/jpeg") {
      let i = 2;
      while (i < b.length) {
        if (b[i] !== 0xff) { i++; continue; }
        const marker = b[i + 1]!;
        const len = b.readUInt16BE(i + 2);
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) };
        i += 2 + len;
      }
    }
  } catch {}
  return { width: 1500, height: 1000 };
}

/** Pulls prices and unavailable days for the next year into Keyvaga. Keeps the old blocks if Hospitable is unreachable. */
export async function syncHospitableListing(listingId: string) {
  const l = await db.listing.findUnique({ where: { id: listingId }, select: { id: true, hospitablePropertyId: true, timeZone: true } });
  if (!l?.hospitablePropertyId) return { ok: false as const, error: "Not linked to Hospitable." };
  try {
    const today = todayIn(l.timeZone);
    const end = addDays(today, HORIZON_DAYS);
    const cal = calendarToKeyvaga(await getCalendar(l.hospitablePropertyId, today, end));
    // Only nights in the window, one price per night (a repeated day would break the save).
    const seen = new Set<string>();
    const rates = cal.rates.filter((r) => r.date >= today && r.date < end && !seen.has(r.date.toISOString()) && (seen.add(r.date.toISOString()), true));
    const blocked = cal.blocked.filter((b) => b.end > today && b.start < end);
    await db.$transaction([
      db.calendarBlock.deleteMany({ where: { listingId: l.id, source: "HOSPITABLE" } }),
      db.calendarBlock.createMany({ data: blocked.map((b) => ({ listingId: l.id, source: "HOSPITABLE" as const, startDate: b.start, endDate: b.end, note: "Hospitable" })) }),
      ...(rates.length
        ? [
            db.dateRate.deleteMany({ where: { listingId: l.id, date: { gte: today, lt: end } } }),
            db.dateRate.createMany({ data: rates.map((r) => ({ listingId: l.id, date: r.date, rateCents: r.rateCents })) }),
          ]
        : []),
      db.listing.update({ where: { id: l.id }, data: { hospitableSyncedAt: new Date(), hospitableSyncError: null } }),
    ]);
    return { ok: true as const, blocked: blocked.length, rates: rates.length };
  } catch (e) {
    // Show the real reason (only the owner sees this) so problems can be fixed quickly.
    const detail = e instanceof Error ? e.message.replace(/\s+/g, " ").slice(0, 200) : String(e).slice(0, 200);
    const error = e instanceof HospitableError ? e.message : `Couldn't sync with Hospitable: ${detail}`;
    if (!(e instanceof HospitableError)) console.error("hospitable sync failed", l.id, e instanceof Error ? e.message : e);
    await db.listing.update({ where: { id: l.id }, data: { hospitableSyncedAt: new Date(), hospitableSyncError: error } });
    return { ok: false as const, error };
  }
}

/** Re-syncs if the last sync is older than `maxAgeMinutes` (before bookings and on page views). */
export async function refreshHospitableIfStale(listingId: string, maxAgeMinutes: number) {
  if (!process.env.HOSPITABLE_PAT) return;
  const l = await db.listing.findUnique({ where: { id: listingId }, select: { hospitablePropertyId: true, hospitableSyncedAt: true } });
  if (!l?.hospitablePropertyId) return;
  if (l.hospitableSyncedAt && Date.now() - l.hospitableSyncedAt.getTime() < maxAgeMinutes * 60_000) return;
  await syncHospitableListing(listingId);
}

/** Blocks a confirmed Keyvaga booking's nights on the linked Hospitable calendar (closes the other channels). */
export async function pushBookingToHospitable(bookingId: string) {
  if (!process.env.HOSPITABLE_PAT) return "not_configured";
  const b = await db.booking.findUnique({ where: { id: bookingId }, include: { listing: { select: { hospitablePropertyId: true } }, guest: { select: { name: true } } } });
  if (!b?.listing.hospitablePropertyId || b.status !== "CONFIRMED" || b.hospitableBlockedAt) return "skipped";
  const note = `Keyvaga booking ${b.id.slice(-8).toUpperCase()}: ${b.guest.name}`.slice(0, 500);
  await updateCalendar(b.listing.hospitablePropertyId, stayNights(b.checkIn, b.checkOut).map((date) => ({ date, available: false, note })));
  await db.booking.update({ where: { id: b.id }, data: { hospitableBlockedAt: new Date() } });
  return "blocked";
}

/** Reopens a cancelled Keyvaga booking's nights on Hospitable (only ones Keyvaga blocked). */
export async function releaseBookingInHospitable(bookingId: string) {
  if (!process.env.HOSPITABLE_PAT) return "not_configured";
  const b = await db.booking.findUnique({ where: { id: bookingId }, include: { listing: { select: { hospitablePropertyId: true } } } });
  if (!b?.listing.hospitablePropertyId || !b.hospitableBlockedAt) return "skipped";
  const today = todayIn();
  const nights = stayNights(b.checkIn, b.checkOut).filter((d) => d >= today.toISOString().slice(0, 10));
  if (nights.length) await updateCalendar(b.listing.hospitablePropertyId, nights.map((date) => ({ date, available: true, note: null })));
  await db.booking.update({ where: { id: b.id }, data: { hospitableBlockedAt: null } });
  await syncHospitableListing(b.listingId); // drop the now-reopened nights from Keyvaga's copy right away
  return "released";
}

/** Daily cron: sync every linked listing, and retry blocking any confirmed bookings not yet pushed. */
export async function runHospitableSync() {
  if (!process.env.HOSPITABLE_PAT) return { skipped: "not configured" };
  const listings = await db.listing.findMany({ where: { hospitablePropertyId: { not: null } }, select: { id: true } });
  const result: Record<string, string> = {};
  for (const { id } of listings) {
    const r = await syncHospitableListing(id);
    if (!r.ok) result[id] = `error: ${r.error}`;
  }
  const unpushed = await db.booking.findMany({ where: { status: "CONFIRMED", hospitableBlockedAt: null, checkOut: { gt: todayIn() }, listing: { hospitablePropertyId: { not: null } } }, select: { id: true } });
  for (const { id } of unpushed) {
    const r = await pushBookingToHospitable(id).catch((e) => `error: ${e instanceof Error ? e.message : e}`);
    if (r.startsWith("error")) result[`push ${id}`] = r;
  }
  return { listings: listings.length, ...result };
}
