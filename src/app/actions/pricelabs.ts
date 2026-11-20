"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { canAccessPortal } from "@/lib/auth/roles";
import { PriceLabsError, connectPriceLabs, disconnectPriceLabs, linkPriceLabsListing, syncPriceLabsListing, unlinkPriceLabsListing } from "@/lib/pricelabs";
import { db } from "@/lib/db";
import { hit } from "@/lib/rate-limit";

async function requireOwner() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/owner/pricelabs");
  if (!canAccessPortal(user.roles, "owner")) redirect("/no-access?portal=owner");
  return user;
}

const back = (kind: "saved" | "error", msg: string) => redirect(`/owner/pricelabs?${kind}=${encodeURIComponent(msg)}`);

async function run(fn: () => Promise<unknown>, ok: string) {
  try {
    await fn();
  } catch (e) {
    if (e instanceof PriceLabsError) back("error", e.message);
    console.error("pricelabs action failed", e instanceof Error ? e.message : e);
    back("error", "Something went wrong talking to PriceLabs. Please try again.");
  }
  revalidatePath("/owner/pricelabs");
  revalidatePath("/owner/pricing");
  revalidatePath("/owner/calendar");
  back("saved", ok);
}

export async function connectPriceLabsAction(fd: FormData) {
  const user = await requireOwner();
  if (!(await hit(`pricelabs-connect:${user.id}`, 10, 3600)).ok) back("error", "Too many tries. Please wait a little and try again.");
  await run(() => connectPriceLabs(user.id, String(fd.get("apiKey") ?? "")), "PriceLabs is connected. Now link each listing below.");
}

export async function disconnectPriceLabsAction() {
  const user = await requireOwner();
  await run(() => disconnectPriceLabs(user.id), "PriceLabs is disconnected. Your current prices stay as they are.");
}

export async function linkPriceLabsAction(plId: string, pms: string, fd: FormData) {
  const user = await requireOwner();
  const listingId = String(fd.get("listingId") ?? "");
  if (!listingId) back("error", "Choose which Keyvaga listing to link.");
  await run(() => linkPriceLabsListing(user.id, listingId, plId, pms), "Linked. This listing now uses your PriceLabs prices.");
}

export async function syncPriceLabsAction(listingId: string) {
  const user = await requireOwner();
  await run(async () => {
    const own = await db.listing.findFirst({ where: { id: listingId, ownerId: user.id }, select: { id: true } });
    if (!own) throw new PriceLabsError("Listing not found.");
    const r = await syncPriceLabsListing(listingId);
    if (!r.ok) throw new PriceLabsError(r.error);
  }, "Prices updated from PriceLabs.");
}

export async function unlinkPriceLabsAction(listingId: string) {
  const user = await requireOwner();
  await run(() => unlinkPriceLabsListing(user.id, listingId), "Unlinked from PriceLabs. Current prices stay until you change them.");
}
