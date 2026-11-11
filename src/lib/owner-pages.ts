import "server-only";
import { db } from "@/lib/db";

/** The owner's listings (for pickers) and the selected one, defaulting to the first. */
export async function ownerListingsWithSelection(ownerId: string, requested?: string) {
  const listings = await db.listing.findMany({ where: { ownerId }, orderBy: { createdAt: "asc" }, select: { id: true, title: true } });
  const current = listings.find((l) => l.id === requested) ?? listings[0] ?? null;
  return { listings, current };
}
