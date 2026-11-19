import "server-only";
import { siteUrl } from "@/lib/site";

/**
 * Approximate coordinates for a listing's map, from its postal code, town and state only (never the street),
 * using OpenStreetMap's free Nominatim service. Rounded to 2 decimals (about 1 km) so the exact home stays private.
 * Returns null if nothing is found or the service is unreachable; the map is simply hidden then.
 */
export async function approximateLocation(place: { postalCode?: string; city: string; region: string }): Promise<{ latitude: number; longitude: number } | null> {
  if (!place.city || !place.region) return null;
  const params = new URLSearchParams({ format: "json", limit: "1", countrycodes: "us", city: place.city, state: place.region });
  if (place.postalCode) params.set("postalcode", place.postalCode);
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { "User-Agent": `Keyvaga/1.0 (${siteUrl()})`, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    let rows = (await res.json()) as { lat?: string; lon?: string }[];
    if (!rows.length && place.postalCode) {
      // A mistyped ZIP shouldn't lose the map: try town and state alone.
      const r2 = await fetch(`https://nominatim.openstreetmap.org/search?${new URLSearchParams({ format: "json", limit: "1", countrycodes: "us", city: place.city, state: place.region })}`, {
        headers: { "User-Agent": `Keyvaga/1.0 (${siteUrl()})`, Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      rows = r2.ok ? ((await r2.json()) as { lat?: string; lon?: string }[]) : [];
    }
    const lat = Number(rows[0]?.lat);
    const lon = Number(rows[0]?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { latitude: Math.round(lat * 100) / 100, longitude: Math.round(lon * 100) / 100 };
  } catch {
    return null;
  }
}
