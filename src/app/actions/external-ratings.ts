"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { canAccessPortal } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { siteUrl } from "@/lib/site";
import { PLATFORMS, isPlatform, urlMatchesPlatform } from "@/lib/external-ratings";
import { canEditListing } from "@/lib/listing-policy";

type Result = { ok?: boolean; message?: string } | undefined;

async function ownedListing(listingId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const listing = await db.listing.findUnique({ where: { id: listingId } });
  if (!listing || listing.deletedAt || !canEditListing(user, listing)) return null;
  return listing;
}

/** Owner submits (or updates) their rating on another site; it shows once an admin verifies it. */
export async function submitExternalRating(listingId: string, _prev: Result, fd: FormData): Promise<Result> {
  const listing = await ownedListing(listingId);
  if (!listing) return { message: "Listing not found." };
  const platform = String(fd.get("platform") ?? "");
  if (!isPlatform(platform)) return { message: "Choose the site." };
  const url = String(fd.get("url") ?? "").trim();
  if (!urlMatchesPlatform(url, platform)) return { message: `Paste the full link to this property's ${PLATFORMS[platform].label} page (starting with https://).` };
  const scale = PLATFORMS[platform].scale;
  const rating = Math.round(Number(fd.get("rating")) * 100) / 100;
  if (!(rating >= 1 && rating <= scale)) return { message: `Enter the rating shown on ${PLATFORMS[platform].label}, from 1 to ${scale}.` };
  const reviewCount = Number.parseInt(String(fd.get("reviewCount") ?? ""), 10);
  if (!(reviewCount >= 1 && reviewCount <= 100_000)) return { message: "Enter how many reviews it has." };
  await db.externalRating.upsert({
    where: { listingId_platform: { listingId, platform } },
    create: { listingId, platform, url, rating, reviewCount },
    update: { url, rating, reviewCount, status: "PENDING", reviewNote: null, verifiedAt: null },
  });
  const admins = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim()).filter(Boolean);
  if (admins.length) {
    await sendEmail(admins, {
      subject: `Verify a ${PLATFORMS[platform].label} rating: ${listing.title}`,
      heading: "A rating is waiting for verification",
      paragraphs: [`${listing.title} says it's rated ${rating} from ${reviewCount} reviews on ${PLATFORMS[platform].label}.`],
      button: { label: "Check it", url: `${siteUrl()}/admin/ratings` },
    }).catch(() => false);
  }
  revalidatePath(`/owner/listings/${listingId}`);
  return { ok: true, message: "Sent for verification. It shows on your listing once Keyvaga confirms it, usually within a day." };
}

export async function removeExternalRating(listingId: string, platform: string) {
  const listing = await ownedListing(listingId);
  if (!listing) return;
  await db.externalRating.deleteMany({ where: { listingId, platform } });
  revalidatePath(`/owner/listings/${listingId}`);
  revalidatePath(`/stays/${listing.slug}`);
}

/** Admin: approve or reject after opening the link and checking the property and numbers match. */
export async function decideExternalRating(id: string, fd: FormData) {
  const user = await getCurrentUser();
  if (!user || !canAccessPortal(user.roles, "admin")) redirect("/no-access?portal=admin");
  const approve = fd.get("decision") === "approve";
  const note = String(fd.get("note") ?? "").trim().slice(0, 300) || null;
  const r = await db.externalRating.update({
    where: { id },
    data: approve ? { status: "APPROVED", verifiedAt: new Date(), reviewNote: null } : { status: "REJECTED", verifiedAt: null, reviewNote: note ?? "We couldn't confirm this rating." },
    include: { listing: { select: { slug: true, title: true, owner: { select: { email: true } } } } },
  });
  if (!approve) {
    await sendEmail(r.listing.owner.email, {
      subject: `We couldn't verify the rating for ${r.listing.title}`,
      heading: "Rating not verified",
      paragraphs: [r.reviewNote ?? "We couldn't confirm this rating.", "You can update the link or numbers and send it again from your listing."],
      button: { label: "Open listing", url: `${siteUrl()}/owner/listings/${r.listingId}#outside-ratings` },
    }).catch(() => false);
  }
  revalidatePath("/admin/ratings");
  revalidatePath(`/stays/${r.listing.slug}`);
}
