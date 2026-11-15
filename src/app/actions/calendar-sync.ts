"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/dal";
import { detectProvider, normalizeFeedUrl } from "@/lib/ical";
import { syncFeed } from "@/lib/calendar-sync";

export type SyncResult = { ok?: boolean; message?: string } | undefined;

async function ownerListing(listingId: string) {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  if (!u.roles.includes("OWNER")) redirect("/no-access?portal=owner");
  const listing = await db.listing.findFirst({ where: { id: listingId, ownerId: u.id }, select: { id: true } });
  if (!listing) redirect("/owner/calendar");
  return listing;
}

const MAX_FEEDS = 10;

export async function addCalendarFeed(listingId: string, _prev: SyncResult, fd: FormData): Promise<SyncResult> {
  const listing = await ownerListing(listingId);
  const n = normalizeFeedUrl(String(fd.get("url") ?? ""));
  if ("error" in n) return { message: n.error };
  if (/\/ical\/[a-z0-9]+\.ics/i.test(n.url) && /keyvaga/i.test(n.url)) return { message: "That's Keyvaga's own calendar link. Paste it into Airbnb, Vrbo or your other platform instead, and paste their link here." };
  const count = await db.calendarFeed.count({ where: { listingId } });
  if (count >= MAX_FEEDS) return { message: `You can sync up to ${MAX_FEEDS} calendars per listing.` };
  const provider = detectProvider(n.url);
  const name = String(fd.get("name") ?? "").trim().slice(0, 40) || provider.name;
  let feedId: string;
  try {
    feedId = (await db.calendarFeed.create({ data: { listingId: listing.id, url: n.url, provider: provider.id, name } })).id;
  } catch {
    return { message: "That calendar is already synced." };
  }
  const r = await syncFeed(feedId);
  revalidatePath("/owner/calendar");
  if (!r.ok) return { message: `Added, but the first sync didn't work: ${r.error}` };
  return { ok: true, message: `${name} connected. ${r.count} upcoming booked or blocked period${r.count === 1 ? "" : "s"} imported.` };
}

export async function syncCalendarNow(listingId: string) {
  const listing = await ownerListing(listingId);
  const feeds = await db.calendarFeed.findMany({ where: { listingId: listing.id }, select: { id: true } });
  await Promise.all(feeds.map((f) => syncFeed(f.id)));
  revalidatePath("/owner/calendar");
}

export async function removeCalendarFeed(listingId: string, feedId: string) {
  const listing = await ownerListing(listingId);
  await db.calendarFeed.deleteMany({ where: { id: feedId, listingId: listing.id } }); // its blocks go with it
  revalidatePath("/owner/calendar");
}

/** New export link; the old one stops working (e.g. if it was shared by mistake). */
export async function resetExportLink(listingId: string) {
  const listing = await ownerListing(listingId);
  await db.listing.update({ where: { id: listing.id }, data: { icalToken: null } });
  revalidatePath("/owner/calendar");
}
