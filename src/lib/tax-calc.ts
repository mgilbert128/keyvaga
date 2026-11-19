/**
 * Lodging tax math (no database, so it's unit-tested). Rates are entered by an admin on /admin/taxes.
 * Taxes are charged on the booking subtotal: nights (after discounts) + cleaning fee. Keyvaga's service
 * fee is not taxed. Each rate is either filed by Keyvaga (kept on the platform for remittance) or by the
 * owner (passed through to the owner with their payout).
 */
import { stateCode } from "./place";

export type TaxFiler = "KEYVAGA" | "OWNER";
export type TaxRateInput = { name: string; ratePpm: number; filedBy: TaxFiler; state: string; city: string };
export type TaxLine = TaxRateInput & { cents: number };
export type TaxResult = { lines: TaxLine[]; taxCents: number; keyvagaTaxCents: number; ownerTaxCents: number };

export const NO_TAX: TaxResult = { lines: [], taxCents: 0, keyvagaTaxCents: 0, ownerTaxCents: 0 };

/** Rates that apply to a listing: same state, and either state-wide or the listing's town. */
export function ratesForPlace<R extends Pick<TaxRateInput, "state" | "city">>(rates: R[], place: { city: string; region: string }): R[] {
  const code = stateCode(place.region);
  if (!code) return [];
  const town = place.city.trim().toLowerCase();
  return rates.filter((r) => r.state.toUpperCase() === code && (r.city.trim() === "" || r.city.trim().toLowerCase() === town));
}

export function computeTaxes(subtotalCents: number, rates: TaxRateInput[]): TaxResult {
  if (subtotalCents <= 0 || rates.length === 0) return NO_TAX;
  const lines = rates
    .filter((r) => r.ratePpm > 0)
    .map((r) => ({ ...r, cents: Math.round((subtotalCents * r.ratePpm) / 1_000_000) }));
  const sum = (f: TaxFiler) => lines.filter((l) => l.filedBy === f).reduce((s, l) => s + l.cents, 0);
  const keyvagaTaxCents = sum("KEYVAGA");
  const ownerTaxCents = sum("OWNER");
  return { lines, taxCents: keyvagaTaxCents + ownerTaxCents, keyvagaTaxCents, ownerTaxCents };
}

/** "4.5%" style label for a rate. */
export function formatRate(ratePpm: number): string {
  return `${(ratePpm / 10_000).toFixed(4).replace(/\.?0+$/, "")}%`;
}

/** Parses "4.5", "4.5%" or "0.25" (percent) into parts per million; null if invalid or above 30%. */
export function parseRatePercent(input: string): number | null {
  const v = Number(input.trim().replace(/%$/, ""));
  if (!Number.isFinite(v) || v < 0 || v > 30) return null;
  return Math.round(v * 10_000);
}

/** Reads a booking's stored tax snapshot (JSON) back into lines; ignores anything malformed. */
export function parseTaxLines(json: unknown): TaxLine[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((l) => {
    if (!l || typeof l !== "object") return [];
    const r = l as Record<string, unknown>;
    if (typeof r.name !== "string" || typeof r.cents !== "number") return [];
    return [{
      name: r.name,
      cents: r.cents,
      ratePpm: typeof r.ratePpm === "number" ? r.ratePpm : 0,
      filedBy: r.filedBy === "OWNER" ? ("OWNER" as const) : ("KEYVAGA" as const),
      state: typeof r.state === "string" ? r.state : "",
      city: typeof r.city === "string" ? r.city : "",
    }];
  });
}

export type TaxReportBooking = {
  status: string;
  nightlyCents: number;
  cleaningCents: number;
  petFeeCents?: number;
  taxCents: number;
  taxRetainedCents: number | null;
  taxLines: unknown;
};
export type TaxReportRow = { name: string; filedBy: TaxFiler; state: string; city: string; ratePpm: number; stays: number; taxableCents: number; taxCents: number };

/**
 * Monthly report: tax collected per rate. Confirmed/completed stays count in full; a cancelled stay counts
 * only for the tax kept under the cancellation policy (scaled down per line); refunded tax isn't owed.
 */
export function buildTaxReport(bookings: TaxReportBooking[]): TaxReportRow[] {
  const rows = new Map<string, TaxReportRow>();
  for (const b of bookings) {
    const lines = parseTaxLines(b.taxLines);
    if (lines.length === 0 || b.taxCents <= 0) continue;
    const factor = b.status === "CANCELLED" ? Math.max(0, Math.min(1, (b.taxRetainedCents ?? 0) / b.taxCents)) : b.status === "CONFIRMED" || b.status === "COMPLETED" ? 1 : 0;
    if (factor === 0) continue;
    const taxable = Math.round((b.nightlyCents + b.cleaningCents + (b.petFeeCents ?? 0)) * factor);
    for (const l of lines) {
      const key = `${l.filedBy}|${l.state}|${l.city}|${l.name}|${l.ratePpm}`;
      const row = rows.get(key) ?? { name: l.name, filedBy: l.filedBy, state: l.state, city: l.city, ratePpm: l.ratePpm, stays: 0, taxableCents: 0, taxCents: 0 };
      row.stays += 1;
      row.taxableCents += taxable;
      row.taxCents += Math.round(l.cents * factor);
      rows.set(key, row);
    }
  }
  return [...rows.values()].sort((a, b) => a.filedBy.localeCompare(b.filedBy) || a.state.localeCompare(b.state) || a.city.localeCompare(b.city) || a.name.localeCompare(b.name));
}
