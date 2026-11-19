import "server-only";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { listingVerification } from "@/lib/documents";
import { addDays, todayIn } from "@/lib/dates";
import { quoteStay, typicalRateCents, type PriceInputs } from "@/lib/pricing";
import { bookingAmounts } from "@/lib/booking-money";
import { destinationTerms } from "@/lib/place";
import { shownRatings } from "@/lib/external-ratings";
import type { Prisma } from "@/generated/prisma/client";

export type ListingCardData = {
  id: string;
  slug: string;
  title: string;
  city: string;
  region: string;
  maxGuests: number;
  bedrooms: number;
  /** The owner's base rate (kept for reference; cards show `price`). */
  nightlyRateCents: number;
  /**
   * What the card shows. Without dates: the typical (median) nightly rate over the next 90 days ("Typically $X / night").
   * With dates: the guest's total for that stay (nights, discounts, cleaning and Keyvaga's guest fee; before taxes).
   */
  price: CardPrice;
  coverUrl: string | null;
  coverAlt: string;
  /** Host documents approved by Keyvaga (shows a "Verified" tag). */
  verified?: boolean;
  /** Average guest rating (1–5, one decimal) and how many reviews; absent with no reviews. */
  rating?: { average: number; count: number };
  /** Condo building or resort, when the owner named one. */
  complex?: { name: string; slug: string };
  /** Verified rating from another site (shown only when there are no Keyvaga reviews yet). */
  outside?: { label: string; rating: number; scale: number; reviewCount: number };
};

export type CardPrice =
  | { kind: "from"; nightlyCents: number; minNights?: number }
  | { kind: "stay"; nights: number; totalCents: number; nightlyCents: number };

/** Card fields plus everything the pricing engine needs. Custom date prices are loaded from `today` on. */
export const cardSelect = (today: Date) => ({
  id: true,
  slug: true,
  title: true,
  city: true,
  region: true,
  maxGuests: true,
  bedrooms: true,
  nightlyRateCents: true,
  cleaningFeeCents: true,
  minNights: true,
  weekendRateCents: true,
  weeklyDiscountBps: true,
  monthlyDiscountBps: true,
  seasonalRates: { select: { name: true, startDate: true, endDate: true, nightlyRateCents: true } },
  dateRates: { where: { date: { gte: today, lt: addDays(today, 400) } }, select: { date: true, rateCents: true } },
  photos: { orderBy: { position: "asc" as const }, take: 1, select: { url: true, alt: true } },
  hostingRole: true,
  permitRequired: true,
  documents: { select: { type: true, status: true, expiresAt: true, createdAt: true } },
  reviews: { select: { rating: true } },
  complex: { select: { name: true, slug: true } },
  externalRatings: { where: { status: "APPROVED" as const }, select: { platform: true, rating: true, reviewCount: true, status: true, verifiedAt: true } },
}) satisfies Prisma.ListingSelect;

type CardRow = Prisma.ListingGetPayload<{ select: ReturnType<typeof cardSelect> }>;

/** Price shown on a card; see ListingCardData.price. Exported for tests. */
export function cardPrice(l: PriceInputs, today: Date, stay?: { checkIn: Date; checkOut: Date }): CardPrice {
  if (stay) {
    const q = quoteStay(l, stay.checkIn, stay.checkOut);
    if (q.ok) return { kind: "stay", nights: q.nights, totalCents: bookingAmounts(q.totalCents).guestTotalCents, nightlyCents: q.nightlyRateCents };
    if (q.reason === "below_min_nights") return { kind: "from", nightlyCents: typicalRateCents(l, today), minNights: q.minNights };
  }
  return { kind: "from", nightlyCents: typicalRateCents(l, today) };
}

/** Builds card data from a row loaded with cardSelect(today). Pass the guest's dates to price that stay. */
export function toCard(row: CardRow, today: Date, stay?: { checkIn: Date; checkOut: Date }): ListingCardData {
  const { photos, hostingRole, permitRequired, documents, seasonalRates, dateRates, cleaningFeeCents, minNights, weekendRateCents, weeklyDiscountBps, monthlyDiscountBps, reviews, complex, externalRatings, ...l } = row;
  const rating = reviews.length ? { average: Math.round((reviews.reduce((t, r) => t + r.rating, 0) / reviews.length) * 10) / 10, count: reviews.length } : undefined;
  const verified = listingVerification({ hostingRole, permitRequired, documents }, today).host !== null;
  const price = cardPrice(
    { nightlyRateCents: l.nightlyRateCents, cleaningFeeCents, minNights, weekendRateCents, weeklyDiscountBps, monthlyDiscountBps, seasons: seasonalRates, dateRates },
    today,
    stay,
  );
  const top = rating ? undefined : shownRatings(externalRatings)[0];
  const outside = top ? { label: top.label, rating: top.rating, scale: top.scale, reviewCount: top.reviewCount } : undefined;
  return { ...l, price, coverUrl: photos[0]?.url ?? null, coverAlt: photos[0]?.alt || l.title, verified, rating, complex: complex ?? undefined, outside };
}

export async function getFeaturedListings(): Promise<ListingCardData[]> {
  await connection(); // prices depend on today's date, so this can't be baked in at build time
  const today = todayIn();
  const rows = await db.listing.findMany({
    where: { status: "PUBLISHED" },
    select: cardSelect(today),
    orderBy: [{ featured: "desc" }, { publishedAt: "desc" }, { createdAt: "asc" }],
    take: 6,
  });
  return rows.map((r) => toCard(r, today));
}

export { SORTS, type SearchFilters, type SortKey } from "./listings-types";
import type { SearchFilters, SortKey } from "./listings-types";

/** Builds the database filter for search. Exported for testing. */
export function buildSearchWhere(f: SearchFilters): Prisma.ListingWhereInput {
  const and: Prisma.ListingWhereInput[] = [{ status: "PUBLISHED" }];
  if (f.guests) and.push({ maxGuests: { gte: f.guests } });
  if (f.bedrooms) and.push({ bedrooms: { gte: f.bedrooms } });
  if (f.minPriceCents !== undefined) and.push({ nightlyRateCents: { gte: f.minPriceCents } });
  if (f.maxPriceCents !== undefined) and.push({ nightlyRateCents: { lte: f.maxPriceCents } });
  if (f.types?.length) and.push({ propertyType: { in: f.types } });
  if (f.amenities?.length) and.push({ amenities: { hasEvery: f.amenities } });
  if (f.complex) and.push({ complex: { slug: f.complex } });
  if (f.city && f.region) and.push({ city: { equals: f.city, mode: "insensitive" }, region: { equals: f.region, mode: "insensitive" } });
  if (f.where) {
    // Every word must match somewhere ("gulf shores, al" → "gulf" AND "shores" AND state AL).
    for (const t of destinationTerms(f.where)) {
      and.push(
        t.kind === "state"
          ? { OR: [{ region: { equals: t.code, mode: "insensitive" } }, { region: { equals: t.name, mode: "insensitive" } }] }
          : {
              OR: [
                { city: { contains: t.text, mode: "insensitive" } },
                { region: { contains: t.text, mode: "insensitive" } },
                { title: { contains: t.text, mode: "insensitive" } },
                { complex: { name: { contains: t.text, mode: "insensitive" } } },
              ],
            },
      );
    }
  }
  if (f.checkIn && f.checkOut && f.checkOut > f.checkIn) {
    const { checkIn, checkOut } = f;
    and.push({
      // Confirmed stays and unexpired checkout holds occupy dates.
      bookings: {
        none: {
          checkIn: { lt: checkOut },
          checkOut: { gt: checkIn },
          OR: [{ status: "CONFIRMED" }, { status: "PENDING_PAYMENT", holdExpiresAt: { gt: f.now ?? new Date() } }, { status: "REQUESTED", holdExpiresAt: { gt: f.now ?? new Date() } }],
        },
      },
      calendarBlocks: { none: { startDate: { lt: checkOut }, endDate: { gt: checkIn } } },
    });
  }
  return { AND: and };
}

const ORDER: Record<SortKey, Prisma.ListingOrderByWithRelationInput[]> = {
  recommended: [{ featured: "desc" }, { publishedAt: "desc" }],
  price_asc: [{ nightlyRateCents: "asc" }],
  price_desc: [{ nightlyRateCents: "desc" }],
  newest: [{ publishedAt: "desc" }],
};

/**
 * Search results. Price filters and price sorting use the price the card shows (the nightly average for
 * the guest's dates, or the lowest upcoming nightly rate without dates), not the owner's base rate, so
 * a $450 base / $140 off-season listing matches "under $200" when it really is. That's computed here,
 * after loading, which is fine at Keyvaga's size (up to 300 candidates).
 */
export async function searchListings(f: SearchFilters): Promise<ListingCardData[]> {
  await connection();
  const today = todayIn();
  const { minPriceCents, maxPriceCents, ...rest } = f;
  const byPrice = f.sort === "price_asc" || f.sort === "price_desc";
  const rows = await db.listing.findMany({
    where: buildSearchWhere(rest),
    select: cardSelect(today),
    orderBy: [...ORDER[byPrice ? "recommended" : (f.sort ?? "recommended")], { id: "asc" }],
    take: 300,
  });
  const stay = f.checkIn && f.checkOut && f.checkOut > f.checkIn ? { checkIn: f.checkIn, checkOut: f.checkOut } : undefined;
  let cards = rows.map((r) => toCard(r, today, stay));
  const nightly = (c: ListingCardData) => c.price.nightlyCents;
  if (minPriceCents !== undefined) cards = cards.filter((c) => nightly(c) >= minPriceCents);
  if (maxPriceCents !== undefined) cards = cards.filter((c) => nightly(c) <= maxPriceCents);
  if (byPrice) cards = [...cards].sort((a, b) => (f.sort === "price_asc" ? nightly(a) - nightly(b) : nightly(b) - nightly(a)));
  return cards.slice(0, 60);
}

/** Every published listing in one place (destination and complex pages), as cards. */
export async function listingCardsWhere(where: Prisma.ListingWhereInput, take = 60): Promise<ListingCardData[]> {
  await connection();
  const today = todayIn();
  const rows = await db.listing.findMany({ where: { AND: [{ status: "PUBLISHED" }, where] }, select: cardSelect(today), orderBy: [{ featured: "desc" }, { publishedAt: "desc" }, { id: "asc" }], take });
  return rows.map((r) => toCard(r, today));
}
