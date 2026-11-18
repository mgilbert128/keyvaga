/**
 * Pure mapping from Hospitable Public API (v2) data to Keyvaga fields. No network, so it's unit-tested.
 * Field names follow Hospitable's snake_case JSON; anything missing falls back to a safe default.
 */
import { addDays } from "./dates";
import { formatRegion, formatTown, stateCode } from "./place";

export type HProperty = {
  id: string;
  name?: string;
  public_name?: string;
  description?: string;
  summary?: string;
  property_type?: string;
  timezone?: string;
  check_in?: string;
  check_out?: string;
  currency?: string;
  amenities?: string[];
  address?: { number?: string; street?: string; city?: string; state?: string; postcode?: string; country?: string; coordinates?: { latitude?: number; longitude?: number } };
  capacity?: { max?: number; bedrooms?: number; beds?: number; bathrooms?: number };
  house_rules?: { pets_allowed?: boolean; smoking_allowed?: boolean; events_allowed?: boolean };
};

export type HCalendarDay = {
  date: string;
  min_stay?: number;
  status?: { available?: boolean; reason?: string };
  price?: { amount?: number; currency?: string };
};

const TYPES: Record<string, "HOUSE" | "APARTMENT" | "CABIN" | "CONDO" | "VILLA"> = {
  house: "HOUSE", home: "HOUSE", townhouse: "HOUSE", cottage: "HOUSE", bungalow: "HOUSE",
  apartment: "APARTMENT", flat: "APARTMENT", loft: "APARTMENT",
  cabin: "CABIN", chalet: "CABIN", lodge: "CABIN",
  condo: "CONDO", condominium: "CONDO",
  villa: "VILLA",
};

export function mapPropertyType(t: string | undefined): "HOUSE" | "APARTMENT" | "CABIN" | "CONDO" | "VILLA" | "OTHER" {
  const k = (t ?? "").toLowerCase();
  for (const [word, type] of Object.entries(TYPES)) if (k.includes(word)) return type;
  return "OTHER";
}

/** Keyvaga amenity keys found in Hospitable's amenity strings (matched by keyword). */
const AMENITY_WORDS: [string, RegExp][] = [
  ["wifi", /wi-?fi|wireless|internet/i], ["kitchen", /kitchen/i], ["washer", /washer|washing machine/i], ["dryer", /dryer/i],
  ["air_conditioning", /air.?condition|\bac\b/i], ["heating", /heating|heater/i], ["workspace", /workspace|desk/i], ["tv", /\btv\b|television/i],
  ["pool", /pool/i], ["hot_tub", /hot.?tub|jacuzzi|spa\b/i], ["patio", /patio|deck|balcony/i], ["bbq", /bbq|grill|barbecue/i],
  ["fire_pit", /fire.?pit/i], ["waterfront", /waterfront|lake.?front|ocean.?front/i], ["beach_access", /beach/i],
  ["free_parking", /parking/i], ["ev_charger", /ev.?charg/i], ["self_check_in", /self.?check|keypad|smart.?lock|lockbox/i],
  ["crib", /crib/i], ["high_chair", /high.?chair/i], ["smoke_alarm", /smoke.?(alarm|detector)/i], ["co_alarm", /carbon|\bco\b.?(alarm|detector)/i],
  ["first_aid", /first.?aid/i], ["fire_extinguisher", /extinguisher/i],
];

export function mapAmenities(list: string[] | undefined, petsAllowed?: boolean): string[] {
  const text = (list ?? []).map((a) => a.replace(/_/g, " "));
  const keys = AMENITY_WORDS.filter(([, re]) => text.some((a) => re.test(a))).map(([k]) => k);
  if (petsAllowed) keys.push("pets_allowed");
  return [...new Set(keys)];
}

const hhmm = (t: string | undefined, fallback: string) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(t ?? "");
  return m ? `${m[1]!.padStart(2, "0")}:${m[2]}` : fallback;
};

/** Listing fields for a new Keyvaga listing created from a Hospitable property. */
export function listingFromProperty(p: HProperty) {
  const a = p.address ?? {};
  const description = (p.description ?? "").trim();
  const summary = ((p.summary ?? "").trim() || description.split(/\n+/)[0] || "").slice(0, 300);
  const region = a.state ? (stateCode(a.state) ?? formatRegion(a.state)) : "";
  return {
    title: (p.public_name || p.name || "Hospitable property").trim().slice(0, 80),
    summary,
    description: description.slice(0, 10_000),
    propertyType: mapPropertyType(p.property_type),
    city: a.city ? formatTown(a.city) : "",
    region,
    country: (a.country ?? "US").slice(0, 2).toUpperCase() || "US",
    addressLine1: [a.number, a.street].filter(Boolean).join(" ").trim(),
    postalCode: a.postcode ?? "",
    latitude: typeof a.coordinates?.latitude === "number" ? a.coordinates.latitude : null,
    longitude: typeof a.coordinates?.longitude === "number" ? a.coordinates.longitude : null,
    bedrooms: Math.max(0, Math.round(p.capacity?.bedrooms ?? 1)),
    bathrooms: String(Math.max(0, Math.round((p.capacity?.bathrooms ?? 1) * 2) / 2)),
    maxGuests: Math.max(1, Math.round(p.capacity?.max ?? 2)),
    amenities: mapAmenities(p.amenities, p.house_rules?.pets_allowed),
    checkInTime: hhmm(p.check_in, "16:00"),
    checkOutTime: hhmm(p.check_out, "10:00"),
    timeZone: p.timezone && /^[A-Za-z_]+\/[A-Za-z_]+/.test(p.timezone) ? p.timezone : "America/Chicago",
  };
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const parseDay = (s: string) => new Date(`${s.slice(0, 10)}T00:00:00Z`);

/**
 * From Hospitable calendar days: nightly prices (cents) for every day with a price, and merged
 * [start, end) ranges of unavailable days (bookings from other channels and owner blocks).
 */
export function calendarToKeyvaga(days: HCalendarDay[]) {
  const rates: { date: Date; rateCents: number }[] = [];
  const blocked: { start: Date; end: Date }[] = [];
  const sorted = [...days].filter((d) => /^\d{4}-\d{2}-\d{2}/.test(d.date)).sort((a, b) => a.date.localeCompare(b.date));
  for (const d of sorted) {
    const date = parseDay(d.date);
    const amount = d.price?.amount;
    if (typeof amount === "number" && amount > 0) rates.push({ date, rateCents: Math.round(amount) });
    if (d.status?.available === false) {
      const last = blocked.at(-1);
      if (last && iso(last.end) === iso(date)) last.end = addDays(date, 1);
      else blocked.push({ start: date, end: addDays(date, 1) });
    }
  }
  return { rates, blocked };
}

/** A sensible base nightly rate: the median price of the next 60 priced days. */
export function medianRate(rates: { rateCents: number }[]): number {
  const v = rates.slice(0, 60).map((r) => r.rateCents).sort((a, b) => a - b);
  if (!v.length) return 0;
  return v[Math.floor(v.length / 2)]!;
}

/** Dates (YYYY-MM-DD) of each night of a stay, for blocking it on the Hospitable calendar. */
export function stayNights(checkIn: Date, checkOut: Date): string[] {
  const out: string[] = [];
  for (let d = checkIn; d < checkOut; d = addDays(d, 1)) out.push(iso(d));
  return out;
}
