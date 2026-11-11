import { nightsBetween } from "./dates";

/** "$1,234.50" / "1234.5" / "185" -> cents. Returns null for anything that is not a valid amount. */
export function dollarsToCents(input: string): number | null {
  const cleaned = input.trim().replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

export function centsToDollarsInput(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

export type PriceInputs = { nightlyRateCents: number; cleaningFeeCents: number; minNights: number };

export type StayQuote =
  | { ok: true; nights: number; nightlyRateCents: number; nightsCents: number; cleaningCents: number; totalCents: number }
  | { ok: false; reason: "invalid_dates" | "below_min_nights"; minNights?: number };

/**
 * Price for a stay before platform fees and taxes (the commission model is still an open decision,
 * so checkout will add those in Phase 3).
 */
export function quoteStay(listing: PriceInputs, checkIn: Date, checkOut: Date): StayQuote {
  const nights = nightsBetween(checkIn, checkOut);
  if (!Number.isFinite(nights) || nights < 1) return { ok: false, reason: "invalid_dates" };
  if (nights < listing.minNights) return { ok: false, reason: "below_min_nights", minNights: listing.minNights };
  const nightsCents = nights * listing.nightlyRateCents;
  return {
    ok: true,
    nights,
    nightlyRateCents: listing.nightlyRateCents,
    nightsCents,
    cleaningCents: listing.cleaningFeeCents,
    totalCents: nightsCents + listing.cleaningFeeCents,
  };
}
