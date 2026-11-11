"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/dal";
import { canEditListing, canReviewListings, missingForSubmit, nextStatus, type AdminAction, type OwnerAction } from "@/lib/listing-policy";
import { listingFormToObject, listingSchema, type ListingFormState } from "@/lib/validation/listing";
import { slugify } from "@/lib/slug";
import { deleteImage } from "@/lib/storage";

async function requireOwner(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.roles.includes("OWNER")) redirect("/no-access?portal=owner");
  return user;
}

async function loadOwned(user: CurrentUser, id: string) {
  const listing = await db.listing.findUnique({ where: { id }, include: { _count: { select: { photos: true } } } });
  if (!listing || !canEditListing(user, listing)) throw new Error("Listing not found");
  return listing;
}

async function uniqueSlug(title: string): Promise<string> {
  const base = slugify(title);
  for (let i = 0; i < 5; i++) {
    const candidate = `${base}-${crypto.randomUUID().slice(0, 6)}`;
    if (!(await db.listing.findUnique({ where: { slug: candidate }, select: { id: true } }))) return candidate;
  }
  return `${base}-${crypto.randomUUID()}`;
}

const createSchema = z.object({
  title: z.string().trim().min(1, "Give your place a name.").max(80, "Keep this under 80 characters."),
  propertyType: z.enum(["HOUSE", "APARTMENT", "CABIN", "CONDO", "VILLA", "OTHER"], { message: "Choose a property type." }),
});

export async function createListing(_prev: ListingFormState, formData: FormData): Promise<ListingFormState> {
  const user = await requireOwner();
  const parsed = createSchema.safeParse({ title: formData.get("title"), propertyType: formData.get("propertyType") });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const listing = await db.listing.create({
    data: {
      ownerId: user.id,
      title: parsed.data.title,
      propertyType: parsed.data.propertyType,
      slug: await uniqueSlug(parsed.data.title),
      summary: "",
      city: "",
      region: "",
      bedrooms: 1,
      bathrooms: "1",
      maxGuests: 2,
      nightlyRateCents: 0,
      status: "DRAFT",
    },
  });
  revalidatePath("/owner/listings");
  redirect(`/owner/listings/${listing.id}?created=1`);
}

export async function updateListing(id: string, _prev: ListingFormState, formData: FormData): Promise<ListingFormState> {
  const user = await requireOwner();
  const listing = await loadOwned(user, id);

  const parsed = listingSchema.safeParse(listingFormToObject(formData));
  if (!parsed.success) {
    return { message: "Some details need fixing. See the highlighted fields.", errors: parsed.error.flatten().fieldErrors };
  }
  const v = parsed.data;

  await db.listing.update({
    where: { id },
    data: {
      title: v.title,
      summary: v.summary,
      description: v.description,
      propertyType: v.propertyType,
      addressLine1: v.addressLine1,
      addressLine2: v.addressLine2,
      city: v.city,
      region: v.region,
      postalCode: v.postalCode,
      bedrooms: v.bedrooms,
      bathrooms: v.bathrooms.toString(),
      maxGuests: v.maxGuests,
      nightlyRateCents: v.nightlyRate,
      cleaningFeeCents: v.cleaningFee,
      minNights: v.minNights,
      checkInTime: v.checkInTime,
      checkOutTime: v.checkOutTime,
      houseRules: v.houseRules,
      amenities: v.amenities,
    },
  });

  revalidatePath(`/owner/listings/${id}`);
  revalidatePath("/owner/listings");
  revalidatePath(`/stays/${listing.slug}`);

  if (formData.get("intent") === "submit") {
    return changeStatus(user, id, "submit");
  }
  return { ok: true, message: "Saved." };
}

export async function ownerListingAction(id: string, action: OwnerAction): Promise<ListingFormState> {
  const user = await requireOwner();
  return changeStatus(user, id, action);
}

async function changeStatus(user: CurrentUser, id: string, action: OwnerAction): Promise<ListingFormState> {
  const listing = await loadOwned(user, id);
  const to = nextStatus(action, listing.status);
  if (!to) return { message: "That change isn't available for this listing right now." };

  if (action === "submit") {
    const missing = missingForSubmit({ ...listing, photoCount: listing._count.photos });
    if (missing.length) return { message: `Before submitting, add ${missing.join(", ")}.` };
  }

  await db.listing.update({
    where: { id },
    data: {
      status: to,
      ...(action === "submit" ? { submittedAt: new Date(), reviewNote: null } : {}),
    },
  });
  revalidatePath(`/owner/listings/${id}`);
  revalidatePath("/owner/listings");
  revalidatePath(`/stays/${listing.slug}`);
  revalidatePath("/admin");
  const messages: Record<OwnerAction, string> = {
    submit: "Submitted for review. We'll publish it once it's approved.",
    withdraw: "Moved back to draft.",
    pause: "Paused. Guests can't find or book it until you unpause.",
    unpause: "Live again.",
  };
  return { ok: true, message: messages[action] };
}

// ---------- Photos ----------

export async function deletePhoto(listingId: string, photoId: string) {
  const user = await requireOwner();
  const listing = await loadOwned(user, listingId);
  const photo = await db.listingPhoto.findFirst({ where: { id: photoId, listingId } });
  if (!photo) return;
  await db.$transaction(async (tx) => {
    await tx.listingPhoto.delete({ where: { id: photo.id } });
    const rest = await tx.listingPhoto.findMany({ where: { listingId }, orderBy: { position: "asc" } });
    for (const [i, p] of rest.entries()) if (p.position !== i) await tx.listingPhoto.update({ where: { id: p.id }, data: { position: i } });
  });
  await deleteImage(photo.storageKey).catch((e) => console.error("delete from storage failed", e));
  revalidatePath(`/owner/listings/${listingId}`);
  revalidatePath(`/stays/${listing.slug}`);
}

export async function movePhoto(listingId: string, photoId: string, direction: "up" | "down" | "cover") {
  const user = await requireOwner();
  const listing = await loadOwned(user, listingId);
  await db.$transaction(async (tx) => {
    const photos = await tx.listingPhoto.findMany({ where: { listingId }, orderBy: { position: "asc" } });
    const i = photos.findIndex((p) => p.id === photoId);
    if (i < 0) return;
    const [moved] = photos.splice(i, 1);
    const target = direction === "cover" ? 0 : direction === "up" ? Math.max(0, i - 1) : Math.min(photos.length, i + 1);
    photos.splice(target, 0, moved!);
    for (const [pos, p] of photos.entries()) if (p.position !== pos) await tx.listingPhoto.update({ where: { id: p.id }, data: { position: pos } });
  });
  revalidatePath(`/owner/listings/${listingId}`);
  revalidatePath(`/stays/${listing.slug}`);
}

// ---------- Admin review ----------

export async function reviewListing(id: string, action: AdminAction, formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !canReviewListings(user)) redirect("/no-access?portal=admin");
  const listing = await db.listing.findUnique({ where: { id } });
  if (!listing) return;
  const to = nextStatus(action, listing.status);
  if (!to) return;
  const note = String(formData.get("note") ?? "").trim().slice(0, 1000);
  await db.listing.update({
    where: { id },
    data: {
      status: to,
      reviewNote: action === "reject" ? note || "Please review your listing details and resubmit." : null,
      ...(action === "approve" && !listing.publishedAt ? { publishedAt: new Date() } : {}),
    },
  });
  revalidatePath("/admin");
  revalidatePath(`/stays/${listing.slug}`);
  revalidatePath("/search");
  revalidatePath("/");
}
