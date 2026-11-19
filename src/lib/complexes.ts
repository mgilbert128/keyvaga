import "server-only";
import { db } from "@/lib/db";
import { slugify } from "@/lib/slug";

export const complexSlug = (name: string, city: string, region: string) => slugify(`${name} ${city} ${region}`);

/** Tidies an owner-typed building name: trims, collapses spaces, keeps their capitalization unless it's all one case. */
export function tidyComplexName(raw: string): string {
  const s = raw.trim().replace(/\s+/g, " ").slice(0, 80);
  if (s !== s.toLowerCase() && s !== s.toUpperCase()) return s;
  return s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

/** The complex for a listing's building name (created the first time anyone names it). Empty name → none. */
export async function complexIdFor(name: string, city: string, region: string): Promise<string | null> {
  const clean = tidyComplexName(name);
  if (!clean || !city || !region) return null;
  const slug = complexSlug(clean, city, region);
  const c = await db.complex.upsert({ where: { slug }, create: { slug, name: clean, city, region }, update: {}, select: { id: true } });
  return c.id;
}

/** Building names already used in a town, for the owner form's suggestions. */
export async function complexNamesIn(city: string, region: string): Promise<string[]> {
  if (!city) return [];
  const rows = await db.complex.findMany({ where: { city: { equals: city, mode: "insensitive" }, region: { equals: region, mode: "insensitive" } }, select: { name: true }, orderBy: { name: "asc" }, take: 200 });
  return rows.map((r) => r.name);
}
