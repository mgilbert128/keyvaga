import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { db } from "@/lib/db";
import { addDays, todayIn } from "@/lib/dates";
import { buildIcs, mergeRanges, parseIcs } from "@/lib/ical";

/**
 * iCal calendar sync. Import: each listing can follow other calendars (Airbnb, Vrbo, Booking.com, Hospitable,
 * OwnerRez...); their busy dates become CalendarBlocks (source ICAL), replaced on every sync. Export: each listing
 * has a secret /ical/<token>.ics feed with Keyvaga bookings and owner blocks for those platforms to import.
 * Feeds refresh before every booking attempt (if older than 10 minutes), when a stay page is viewed (hourly),
 * from "Sync now", and daily from the cron.
 */

const MAX_BYTES = 2 * 1024 * 1024;
const HORIZON_DAYS = 730;

function isPrivateAddress(ip: string) {
  if (isIP(ip) === 6) return /^(::1|::|fc|fd|fe80|::ffff:(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.))/i.test(ip);
  return /^(0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(ip);
}

export class FeedError extends Error {}

/** Downloads a feed with SSRF protection: public hosts only, redirects re-checked, size and time limits. */
export async function fetchFeed(url: string, fetcher: typeof fetch = fetch): Promise<string> {
  let current = url;
  for (let hop = 0; hop < 4; hop++) {
    const u = new URL(current);
    if (u.protocol !== "https:" && u.protocol !== "http:") throw new FeedError("Calendar links must start with https://");
    if (fetcher === fetch) {
      const addrs = await lookup(u.hostname, { all: true }).catch(() => []);
      if (!addrs.length) throw new FeedError("Couldn't find that calendar's website. Check the link.");
      if (addrs.some((a) => isPrivateAddress(a.address))) throw new FeedError("That calendar address isn't allowed.");
    }
    const res = await fetcher(current, { redirect: "manual", headers: { "User-Agent": "Keyvaga-CalendarSync/1.0", Accept: "text/calendar, */*" }, signal: AbortSignal.timeout(10_000) });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location")!, current).toString();
      continue;
    }
    if (res.status === 404 || res.status === 410) throw new FeedError("The calendar link no longer works (it may have been reset). Copy a fresh link.");
    if (!res.ok) throw new FeedError(`The calendar site answered with an error (${res.status}). We'll try again.`);
    const len = Number(res.headers.get("content-length") ?? 0);
    if (len > MAX_BYTES) throw new FeedError("That calendar is too large.");
    const text = await res.text();
    if (text.length > MAX_BYTES) throw new FeedError("That calendar is too large.");
    if (!/BEGIN:VCALENDAR/i.test(text)) throw new FeedError("That link isn't a calendar (iCal) link. Look for “Export calendar” or a link ending in .ics.");
    return text;
  }
  throw new FeedError("Too many redirects.");
}

/** Pulls one feed and replaces its blocks. Never throws: the result is stored on the feed. */
export async function syncFeed(feedId: string, fetcher: typeof fetch = fetch) {
  const feed = await db.calendarFeed.findUnique({ where: { id: feedId }, include: { listing: { select: { id: true, timeZone: true } } } });
  if (!feed) return { ok: false as const, error: "Calendar not found." };
  try {
    const text = await fetchFeed(feed.url, fetcher);
    const today = todayIn(feed.listing.timeZone);
    const horizon = addDays(today, HORIZON_DAYS);
    const ranges = mergeRanges(parseIcs(text, feed.listing.timeZone).filter((e) => e.end > today && e.start < horizon));
    await db.$transaction([
      db.calendarBlock.deleteMany({ where: { feedId: feed.id } }),
      db.calendarBlock.createMany({ data: ranges.map((r) => ({ listingId: feed.listingId, feedId: feed.id, source: "ICAL" as const, startDate: r.start, endDate: r.end, note: feed.name })) }),
      db.calendarFeed.update({ where: { id: feed.id }, data: { lastSyncedAt: new Date(), lastStatus: "ok", lastError: null, eventCount: ranges.length } }),
    ]);
    return { ok: true as const, count: ranges.length };
  } catch (e) {
    const error = e instanceof FeedError ? e.message : "Couldn't reach that calendar. We'll try again.";
    if (!(e instanceof FeedError)) console.error("calendar sync failed", feed.id, e instanceof Error ? e.message : e);
    // Keep the previous blocks: a temporary outage shouldn't open up dates that are booked elsewhere.
    await db.calendarFeed.update({ where: { id: feed.id }, data: { lastSyncedAt: new Date(), lastStatus: "error", lastError: error } });
    return { ok: false as const, error };
  }
}

/** Re-syncs a listing's feeds that are older than `maxAgeMinutes`. Used before bookings and on page views. */
export async function refreshStaleFeeds(listingId: string, maxAgeMinutes: number) {
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60_000);
  const feeds = await db.calendarFeed.findMany({ where: { listingId, OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lt: cutoff } }] }, select: { id: true } });
  await Promise.all(feeds.map((f) => syncFeed(f.id)));
  return feeds.length;
}

/** Daily cron: every feed. */
export async function runCalendarSync() {
  const feeds = await db.calendarFeed.findMany({ select: { id: true } });
  let ok = 0;
  for (const f of feeds) if ((await syncFeed(f.id)).ok) ok++;
  return { feeds: feeds.length, ok };
}

export async function ensureIcalToken(listingId: string): Promise<string> {
  const l = await db.listing.findUniqueOrThrow({ where: { id: listingId }, select: { icalToken: true } });
  if (l.icalToken) return l.icalToken;
  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  await db.listing.update({ where: { id: listingId }, data: { icalToken: token } });
  return token;
}

/**
 * Export feed: confirmed Keyvaga bookings, live checkout holds and the owner's own blocks.
 * Imported blocks are left out so calendars don't echo each other's dates back and forth.
 */
export async function exportFeed(token: string): Promise<string | null> {
  const listing = await db.listing.findUnique({ where: { icalToken: token }, select: { id: true, title: true, timeZone: true } });
  if (!listing) return null;
  const today = todayIn(listing.timeZone);
  const [bookings, blocks] = await Promise.all([
    db.booking.findMany({
      where: { listingId: listing.id, checkOut: { gt: addDays(today, -30) }, OR: [{ status: "CONFIRMED" }, { status: "PENDING_PAYMENT", holdExpiresAt: { gt: new Date() } }] },
      select: { id: true, checkIn: true, checkOut: true },
    }),
    db.calendarBlock.findMany({ where: { listingId: listing.id, source: "OWNER", endDate: { gt: addDays(today, -30) } }, select: { id: true, startDate: true, endDate: true } }),
  ]);
  return buildIcs(`Keyvaga: ${listing.title}`, [
    ...bookings.map((b) => ({ uid: `booking-${b.id}@keyvaga.com`, start: b.checkIn, end: b.checkOut, summary: "Keyvaga booking" })),
    ...blocks.map((b) => ({ uid: `block-${b.id}@keyvaga.com`, start: b.startDate, end: b.endDate, summary: "Blocked on Keyvaga" })),
  ]);
}
