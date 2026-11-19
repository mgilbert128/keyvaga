import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { listDestinations } from "@/lib/destinations";

const BASE = "https://www.keyvaga.com";

/** Public pages for search engines: home, marketing pages, destinations, buildings and every published stay. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [stays, complexes, destinations] = await Promise.all([
    db.listing.findMany({ where: { status: "PUBLISHED" }, select: { slug: true, updatedAt: true } }),
    db.complex.findMany({ where: { listings: { some: { status: "PUBLISHED" } } }, select: { slug: true } }),
    listDestinations(),
  ]);
  return [
    { url: BASE, changeFrequency: "daily", priority: 1 },
    ...["/search", "/destinations", "/list-your-property", "/services", "/integrations", "/help"].map((p) => ({ url: `${BASE}${p}`, changeFrequency: "weekly" as const })),
    ...destinations.map((d) => ({ url: `${BASE}/destinations/${d.slug}`, changeFrequency: "daily" as const, priority: 0.8 })),
    ...complexes.map((c) => ({ url: `${BASE}/complexes/${c.slug}`, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...stays.map((s) => ({ url: `${BASE}/stays/${s.slug}`, lastModified: s.updatedAt, changeFrequency: "daily" as const, priority: 0.9 })),
  ];
}
