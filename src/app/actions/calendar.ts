"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/dal";
import { canEditListing } from "@/lib/listing-policy";
import { parseISODate } from "@/lib/dates";
import { dollarsToCents } from "@/lib/pricing";

export type FormResult = { ok?: boolean; message?: string } | undefined;

async function ownedListing(listingId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const listing = await db.listing.findUnique({ where: { id: listingId }, select: { id: true, ownerId: true, slug: true } });
  if (!listing || !canEditListing(user, listing)) throw new Error("Listing not found");
  return listing;
}

function refresh(listing: { id: string; slug: string }) {
  revalidatePath("/owner/calendar");
  revalidatePath("/owner/pricing");
  revalidatePath(`/stays/${listing.slug}`);
}

/** Blocks a date range on the calendar. Refuses ranges that overlap a confirmed booking or an existing block. */
export async function blockDates(listingId: string, _prev: FormResult, fd: FormData): Promise<FormResult> {
  const listing = await ownedListing(listingId);
  const start = parseISODate(String(fd.get("start") ?? ""));
  const endInclusive = parseISODate(String(fd.get("end") ?? ""));
  if (!start || !endInclusive) return { message: "Choose a start and end date." };
  if (endInclusive < start) return { message: "The last blocked night must be on or after the first." };
  const end = new Date(endInclusive.getTime() + 86_400_000); // store as [start, end)
  if ((end.getTime() - start.getTime()) / 86_400_000 > 366) return { message: "Block at most a year at a time." };
  const note = String(fd.get("note") ?? "").trim().slice(0, 120) || null;

  const overlapBooking = await db.booking.findFirst({
    where: { listingId, checkIn: { lt: end }, checkOut: { gt: start }, OR: [{ status: "CONFIRMED" }, { status: "PENDING_PAYMENT", holdExpiresAt: { gt: new Date() } }] },
  });
  if (overlapBooking) return { message: "Some of those nights are already booked. Pick dates around the booking." };
  const overlapBlock = await db.calendarBlock.findFirst({ where: { listingId, startDate: { lt: end }, endDate: { gt: start } } });
  if (overlapBlock) return { message: "Some of those nights are already blocked." };

  await db.calendarBlock.create({ data: { listingId, startDate: start, endDate: end, note, source: "OWNER" } });
  refresh(listing);
  return { ok: true, message: "Dates blocked." };
}

export async function unblockDates(listingId: string, blockId: string) {
  const listing = await ownedListing(listingId);
  await db.calendarBlock.deleteMany({ where: { id: blockId, listingId, source: "OWNER" } });
  refresh(listing);
}

const pricingSchema = z.object({
  weekendRate: z.string().trim(),
  weeklyDiscount: z.coerce.number().min(0, "Discounts can't be negative.").max(90, "Keep discounts at 90% or less."),
  monthlyDiscount: z.coerce.number().min(0, "Discounts can't be negative.").max(90, "Keep discounts at 90% or less."),
});

export async function updatePricing(listingId: string, _prev: FormResult, fd: FormData): Promise<FormResult> {
  const listing = await ownedListing(listingId);
  const parsed = pricingSchema.safeParse({
    weekendRate: fd.get("weekendRate") ?? "",
    weeklyDiscount: fd.get("weeklyDiscount") || "0",
    monthlyDiscount: fd.get("monthlyDiscount") || "0",
  });
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Check the values." };
  let weekendRateCents: number | null = null;
  if (parsed.data.weekendRate) {
    weekendRateCents = dollarsToCents(parsed.data.weekendRate);
    if (!weekendRateCents) return { message: "Enter the weekend rate in dollars, like 225, or leave it empty." };
  }
  await db.listing.update({
    where: { id: listingId },
    data: {
      weekendRateCents,
      weeklyDiscountBps: Math.round(parsed.data.weeklyDiscount * 100),
      monthlyDiscountBps: Math.round(parsed.data.monthlyDiscount * 100),
    },
  });
  refresh(listing);
  return { ok: true, message: "Pricing saved." };
}

export async function addSeason(listingId: string, _prev: FormResult, fd: FormData): Promise<FormResult> {
  const listing = await ownedListing(listingId);
  const name = String(fd.get("name") ?? "").trim().slice(0, 60);
  const start = parseISODate(String(fd.get("start") ?? ""));
  const endInclusive = parseISODate(String(fd.get("end") ?? ""));
  const rate = dollarsToCents(String(fd.get("rate") ?? ""));
  if (!name) return { message: "Give the season a name, like Summer or Holidays." };
  if (!start || !endInclusive || endInclusive < start) return { message: "Choose valid first and last nights." };
  if (!rate) return { message: "Enter the nightly rate in dollars." };
  const end = new Date(endInclusive.getTime() + 86_400_000);
  const overlap = await db.seasonalRate.findFirst({ where: { listingId, startDate: { lt: end }, endDate: { gt: start } } });
  if (overlap) return { message: `That overlaps "${overlap.name}". Seasons can't overlap.` };
  await db.seasonalRate.create({ data: { listingId, name, startDate: start, endDate: end, nightlyRateCents: rate } });
  refresh(listing);
  return { ok: true, message: "Season added." };
}

export async function deleteSeason(listingId: string, seasonId: string) {
  const listing = await ownedListing(listingId);
  await db.seasonalRate.deleteMany({ where: { id: seasonId, listingId } });
  refresh(listing);
}
