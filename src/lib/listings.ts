import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export type ListingCardData = {
  id: string;
  slug: string;
  title: string;
  city: string;
  region: string;
  maxGuests: number;
  bedrooms: number;
  nightlyRateCents: number;
  coverUrl: string | null;
  coverAlt: string;
};

const cardSelect = {
  id: true,
  slug: true,
  title: true,
  city: true,
  region: true,
  maxGuests: true,
  bedrooms: true,
  nightlyRateCents: true,
  photos: { orderBy: { position: "asc" }, take: 1, select: { url: true, alt: true } },
} satisfies Prisma.ListingSelect;

type CardRow = Prisma.ListingGetPayload<{ select: typeof cardSelect }>;

function toCard({ photos, ...l }: CardRow): ListingCardData {
  return { ...l, coverUrl: photos[0]?.url ?? null, coverAlt: photos[0]?.alt || l.title };
}

export async function getFeaturedListings(): Promise<ListingCardData[]> {
  const rows = await db.listing.findMany({
    where: { status: "PUBLISHED" },
    select: cardSelect,
    orderBy: [{ featured: "desc" }, { publishedAt: "desc" }, { createdAt: "asc" }],
    take: 6,
  });
  return rows.map(toCard);
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
  if (f.where) {
    and.push({
      OR: [
        { city: { contains: f.where, mode: "insensitive" } },
        { region: { contains: f.where, mode: "insensitive" } },
        { title: { contains: f.where, mode: "insensitive" } },
      ],
    });
  }
  if (f.checkIn && f.checkOut && f.checkOut > f.checkIn) {
    const { checkIn, checkOut } = f;
    and.push({
      bookings: { none: { status: { in: ["PENDING_PAYMENT", "CONFIRMED"] }, checkIn: { lt: checkOut }, checkOut: { gt: checkIn } } },
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

export async function searchListings(f: SearchFilters): Promise<ListingCardData[]> {
  const rows = await db.listing.findMany({
    where: buildSearchWhere(f),
    select: cardSelect,
    orderBy: [...ORDER[f.sort ?? "recommended"], { id: "asc" }],
    take: 60,
  });
  return rows.map(toCard);
}
