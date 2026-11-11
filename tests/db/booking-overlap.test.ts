/**
 * Runs against a real Postgres (TEST_DATABASE_URL) to prove the database
 * itself refuses double-bookings, independent of application code.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite("double-booking prevention (database constraint)", () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let listingId = "";
  let guestId = "";

  const d = (s: string) => new Date(`${s}T00:00:00Z`);
  const book = (checkIn: string, checkOut: string, status: "PENDING_PAYMENT" | "CONFIRMED" | "CANCELLED" = "CONFIRMED", lid = listingId) =>
    db.booking.create({
      data: {
        listingId: lid, guestId, checkIn: d(checkIn), checkOut: d(checkOut), guests: 2, status,
        nightlyCents: 10000, cleaningCents: 0, serviceCents: 0, totalCents: 10000, dueNowCents: 10000,
      },
    });

  beforeAll(async () => {
    await db.$connect();
  });

  beforeEach(async () => {
    await db.payment.deleteMany();
    await db.booking.deleteMany();
    await db.calendarBlock.deleteMany();
    await db.listingPhoto.deleteMany();
    await db.listing.deleteMany();
    await db.user.deleteMany();
    const owner = await db.user.create({ data: { email: "o@test", name: "O", passwordHash: "x" } });
    const guest = await db.user.create({ data: { email: "g@test", name: "G", passwordHash: "x" } });
    guestId = guest.id;
    const listing = await db.listing.create({
      data: {
        ownerId: owner.id, slug: "t", title: "T", summary: "s", propertyType: "HOUSE", city: "C", region: "R",
        bedrooms: 1, bathrooms: "1", maxGuests: 2, nightlyRateCents: 10000, status: "PUBLISHED",
      },
    });
    listingId = listing.id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("refuses an overlapping confirmed booking", async () => {
    await book("2026-11-14", "2026-11-18");
    await expect(book("2026-11-16", "2026-11-20")).rejects.toThrow();
    await expect(book("2026-11-10", "2026-11-15")).rejects.toThrow();
    await expect(book("2026-11-15", "2026-11-16")).rejects.toThrow();
  });

  it("allows back-to-back stays (checkout day = next check-in day)", async () => {
    await book("2026-11-14", "2026-11-18");
    await expect(book("2026-11-18", "2026-11-20")).resolves.toBeTruthy();
    await expect(book("2026-11-10", "2026-11-14")).resolves.toBeTruthy();
  });

  it("treats a pending-payment hold as taken", async () => {
    await book("2026-12-01", "2026-12-05", "PENDING_PAYMENT");
    await expect(book("2026-12-03", "2026-12-06")).rejects.toThrow();
  });

  it("frees dates when a booking is cancelled", async () => {
    const b = await book("2026-12-01", "2026-12-05");
    await db.booking.update({ where: { id: b.id }, data: { status: "CANCELLED" } });
    await expect(book("2026-12-01", "2026-12-05")).resolves.toBeTruthy();
  });

  it("does not block other listings", async () => {
    await book("2026-11-14", "2026-11-18");
    const other = await db.listing.create({
      data: {
        ownerId: (await db.user.findFirstOrThrow({ where: { email: "o@test" } })).id, slug: "t2", title: "T2", summary: "s",
        propertyType: "HOUSE", city: "C", region: "R", bedrooms: 1, bathrooms: "1", maxGuests: 2, nightlyRateCents: 10000,
      },
    });
    await expect(book("2026-11-14", "2026-11-18", "CONFIRMED", other.id)).resolves.toBeTruthy();
  });

  it("refuses zero-night and backwards stays", async () => {
    await expect(book("2026-11-14", "2026-11-14")).rejects.toThrow();
    await expect(book("2026-11-18", "2026-11-14")).rejects.toThrow();
  });

  it("refuses two simultaneous bookings for the same dates (race)", async () => {
    const results = await Promise.allSettled([book("2027-01-01", "2027-01-05"), book("2027-01-02", "2027-01-06")]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });
});
