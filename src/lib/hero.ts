import "server-only";
import { db } from "@/lib/db";

/** `position`: CSS object-position, to choose which part of the photo stays in view when it is cropped. */
export type HeroSlide = { src: string; alt: string; title: string; place: string; href: string | null; position?: string };

/**
 * Curated hero photography. Add licensed photos to /public/hero and list them here
 * (they show first, before photos from live listings). Keep them ~2400px wide, JPEG/WebP, under 500 KB.
 */
const CURATED: HeroSlide[] = [
  { src: "/hero/boardwalk.webp", alt: "Wooden boardwalk leading over the dunes to a sunny white-sand beach", title: "Coastal escapes", place: "White-sand beaches and blue water", href: "/search" },
];

/** The main curated photo, if one is set (no database needed, so it can render instantly). */
export function curatedHero(): HeroSlide | null {
  return CURATED[0] ?? null;
}

/**
 * The homepage hero shows one main photo: the first curated photo, or, if none is set, a photo from a published listing.
 * (getHeroSlides can return more for a rotating hero; the homepage asks for one.)
 */
export async function getHeroSlides(limit = 1): Promise<HeroSlide[]> {
  if (CURATED.length >= limit) return CURATED.slice(0, limit);
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
