/** Sites owners can show a verified rating from. Only links on these domains are accepted. */
export const PLATFORMS = {
  AIRBNB: { label: "Airbnb", hosts: ["airbnb.com"], scale: 5 },
  VRBO: { label: "Vrbo", hosts: ["vrbo.com", "homeaway.com"], scale: 5 },
  BOOKING: { label: "Booking.com", hosts: ["booking.com"], scale: 10 },
  GOOGLE: { label: "Google", hosts: ["google.com", "goo.gl", "g.page"], scale: 5 },
} as const;
export type Platform = keyof typeof PLATFORMS;
export const PLATFORM_KEYS = Object.keys(PLATFORMS) as Platform[];
export const isPlatform = (v: string): v is Platform => v in PLATFORMS;

/** A verified rating shows for 6 months, then the owner re-confirms it. */
export const RATING_VALID_DAYS = 180;

export function urlMatchesPlatform(raw: string, platform: Platform): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    return PLATFORMS[platform].hosts.some((h) => host === h || host.endsWith(`.${h}`) || host.startsWith(`${h.split(".")[0]}.`));
  } catch {
    return false;
  }
}

export type ShownRating = { platform: string; label: string; rating: number; scale: number; reviewCount: number; verifiedAt: Date };

/** Approved, still-current ratings, most reviews first. */
export function shownRatings(rows: { platform: string; rating: number; reviewCount: number; status: string; verifiedAt: Date | null }[], now = new Date()): ShownRating[] {
  const cutoff = now.getTime() - RATING_VALID_DAYS * 86_400_000;
  return rows
    .filter((r) => r.status === "APPROVED" && r.verifiedAt && r.verifiedAt.getTime() >= cutoff && isPlatform(r.platform))
    .map((r) => ({ platform: r.platform, label: PLATFORMS[r.platform as Platform].label, rating: r.rating, scale: PLATFORMS[r.platform as Platform].scale, reviewCount: r.reviewCount, verifiedAt: r.verifiedAt! }))
    .sort((a, b) => b.reviewCount - a.reviewCount);
}
