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
  /** Custom prices for specific nights (from the owner calendar). */
  dateRates?: { date: Date; rateCents: number }[];
  /** Percent-off discounts for date ranges (from the owner calendar). */
  discounts?: DiscountInput[];
};

export type DiscountInput = { name: string; startDate: Date; endDate: Date; percentBps: number };

/** The discount for one night (the largest, if several overlap), or undefined. */
export function discountForNight(listing: Pick<PriceInputs, "discounts">, date: Date): DiscountInput | undefined {
  let best: DiscountInput | undefined;
  for (const d of listing.discounts ?? []) if (date >= d.startDate && date < d.endDate && (!best || d.percentBps > best.percentBps)) best = d;
  return best;
}

export const pctLabel = (bps: number) => `${bps % 100 === 0 ? bps / 100 : (bps / 100).toFixed(1)}%`;

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
      perNight: { date: Date; rateCents: number; source: RateSource }[];
    }
  | { ok: false; reason: "invalid_dates" | "below_min_nights"; minNights?: number };

export type RateSource = "base" | "weekend" | "season" | "custom";

/**
 * Rate for one night (the night starting on `date`). Priority: a custom price set on the calendar
 * for that exact night, then a seasonal rate, then the weekend rate (Friday/Saturday), then the base rate.
 */
export function rateForNight(listing: PriceInputs, date: Date): { rateCents: number; source: RateSource } {
  const custom = listing.dateRates?.find((r) => +r.date === +date);
  if (custom) return { rateCents: custom.rateCents, source: "custom" };
  const season = listing.seasons?.find((s) => date >= s.startDate && date < s.endDate);
  if (season) return { rateCents: season.nightlyRateCents, source: "season" };
  const dow = date.getUTCDay(); // 5 = Friday, 6 = Saturday
  if ((dow === 5 || dow === 6) && listing.weekendRateCents) return { rateCents: listing.weekendRateCents, source: "weekend" };
  return { rateCents: listing.nightlyRateCents, source: "base" };
}

/**
 * Price for a stay before Keyvaga's fees. Discounts apply to the nights only, not the cleaning fee, and never stack:
 * the guest gets whichever is bigger of the weekly (7+ nights) or monthly (28+ nights) discount, or the owner's
 * date discounts (each discounted night's percentage, added up).
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
  const lengthCents = Math.round((nightsCents * bps) / 10_000);
  const used = new Map<string, number>();
  let dateCents = 0;
  for (const n of perNight) {
    const d = discountForNight(listing, n.date);
    if (!d) continue;
    dateCents += Math.round((n.rateCents * d.percentBps) / 10_000);
    used.set(d.name, d.percentBps);
  }
  const useDates = dateCents > 0 && dateCents >= lengthCents;
  const discountCents = useDates ? dateCents : lengthCents;
  const only: [string, number] | undefined = used.size === 1 ? [...used][0] : undefined;
  const discountLabel = useDates
    ? only ? `${only[0]} (${pctLabel(only[1])} off)` : "Special discounts"
    : bps === 0 ? null : `${monthly >= weekly ? "Monthly" : "Weekly"} discount (${bps / 100}%)`;
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

/**
 * Lowest nightly rate over the next `days` nights starting at `from` (seasonal, weekend and custom
 * per-date prices included). Shown on cards as "From $X / night" when the guest hasn't picked dates.
 */
export function lowestRateCents(listing: PriceInputs, from: Date, days = 365): number {
  const custom = new Map((listing.dateRates ?? []).map((r) => [+r.date, r.rateCents]));
  const fast: PriceInputs = { ...listing, dateRates: undefined };
  let min = Infinity;
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    const rate = custom.get(+date) ?? rateForNight(fast, date).rateCents;
    if (rate > 0 && rate < min) min = rate;
  }
  return Number.isFinite(min) ? min : listing.nightlyRateCents;
}

/**
 * Typical nightly rate: the middle (median) price over the next `days` nights. Shown on cards and listing pages
 * before the guest picks dates, so one discounted night doesn't become the headline price.
 */
export function typicalRateCents(listing: PriceInputs, from: Date, days = 90): number {
  const custom = new Map((listing.dateRates ?? []).map((r) => [+r.date, r.rateCents]));
  const fast: PriceInputs = { ...listing, dateRates: undefined };
  const rates: number[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    const rate = custom.get(+date) ?? rateForNight(fast, date).rateCents;
    if (rate > 0) rates.push(rate);
  }
  if (!rates.length) return listing.nightlyRateCents;
  rates.sort((a, b) => a - b);
  const mid = Math.floor(rates.length / 2);
  return rates.length % 2 ? rates[mid]! : Math.round((rates[mid - 1]! + rates[mid]!) / 2);
}
