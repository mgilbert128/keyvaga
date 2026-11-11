import "server-only";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth/dal";
import { canEditListing } from "@/lib/listing-policy";

/**
 * Loads a listing only if the current user owns it. Anyone else gets a 404,
 * so the response doesn't reveal that the listing exists.
 */
export async function getOwnedListing(user: CurrentUser, id: string) {
  const listing = await db.listing.findUnique({
    where: { id },
    include: { photos: { orderBy: { position: "asc" } } },
  });
  if (!listing || !canEditListing(user, listing)) notFound();
  return listing;
}
