/** Smart lock codes against a real Postgres (TEST_DATABASE_URL), with a fake lock service. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { parseISODate } from "@/lib/dates";
import { setSeamClient, SeamError, type SeamClient, type SeamCode } from "@/lib/locks/seam";
import { assignLock, doorCodeText, doorCodesFor, finishPendingConnects, issueBookingCodes, issueJobCodes, retryEvent, revokeBookingCodes, startConnect } from "@/lib/locks";

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;
const d = (s: string) => parseISODate(s)!;

class FakeSeam implements SeamClient {
  codes = new Map<string, SeamCode & { deviceId: string; startsAt: Date; endsAt: Date; name: string }>();
  failNext = 0;
  next = 0;
  rejectCustomCode = false;
  webviewStatus = "pending";
  devices = [
    { id: "dev_front", name: "Front door", provider: "Schlage", online: true, supportsCodes: true },
    { id: "dev_side", name: "Side door", provider: "Schlage", online: true, supportsCodes: true },
    { id: "dev_cam", name: "Doorbell", provider: "Ring", online: true, supportsCodes: false },
  ];
  async createConnectWebview() { return { id: "wv_1", url: "https://connect.example/wv_1" }; }
  async getConnectWebview() { return { status: this.webviewStatus, connectedAccountId: this.webviewStatus === "authorized" ? "ca_1" : null }; }
  async getConnectedAccount() { return { provider: "Schlage", label: "owner@example.com" }; }
  async deleteConnectedAccount() {}
  async listDevices() { return this.devices; }
  async createAccessCode(input: { deviceId: string; name: string; code?: string; startsAt: Date; endsAt: Date }) {
    if (this.failNext > 0) { this.failNext--; throw new SeamError("Lock is offline", 503); }
    if (input.code && this.rejectCustomCode) throw new SeamError("Code must be 4 digits", 400);
    const id = `ac_${++this.next}`;
    const c = { id, code: input.code ?? "4321", status: "setting", error: null, ...input };
    this.codes.set(id, c);
    return c;
  }
  async getAccessCode(id: string) { return this.codes.get(id) ?? null; }
  async deleteAccessCode(id: string) { this.codes.delete(id); }
}

suite("smart locks (database)", () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  const fake = new FakeSeam();
  let ownerId = "", guestId = "", listingId = "", otherListingId = "";

  async function booking(id: string, checkIn: string, checkOut: string) {
    return db.booking.create({ data: { id, listingId, guestId, checkIn: d(checkIn), checkOut: d(checkOut), guests: 2, status: "CONFIRMED", confirmedAt: new Date(), nightlyCents: 1, cleaningCents: 0, serviceCents: 0, totalCents: 1, dueNowCents: 1 } });
  }

  beforeAll(async () => {
    setSeamClient(fake);
    await db.lockEvent.deleteMany(); await db.accessCode.deleteMany(); await db.lock.deleteMany(); await db.lockAccount.deleteMany(); await db.lockConnectSession.deleteMany();
    await db.passwordResetToken.deleteMany(); await db.autoMessageLog.deleteMany(); await db.messageTemplate.deleteMany(); await db.message.deleteMany();
    await db.jobPayment.deleteMany(); await db.jobReview.deleteMany(); await db.jobMessage.deleteMany(); await db.quote.deleteMany(); await db.job.deleteMany(); await db.providerPhoto.deleteMany(); await db.providerProfile.deleteMany();
    await db.payment.deleteMany(); await db.booking.deleteMany(); await db.listingPhoto.deleteMany(); await db.listing.deleteMany(); await db.session.deleteMany(); await db.userRole.deleteMany(); await db.user.deleteMany();
    ownerId = (await db.user.create({ data: { email: "o-lk@test.example", name: "Jordan Owens", passwordHash: "x" } })).id;
    guestId = (await db.user.create({ data: { email: "g-lk@test.example", name: "Alex Garcia", passwordHash: "x" } })).id;
    const base = { ownerId, summary: "s", propertyType: "CABIN" as const, city: "Lake Geneva", region: "WI", postalCode: "53147", addressLine1: "1 Shore Rd", bedrooms: 3, bathrooms: "2", maxGuests: 6, nightlyRateCents: 1, status: "PUBLISHED" as const };
    listingId = (await db.listing.create({ data: { ...base, slug: "lk", title: "Lakeside Cabin" } })).id;
    otherListingId = (await db.listing.create({ data: { ...base, slug: "lk2", title: "Other", timeZone: "America/New_York" } })).id;
  });
  afterAll(async () => {
    setSeamClient(null);
    await db.$disconnect();
  });

  it("connects an account after the owner signs in, and lists only locks that take codes", async () => {
    expect(await startConnect(ownerId, "https://keyvaga.test/owner/locks")).toBe("https://connect.example/wv_1");
    expect(await finishPendingConnects(ownerId)).toBe(0); // still pending
    fake.webviewStatus = "authorized";
    expect(await finishPendingConnects(ownerId)).toBe(1);
    const locks = await db.lock.findMany({ where: { ownerId }, orderBy: { name: "asc" } });
    expect(locks.map((l) => l.name)).toEqual(["Front door", "Side door"]);
    expect(await db.lockConnectSession.count()).toBe(0);
  });

  it("assigning locks creates codes for upcoming bookings, same code on each door, local times", async () => {
    await booking("bk_lk1", "2099-07-03", "2099-07-06");
    const [front, side] = await db.lock.findMany({ where: { ownerId }, orderBy: { name: "asc" } });
    await assignLock(ownerId, front!.id, listingId);
    await assignLock(ownerId, side!.id, listingId);
    const codes = await db.accessCode.findMany({ where: { bookingId: "bk_lk1" } });
    expect(codes).toHaveLength(2);
    expect(new Set(codes.map((c) => c.code)).size).toBe(1);
    expect(codes[0]!.name).toBe("Alex 7/3");
    expect(codes[0]!.startsAt.toISOString()).toBe("2099-07-03T21:00:00.000Z"); // 4 PM Central
    expect(codes[0]!.endsAt.toISOString()).toBe("2099-07-06T15:00:00.000Z"); // 10 AM Central
    expect(fake.codes.size).toBe(2);
    // Calling again doesn't duplicate.
    expect(await issueBookingCodes("bk_lk1")).toBe(0);
    expect(await doorCodeText("bk_lk1")).toBe(codes[0]!.code);
  });

  it("cancelling removes the codes from the locks", async () => {
    await db.booking.update({ where: { id: "bk_lk1" }, data: { status: "CANCELLED" } });
    expect(await revokeBookingCodes("bk_lk1")).toBe(2);
    expect(fake.codes.size).toBe(0);
    expect(await doorCodesFor({ bookingId: "bk_lk1" })).toEqual([]);
  });

  it("a failed code is logged with Retry, the guest sees the backup code meanwhile, and Retry fixes it", async () => {
    const [front, side] = await db.lock.findMany({ where: { ownerId }, orderBy: { name: "asc" } });
    await db.lock.update({ where: { id: side!.id }, data: { listingId: otherListingId } });
    await db.lock.update({ where: { id: front!.id }, data: { backupCode: "998877" } });
    await booking("bk_lk2", "2099-08-01", "2099-08-03");
    fake.failNext = 1;
    expect(await issueBookingCodes("bk_lk2")).toBe(0);
    const [row] = await doorCodesFor({ bookingId: "bk_lk2" });
    expect(row!.status).toBe("FAILED");
    expect(row!.backupCode).toBe("998877");
    expect(await doorCodeText("bk_lk2")).toBe("998877");
    const ev = await db.lockEvent.findFirstOrThrow({ where: { bookingId: "bk_lk2", retryable: true } });
    expect(ev.message).toContain("Lock is offline");
    expect(await retryEvent(ownerId, ev.id)).toBe(true);
    const [fixed] = await doorCodesFor({ bookingId: "bk_lk2" });
    expect(fixed!.status).toBe("SETTING");
    expect(fixed!.backupCode).toBeNull();
  });

  it("lets the lock choose the code when it rejects ours", async () => {
    await db.lock.updateMany({ where: { ownerId }, data: { listingId: null } });
    const [front] = await db.lock.findMany({ where: { ownerId }, orderBy: { name: "asc" } });
    await booking("bk_lk3", "2099-09-01", "2099-09-03");
    fake.rejectCustomCode = true;
    await assignLock(ownerId, front!.id, listingId);
    fake.rejectCustomCode = false;
    expect(await doorCodeText("bk_lk3")).toBe("4321");
  });

  it("hired service jobs get a code for the scheduled day", async () => {
    const job = await db.job.create({ data: { ownerId, listingId, category: "cleaning", title: "Turnover", description: "x", status: "ASSIGNED", scheduledDate: d("2099-09-03") } });
    expect(await issueJobCodes(job.id)).toBe(1);
    const [c] = await doorCodesFor({ jobId: job.id });
    expect(c!.startsAt.toISOString()).toBe("2099-09-03T12:00:00.000Z");
    expect(c!.endsAt.toISOString()).toBe("2099-09-04T02:00:00.000Z");
  });
});
