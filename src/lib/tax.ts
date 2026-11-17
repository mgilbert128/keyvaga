import "server-only";
import { db } from "@/lib/db";
import { stateCode } from "@/lib/place";
import { computeTaxes, ratesForPlace, type TaxResult } from "@/lib/tax-calc";

/** Active admin-entered rates that apply to a listing's town and state. */
export async function taxRatesFor(place: { city: string; region: string }) {
  const code = stateCode(place.region);
  if (!code) return [];
  const rates = await db.taxRate.findMany({ where: { active: true, state: code }, orderBy: [{ city: "asc" }, { name: "asc" }] });
  return ratesForPlace(rates, place);
}

/** Lodging taxes for a stay at this listing on the given subtotal (nights + cleaning). */
export async function taxesFor(place: { city: string; region: string }, subtotalCents: number): Promise<TaxResult> {
  return computeTaxes(subtotalCents, await taxRatesFor(place));
}
