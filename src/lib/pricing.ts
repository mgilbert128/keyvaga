import { addDays, nightsBetween } from "./dates";

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

export type SeasonInput = { name: string; startDate: Date; endDate: Date; nightlyRateCents: number };

export type PriceInputs = {
  nightlyRateCents: number;
  cleaningFeeCents: number;
  minNights: number;
  /** Friday and Saturday nights; null/undefined = base rate. */
  weekendRateCents?: number | null;
  weeklyDiscountBps?: number;
  monthlyDiscountBps?: number;
  seasons?: SeasonInput[];
};

export const WEEKLY_NIGHTS = 7;
export const MONTHLY_NIGHTS = 28;

export type StayQuote =
  | {
      ok: true;
      nights: number;
      /** Average rate across the stay (for "$X × N nights"). */
      nightlyRateCents: number;
      /** Sum of the nightly rates before any discount. */
      nightsCents: number;
      discountCents: number;
      discountLabel: string | null;
      cleaningCents: number;
      /** nights - discount + cleaning: the owner's price, before Keyvaga's fees. */
      totalCents: number;
      /** Rate charged for each night, in order. */
      perNight: { date: Date; rateCents: number; source: "base" | "weekend" | "season" }[];
    }
  | { ok: false; reason: "invalid_dates" | "below_min_nights"; minNights?: number };

/**
 * Rate for one night (the night starting on `date`). A seasonal rate wins; otherwise Friday
 * and Saturday nights use the weekend rate; otherwise the base rate.
 */
export function rateForNight(listing: PriceInputs, date: Date): { rateCents: number; source: "base" | "weekend" | "season" } {
  const season = listing.seasons?.find((s) => date >= s.startDate && date < s.endDate);
  if (season) return { rateCents: season.nightlyRateCents, source: "season" };
  const dow = date.getUTCDay(); // 5 = Friday, 6 = Saturday
  if ((dow === 5 || dow === 6) && listing.weekendRateCents) return { rateCents: listing.weekendRateCents, source: "weekend" };
  return { rateCents: listing.nightlyRateCents, source: "base" };
}

/**
 * Price for a stay before Keyvaga's fees. Weekly (7+ nights) and monthly (28+ nights) discounts
 * apply to the nights only, not the cleaning fee; the larger one applies, never both.
 */
export function quoteStay(listing: PriceInputs, checkIn: Date, checkOut: Date): StayQuote {
  const nights = nightsBetween(checkIn, checkOut);
  if (!Number.isFinite(nights) || nights < 1) return { ok: false, reason: "invalid_dates" };
  if (nights < listing.minNights) return { ok: false, reason: "below_min_nights", minNights: listing.minNights };
  const perNight = Array.from({ length: nights }, (_, i) => {
    const date = addDays(checkIn, i);
    return { date, ...rateForNight(listing, date) };
  });
  const nightsCents = perNight.reduce((s, n) => s + n.rateCents, 0);
  const monthly = nights >= MONTHLY_NIGHTS ? (listing.monthlyDiscountBps ?? 0) : 0;
  const weekly = nights >= WEEKLY_NIGHTS ? (listing.weeklyDiscountBps ?? 0) : 0;
  const bps = Math.max(monthly, weekly);
  const discountCents = Math.round((nightsCents * bps) / 10_000);
  const discountLabel = bps === 0 ? null : `${monthly >= weekly ? "Monthly" : "Weekly"} discount (${bps / 100}%)`;
  return {
    ok: true,
    nights,
    nightlyRateCents: Math.round(nightsCents / nights),
    nightsCents,
    discountCents,
    discountLabel,
    cleaningCents: listing.cleaningFeeCents,
    totalCents: nightsCents - discountCents + listing.cleaningFeeCents,
    perNight,
  };
}
