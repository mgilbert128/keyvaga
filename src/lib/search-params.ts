import type { PropertyType } from "@/generated/prisma/enums";
import { parseISODate } from "@/lib/dates";
import { isAmenityKey } from "@/lib/amenities";
import { SORTS, type SearchFilters, type SortKey } from "@/lib/listings-types";

type Raw = Record<string, string | string[] | undefined>;

const TYPES = new Set(["HOUSE", "APARTMENT", "CABIN", "CONDO", "VILLA", "OTHER"]);

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
const all = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []).flatMap((s) => s.split(",")).map((s) => s.trim()).filter(Boolean);
const intIn = (v: string | undefined, min: number, max: number) => {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
};

/** Turns untrusted URL query params into safe, typed search filters. */
export function parseSearchParams(sp: Raw): SearchFilters & { raw: Record<string, string | undefined> } {
  const where = first(sp.where)?.slice(0, 80);
  const checkIn = parseISODate(first(sp.checkIn)) ?? undefined;
  const checkOut = parseISODate(first(sp.checkOut)) ?? undefined;
  const minPrice = intIn(first(sp.minPrice), 0, 100_000);
  const maxPrice = intIn(first(sp.maxPrice), 0, 100_000);
  const sortRaw = first(sp.sort);
  const sort = sortRaw && sortRaw in SORTS ? (sortRaw as SortKey) : undefined;
  return {
    where,
    checkIn,
    checkOut,
    guests: intIn(first(sp.guests), 1, 50),
    bedrooms: intIn(first(sp.bedrooms), 1, 50),
    minPriceCents: minPrice !== undefined ? minPrice * 100 : undefined,
    maxPriceCents: maxPrice !== undefined ? maxPrice * 100 : undefined,
    types: all(sp.type).filter((t) => TYPES.has(t)) as PropertyType[],
    amenities: all(sp.amenity).filter(isAmenityKey),
    sort,
    raw: {
      where,
      checkIn: first(sp.checkIn),
      checkOut: first(sp.checkOut),
      guests: first(sp.guests),
      minPrice: minPrice?.toString(),
      maxPrice: maxPrice?.toString(),
      bedrooms: first(sp.bedrooms),
      sort,
    },
  };
}
