import "server-only";
import { db } from "@/lib/db";

export type ListingCardData = {
  id: string;
  slug: string;
  title: string;
  city: string;
  region: string;
  maxGuests: number;
  nightlyRateCents: number;
};

const cardSelect = {
  id: true,
  slug: true,
  title: true,
  city: true,
  region: true,
  maxGuests: true,
  nightlyRateCents: true,
} as const;

export async function getFeaturedListings(): Promise<ListingCardData[]> {
  return db.listing.findMany({
    where: { status: "PUBLISHED", featured: true },
    select: cardSelect,
    orderBy: { createdAt: "asc" },
    take: 6,
  });
}

export type SearchParams = { where?: string; checkIn?: string; checkOut?: string; guests?: number };

export async function searchListings({ where, checkIn, checkOut, guests }: SearchParams): Promise<ListingCardData[]> {
  const hasDates = Boolean(checkIn && checkOut && checkOut > checkIn);
  return db.listing.findMany({
    where: {
      status: "PUBLISHED",
      ...(guests ? { maxGuests: { gte: guests } } : {}),
      ...(where
        ? {
            OR: [
              { city: { contains: where, mode: "insensitive" } },
              { region: { contains: where, mode: "insensitive" } },
              { title: { contains: where, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(hasDates
        ? {
            // Exclude listings with an active booking or block overlapping [checkIn, checkOut).
            bookings: {
              none: {
                status: { in: ["PENDING_PAYMENT", "CONFIRMED"] },
                checkIn: { lt: new Date(checkOut!) },
                checkOut: { gt: new Date(checkIn!) },
              },
            },
            calendarBlocks: {
              none: { startDate: { lt: new Date(checkOut!) }, endDate: { gt: new Date(checkIn!) } },
            },
          }
        : {}),
    },
    select: cardSelect,
    orderBy: [{ featured: "desc" }, { nightlyRateCents: "asc" }],
    take: 50,
  });
}
