/** Automated guest messages against a real Postgres (TEST_DATABASE_URL). */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { parseISODate } from "@/lib/dates";
import { runAutoMessages, sendDueAutoMessages } from "@/lib/auto-messages-server";
import { SUGGESTED_TEMPLATES } from "@/lib/auto-messages";

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;
const d = (s: string) => parseISODate(s)!;

suite("automated guest messages (database)", () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let ownerId = "", guestId = "", listingId = "";

  async function booking(id: string, checkIn: string, checkOut: string, confirmedAt: string, status: "CONFIRMED" | "CANCELLED" = "CONFIRMED") {
    return db.booking.create({ data: { id, listingId, guestId, checkIn: d(checkIn), checkOut: d(checkOut), guests: 2, status, confirmedAt: new Date(confirmedAt), nightlyCents: 1, cleaningCents: 0, serviceCents: 0, totalCents: 1, dueNowCents: 1 } });
  }
  const msgs = (bookingId: string) => db.message.findMany({ where: { bookingId }, orderBy: { createdAt: "asc" } });

  beforeAll(async () => {
    await db.passwordResetToken.deleteMany(); await db.autoMessageLog.deleteMany(); await db.messageTemplate.deleteMany(); await db.message.deleteMany();
    await db.jobPayment.deleteMany(); await db.jobReview.deleteMany(); await db.jobMessage.deleteMany(); await db.quote.deleteMany(); await db.job.deleteMany(); await db.providerPhoto.deleteMany(); await db.providerProfile.deleteMany();
    await db.payment.deleteMany(); await db.booking.deleteMany(); await db.listingPhoto.deleteMany(); await db.listing.deleteMany(); await db.session.deleteMany(); await db.userRole.deleteMany(); await db.user.deleteMany();
    ownerId = (await db.user.create({ data: { email: "o-am@test.example", name: "Jordan Owens", passwordHash: "x" } })).id;
    guestId = (await db.user.create({ data: { email: "g-am@test.example", name: "Alex Garcia", passwordHash: "x" } })).id;
    listingId = (await db.listing.create({ data: { ownerId, slug: "am", title: "Lakeside Cabin", summary: "s", propertyType: "CABIN", city: "Lake Geneva", region: "WI", postalCode: "53147", addressLine1: "1 Shore Rd", bedrooms: 3, bathrooms: "2", maxGuests: 6, nightlyRateCents: 1, status: "PUBLISHED", checkInInstructions: "Lockbox 4321" } })).id;
    await db.messageTemplate.createMany({ data: SUGGESTED_TEMPLATES.map((t) => ({ ...t, ownerId })) });
  });
  afterAll(() => db.$disconnect());

  it("sends 'thanks for booking' on confirmation with fill-ins, and nothing else early", async () => {
    await booking("bk_am1", "2027-07-03", "2027-07-06", "2027-05-01T15:00:00Z");
    expect(await sendDueAutoMessages("bk_am1", d("2027-05-01"))).toBe(1);
    const [m] = await msgs("bk_am1");
    expect(m!.automated).toBe(true);
    expect(m!.senderId).toBe(ownerId);
    expect(m!.body).toContain("Hi Alex! Thank you for booking Lakeside Cabin for Saturday, July 3 to Tuesday, July 6.");
    expect(m!.body).toContain("Jordan");
    // Running again sends nothing new.
    expect(await sendDueAutoMessages("bk_am1", d("2027-05-01"))).toBe(0);
  });

  it("daily run sends each message on its day, once", async () => {
    await runAutoMessages(d("2027-06-26")); // 7 days before check-in
    let all = await msgs("bk_am1");
    expect(all).toHaveLength(2);
    expect(all[1]!.body).toContain("Address: 1 Shore Rd, Lake Geneva, WI 53147");
    expect(all[1]!.body).toContain("Lockbox 4321");
    await runAutoMessages(d("2027-06-26"));
    expect(await msgs("bk_am1")).toHaveLength(2);
    await runAutoMessages(d("2027-07-03")); // welcome
    await runAutoMessages(d("2027-07-05")); // checkout reminder
    await runAutoMessages(d("2027-07-07")); // thanks for staying
    all = await msgs("bk_am1");
    expect(all.map((x) => x.body.slice(0, 20))).toHaveLength(5);
  });

  it("late bookings catch up on missed pre-arrival messages", async () => {
    await booking("bk_am2", "2027-08-10", "2027-08-12", "2027-08-08T10:00:00Z");
    expect(await sendDueAutoMessages("bk_am2", d("2027-08-08"))).toBe(2); // thanks + check-in details
  });

  it("respects off switches, listing scope and cancellations", async () => {
    await db.messageTemplate.updateMany({ where: { ownerId, name: "Thanks for booking" }, data: { enabled: false } });
    await booking("bk_am3", "2027-09-10", "2027-09-12", "2027-08-01T10:00:00Z");
    expect(await sendDueAutoMessages("bk_am3", d("2027-08-01"))).toBe(0);
    const other = await db.listing.create({ data: { ownerId, slug: "am2", title: "Other", summary: "s", propertyType: "HOUSE", city: "C", region: "WI", bedrooms: 1, bathrooms: "1", maxGuests: 2, nightlyRateCents: 1, status: "PUBLISHED" } });
    await db.messageTemplate.create({ data: { ownerId, listingId: other.id, name: "Other only", trigger: "BOOKING_CONFIRMED", offsetDays: 0, body: "Only for the other listing" } });
    expect(await sendDueAutoMessages("bk_am3", d("2027-08-01"))).toBe(0);
    await booking("bk_am4", "2027-09-20", "2027-09-22", "2027-09-01T10:00:00Z", "CANCELLED");
    expect(await sendDueAutoMessages("bk_am4", d("2027-09-19"))).toBe(0);
  });
});
