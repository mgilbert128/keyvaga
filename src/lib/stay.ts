import "server-only";
import { db } from "@/lib/db";
import { addDays, unavailableNights } from "@/lib/dates";

export async function getPublishedStay(slug: string) {
  return db.listing.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: {
      id: true, slug: true, title: true, summary: true, description: true, propertyType: true,
      city: true, region: true, postalCode: true, latitude: true, longitude: true, bedrooms: true, bathrooms: true, maxGuests: true,
      nightlyRateCents: true, cleaningFeeCents: true, minNights: true, instantBook: true, cancellationPolicy: true, permitRequired: true, permitNumber: true,
      hostingRole: true,
      documents: { select: { id: true, type: true, status: true, expiresAt: true, createdAt: true } },
      weekendRateCents: true, weeklyDiscountBps: true, monthlyDiscountBps: true,
      seasonalRates: { select: { name: true, startDate: true, endDate: true, nightlyRateCents: true } },
      // Custom per-night prices from the owner calendar (future nights only).
      dateRates: { where: { date: { gte: new Date(Date.now() - 2 * 86_400_000) } }, select: { date: true, rateCents: true } },
      amenities: true, houseRules: true, checkInTime: true, checkOutTime: true,
      // Exact address deliberately not selected: guests get it only after booking.
      photos: { orderBy: { position: "asc" }, select: { id: true, url: true, alt: true } },
      videoKey: true, videoUrl: true, videoAccess: true, videoDurationSec: true,
      owner: { select: { name: true, createdAt: true } },
    },
  });
}

/** Nights already taken by active bookings or owner/sync blocks, from `from` for `days` days. */
export async function getUnavailableNights(listingId: string, from: Date, days = 400): Promise<Set<string>> {
  const until = addDays(from, days);
  const [bookings, blocks] = await Promise.all([
    db.booking.findMany({
      where: {
        listingId,
        checkOut: { gt: from },
        checkIn: { lt: until },
        OR: [{ status: "CONFIRMED" }, { status: "PENDING_PAYMENT", holdExpiresAt: { gt: new Date() } }, { status: "REQUESTED", holdExpiresAt: { gt: new Date() } }],
      },
      select: { checkIn: true, checkOut: true },
    }),
    db.calendarBlock.findMany({
      where: { listingId, endDate: { gt: from }, startDate: { lt: until } },
      select: { startDate: true, endDate: true },
    }),
  ]);
  return unavailableNights([
    ...bookings.map((b) => ({ start: b.checkIn, end: b.checkOut })),
    ...blocks.map((b) => ({ start: b.startDate, end: b.endDate })),
  ]);
}

export async function getStayReviews(listingId: string) {
  const [agg, reviews] = await Promise.all([
    db.review.aggregate({ where: { listingId }, _avg: { rating: true }, _count: true }),
    db.review.findMany({ where: { listingId }, orderBy: { createdAt: "desc" }, take: 20, include: { guest: { select: { name: true } } } }),
  ]);
  return { average: agg._avg.rating, count: agg._count, reviews };
}
