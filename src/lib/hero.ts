import "server-only";
import { db } from "@/lib/db";

export type HeroSlide = { src: string; alt: string; title: string; place: string; href: string | null };

/**
 * Curated hero photography. Add licensed photos to /public/hero and list them here
 * (they show first, before photos from live listings). Keep them ~2400px wide, JPEG/WebP, under 500 KB.
 */
const CURATED: HeroSlide[] = [];

/** Photos for the homepage hero: curated ones, then real photos from published listings (max 2 per listing). */
export async function getHeroSlides(limit = 6): Promise<HeroSlide[]> {
  const listings = await db.listing.findMany({
    where: { status: "PUBLISHED", photos: { some: {} } },
    orderBy: [{ featured: "desc" }, { publishedAt: "desc" }],
    take: 6,
    select: { slug: true, title: true, city: true, region: true, photos: { orderBy: { position: "asc" }, take: 2, select: { url: true, alt: true } } },
  });
  // Round-robin so consecutive slides show different homes: first photo of each, then second photos.
  const fromListings: HeroSlide[] = [];
  for (let i = 0; i < 2; i++) {
    for (const l of listings) {
      const p = l.photos[i];
      if (p) fromListings.push({ src: p.url, alt: p.alt || l.title, title: l.title, place: `${l.city}, ${l.region}`, href: `/stays/${l.slug}` });
    }
  }
  return [...CURATED, ...fromListings].slice(0, limit);
}
