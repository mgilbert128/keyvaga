/** Search filters against a real Postgres (TEST_DATABASE_URL). */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { buildSearchWhere } from "@/lib/listings";
import { parseISODate } from "@/lib/dates";

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite("search filters (database)", () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  const d = (s: string) => parseISODate(s)!;
  const titles = async (f: Parameters<typeof buildSearchWhere>[0]) =>
    (await db.listing.findMany({ where: buildSearchWhere(f), select: { title: true }, orderBy: { title: "asc" } })).map((l) => l.title);

  beforeAll(async () => {
    await db.payment.deleteMany();
    await db.booking.deleteMany();
    await db.calendarBlock.deleteMany();
    await db.listingPhoto.deleteMany();
    await db.listing.deleteMany();
    await db.user.deleteMany();
    const owner = await db.user.create({ data: { email: "s@test", name: "S", passwordHash: "x" } });
    const guest = await db.user.create({ data: { email: "g2@test", name: "G", passwordHash: "x" } });
    const base = { ownerId: owner.id, summary: "s", region: "WI", bathrooms: "1", status: "PUBLISHED" as const };
    const cabin = await db.listing.create({ data: { ...base, slug: "a", title: "Cabin", propertyType: "CABIN", city: "Lake Geneva", bedrooms: 3, maxGuests: 6, nightlyRateCents: 18500, amenities: ["wifi", "hot_tub"] } });
    await db.listing.create({ data: { ...base, slug: "b", title: "Loft", propertyType: "APARTMENT", city: "Madison", bedrooms: 1, maxGuests: 2, nightlyRateCents: 9000, amenities: ["wifi"] } });
    const villa = await db.listing.create({ data: { ...base, slug: "c", title: "Villa", propertyType: "VILLA", city: "Lake Delton", bedrooms: 5, maxGuests: 10, nightlyRateCents: 40000, amenities: ["pool", "hot_tub"] } });
    await db.listing.create({ data: { ...base, slug: "d", title: "Draft", propertyType: "HOUSE", city: "Lake Geneva", bedrooms: 2, maxGuests: 4, nightlyRateCents: 10000, status: "DRAFT" } });
    await db.booking.create({ data: { listingId: cabin.id, guestId: guest.id, checkIn: d("2026-12-10"), checkOut: d("2026-12-15"), guests: 2, status: "CONFIRMED", nightlyCents: 1, cleaningCents: 0, serviceCents: 0, totalCents: 1, dueNowCents: 1 } });
    await db.calendarBlock.create({ data: { listingId: villa.id, startDate: d("2026-12-20"), endDate: d("2026-12-24") } });
  });
  afterAll(() => db.$disconnect());

  it("never shows unpublished listings", async () => {
    expect(await titles({})).toEqual(["Cabin", "Loft", "Villa"]);
  });
  it("filters by place, guests, bedrooms and price", async () => {
    expect(await titles({ where: "lake" })).toEqual(["Cabin", "Villa"]);
    expect(await titles({ guests: 5 })).toEqual(["Cabin", "Villa"]);
    expect(await titles({ bedrooms: 4 })).toEqual(["Villa"]);
    expect(await titles({ minPriceCents: 10000, maxPriceCents: 20000 })).toEqual(["Cabin"]);
  });
  it("filters by type and requires every chosen amenity", async () => {
    expect(await titles({ types: ["CABIN", "APARTMENT"] })).toEqual(["Cabin", "Loft"]);
    expect(await titles({ amenities: ["hot_tub"] })).toEqual(["Cabin", "Villa"]);
    expect(await titles({ amenities: ["hot_tub", "wifi"] })).toEqual(["Cabin"]);
  });
  it("hides listings booked or blocked on the chosen dates, but allows checkout-day check-in", async () => {
    expect(await titles({ checkIn: d("2026-12-12"), checkOut: d("2026-12-14") })).toEqual(["Loft", "Villa"]);
    expect(await titles({ checkIn: d("2026-12-15"), checkOut: d("2026-12-18") })).toEqual(["Cabin", "Loft", "Villa"]);
    expect(await titles({ checkIn: d("2026-12-22"), checkOut: d("2026-12-26") })).toEqual(["Cabin", "Loft"]);
  });
});
