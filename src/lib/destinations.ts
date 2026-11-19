import "server-only";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { slugify } from "@/lib/slug";
import { stateCode } from "@/lib/place";

export type Destination = { city: string; region: string; slug: string; count: number; label: string };

export const destinationSlug = (city: string, region: string) => slugify(`${city} ${stateCode(region) ?? region}`);

/** Towns with at least one published stay, busiest first. */
export async function listDestinations(): Promise<Destination[]> {
  await connection();
  const groups = await db.listing.groupBy({ by: ["city", "region"], where: { status: "PUBLISHED", city: { not: "" } }, _count: { _all: true } });
  // Merge spellings of the same town ("AL" vs "Alabama") under one slug.
  const bySlug = new Map<string, Destination>();
  for (const g of groups) {
    const slug = destinationSlug(g.city, g.region);
    const code = stateCode(g.region) ?? g.region;
    const prev = bySlug.get(slug);
    if (prev) prev.count += g._count._all;
    else bySlug.set(slug, { city: g.city, region: g.region, slug, count: g._count._all, label: `${g.city}, ${code}` });
  }
  return [...bySlug.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export async function findDestination(slug: string): Promise<Destination | null> {
  return (await listDestinations()).find((d) => d.slug === slug) ?? null;
}
