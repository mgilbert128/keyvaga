import "server-only";
import { db } from "@/lib/db";
import { addDays, todayIn } from "@/lib/dates";
import { openSecret, sealSecret } from "@/lib/secret-box";

/**
 * PriceLabs connection for any owner, using their own PriceLabs Customer API key
 * (PriceLabs → Account Settings → API Details). PriceLabs bills the owner $1/listing/month for API syncing.
 *
 * - Connect: the key is checked against PriceLabs, then stored encrypted. It's never shown again.
 * - Link: a Keyvaga listing is matched to one of the owner's PriceLabs listings.
 * - Sync in: PriceLabs nightly prices for the next year → DateRate (wins over base, weekend and seasonal prices).
 *   Hourly from the cron; PriceLabs itself recalculates about once a day. Availability is NOT taken from
 *   PriceLabs: calendars still come from calendar sync (iCal) or Hospitable.
 * A listing can follow Hospitable or PriceLabs for prices, not both.
 */
const BASE = "https://api.pricelabs.co/v1";
const HORIZON_DAYS = 365;

export class PriceLabsError extends Error {}

export type PLListing = { id: string; pms: string; name: string };

async function api<T>(apiKey: string, path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(BASE + path, {
    method: init.method ?? "GET",
    headers: { "X-API-Key": apiKey, Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
    // PriceLabs price calls can be slow.
    signal: AbortSignal.timeout(60_000),
    cache: "no-store",
  });
  if (res.status === 401 || res.status === 403) throw new PriceLabsError("PriceLabs didn't accept this API key. In PriceLabs, go to Account Settings → API Details, copy the key again, and reconnect.");
  if (res.status === 429) throw new PriceLabsError("PriceLabs is limiting requests right now. We'll try again shortly.");
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 200);
    throw new PriceLabsError(`PriceLabs returned an error (${res.status})${detail ? `: ${detail}` : ""}.`);
  }
  return (await res.json()) as T;
}

async function ownerKey(ownerId: string): Promise<string | null> {
  const c = await db.priceLabsConnection.findUnique({ where: { ownerId }, select: { apiKeyEnc: true } });
  if (!c) return null;
  try {
    return openSecret(c.apiKeyEnc);
  } catch {
    throw new PriceLabsError("Your saved PriceLabs key can't be read anymore. Please disconnect and connect PriceLabs again.");
  }
}

type MinimalListing = { listing_id?: string | number; pms_name?: string; listing_name?: string; property_name?: string };

async function fetchListings(apiKey: string): Promise<PLListing[]> {
  const r = await api<{ listings?: MinimalListing[] }>(apiKey, "/listings_minimal");
  return (r.listings ?? [])
    .filter((l) => l.listing_id != null && l.pms_name)
    .map((l) => ({ id: String(l.listing_id), pms: String(l.pms_name), name: (l.listing_name || l.property_name || `Listing ${l.listing_id}`).trim() }));
}

export async function connectPriceLabs(ownerId: string, rawKey: string) {
  const apiKey = rawKey.trim();
  if (apiKey.length < 10 || apiKey.length > 300 || /\s/.test(apiKey)) throw new PriceLabsError("That doesn't look like a PriceLabs API key. Copy it from PriceLabs → Account Settings → API Details.");
  await fetchListings(apiKey); // proves the key works before saving it
  const data = { apiKeyEnc: sealSecret(apiKey), keyLast4: apiKey.slice(-4) };
  await db.priceLabsConnection.upsert({ where: { ownerId }, create: { ownerId, ...data }, update: data });
}

/** Removes the key and unlinks every listing. Prices already copied stay until the owner changes them. */
export async function disconnectPriceLabs(ownerId: string) {
  await db.$transaction([
    db.listing.updateMany({ where: { ownerId }, data: { pricelabsListingId: null, pricelabsPms: null, pricelabsSyncedAt: null, pricelabsSyncError: null } }),
    db.priceLabsConnection.deleteMany({ where: { ownerId } }),
  ]);
}

export async function priceLabsOverview(ownerId: string) {
  const conn = await db.priceLabsConnection.findUnique({ where: { ownerId }, select: { keyLast4: true, createdAt: true } });
  if (!conn) return null;
  const apiKey = await ownerKey(ownerId);
  const remote = await fetchListings(apiKey!);
  const linked = await db.listing.findMany({
    where: { ownerId, deletedAt: null, pricelabsListingId: { not: null } },
    select: { id: true, title: true, pricelabsListingId: true, pricelabsPms: true, pricelabsSyncedAt: true, pricelabsSyncError: true },
  });
  const byRemote = new Map(linked.map((l) => [`${l.pricelabsPms}|${l.pricelabsListingId}`, l]));
  return { conn, listings: remote.map((r) => ({ ...r, listing: byRemote.get(`${r.pms}|${r.id}`) ?? null })) };
}

export async function linkPriceLabsListing(ownerId: string, listingId: string, plId: string, pms: string) {
  const l = await db.listing.findUnique({ where: { id: listingId }, select: { ownerId: true, deletedAt: true, hospitablePropertyId: true } });
  if (!l || l.ownerId !== ownerId || l.deletedAt) throw new PriceLabsError("Listing not found.");
  if (l.hospitablePropertyId) throw new PriceLabsError("That listing already gets its prices from Hospitable. If you use PriceLabs through Hospitable, your PriceLabs prices are already coming in. Unlink it from Hospitable first to connect PriceLabs directly.");
  const apiKey = await ownerKey(ownerId);
  if (!apiKey) throw new PriceLabsError("Connect your PriceLabs account first.");
  const remote = (await fetchListings(apiKey)).find((r) => r.id === plId && r.pms === pms);
  if (!remote) throw new PriceLabsError("That PriceLabs listing wasn't found in your account.");
  const taken = await db.listing.findFirst({ where: { ownerId, pricelabsListingId: plId, pricelabsPms: pms, NOT: { id: listingId } }, select: { id: true } });
  if (taken) throw new PriceLabsError("That PriceLabs listing is already linked to another Keyvaga listing.");
  await db.listing.update({ where: { id: listingId }, data: { pricelabsListingId: plId, pricelabsPms: pms, pricelabsSyncError: null } });
  const r = await syncPriceLabsListing(listingId);
  if (!r.ok) throw new PriceLabsError(`Linked, but the first sync didn't work: ${r.error}`);
}

export async function unlinkPriceLabsListing(ownerId: string, listingId: string) {
  const l = await db.listing.findUnique({ where: { id: listingId }, select: { ownerId: true } });
  if (!l || l.ownerId !== ownerId) throw new PriceLabsError("Listing not found.");
  await db.listing.update({ where: { id: listingId }, data: { pricelabsListingId: null, pricelabsPms: null, pricelabsSyncedAt: null, pricelabsSyncError: null } });
}

type PriceDay = { date?: string; price?: number | string; user_price?: number | string };
type PriceRow = { id?: string; pms?: string; currency?: string; error?: string; error_status?: string; data?: PriceDay[] };

const ERRORS: Record<string, string> = {
  LISTING_NOT_PRESENT: "This listing is no longer in your PriceLabs account.",
  LISTING_NO_DATA: "PriceLabs hasn't calculated prices for this listing yet. Open it in PriceLabs and click Save & Refresh.",
  LISTING_TOGGLE_OFF: "Sync is turned off for this listing in PriceLabs. Turn on sync in PriceLabs and we'll pick up the prices.",
};

/** Copies PriceLabs prices for the next year into Keyvaga. Keeps the current prices if PriceLabs can't be reached. */
export async function syncPriceLabsListing(listingId: string) {
  const l = await db.listing.findUnique({ where: { id: listingId }, select: { id: true, ownerId: true, timeZone: true, pricelabsListingId: true, pricelabsPms: true } });
  if (!l?.pricelabsListingId || !l.pricelabsPms) return { ok: false as const, error: "Not linked to PriceLabs." };
  const fail = async (error: string) => {
    await db.listing.update({ where: { id: l.id }, data: { pricelabsSyncedAt: new Date(), pricelabsSyncError: error } });
    return { ok: false as const, error };
  };
  try {
    const apiKey = await ownerKey(l.ownerId);
    if (!apiKey) return fail("PriceLabs isn't connected.");
    const today = todayIn(l.timeZone);
    const end = addDays(today, HORIZON_DAYS);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const rows = await api<PriceRow[]>(apiKey, "/listing_prices", {
      method: "POST",
      body: { listings: [{ id: l.pricelabsListingId, pms: l.pricelabsPms, dateFrom: iso(today), dateTo: iso(addDays(end, -1)) }] },
    });
    const row = (Array.isArray(rows) ? rows : []).find((r) => String(r.id) === l.pricelabsListingId) ?? (Array.isArray(rows) ? rows[0] : undefined);
    if (!row) return fail("PriceLabs didn't return prices for this listing.");
    if (row.error || row.error_status) return fail(ERRORS[row.error_status ?? ""] ?? `PriceLabs: ${String(row.error ?? row.error_status).slice(0, 200)}`);
    if (row.currency && row.currency.toUpperCase() !== "USD") return fail(`This listing is priced in ${row.currency} in PriceLabs. Keyvaga needs US dollars.`);
    const seen = new Set<string>();
    const rates: { date: Date; rateCents: number }[] = [];
    for (const d of row.data ?? []) {
      if (!d.date || !/^\d{4}-\d{2}-\d{2}$/.test(d.date) || seen.has(d.date)) continue;
      // user_price is the owner's own override in PriceLabs (−1 when none); otherwise PriceLabs' price.
      const user = Number(d.user_price);
      const amount = Number.isFinite(user) && user > 0 ? user : Number(d.price);
      if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000) continue;
      const date = new Date(`${d.date}T00:00:00.000Z`);
      if (date < today || date >= end) continue;
      seen.add(d.date);
      rates.push({ date, rateCents: Math.round(amount * 100) });
    }
    if (!rates.length) return fail("PriceLabs returned no prices for the coming year.");
    await db.$transaction([
      db.dateRate.deleteMany({ where: { listingId: l.id, date: { gte: today, lt: end } } }),
      db.dateRate.createMany({ data: rates.map((r) => ({ listingId: l.id, ...r })) }),
      db.listing.update({ where: { id: l.id }, data: { pricelabsSyncedAt: new Date(), pricelabsSyncError: null } }),
    ]);
    return { ok: true as const, rates: rates.length };
  } catch (e) {
    const detail = e instanceof Error ? e.message.replace(/\s+/g, " ").slice(0, 200) : String(e).slice(0, 200);
    if (!(e instanceof PriceLabsError)) console.error("pricelabs sync failed", l.id, detail);
    return fail(e instanceof PriceLabsError ? e.message : `Couldn't sync with PriceLabs: ${detail}`);
  }
}

/** Hourly cron: refresh listings not synced in the last `maxAgeMinutes` (PriceLabs recalculates daily). */
export async function runPriceLabsSync(maxAgeMinutes = 55) {
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60_000);
  const listings = await db.listing.findMany({
    where: { deletedAt: null, pricelabsListingId: { not: null }, OR: [{ pricelabsSyncedAt: null }, { pricelabsSyncedAt: { lt: cutoff } }] },
    select: { id: true },
    take: 200,
  });
  const result: Record<string, string> = {};
  for (const { id } of listings) {
    const r = await syncPriceLabsListing(id);
    if (!r.ok) result[id] = `error: ${r.error}`;
  }
  return { listings: listings.length, ...result };
}
