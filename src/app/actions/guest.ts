"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/dal";
import { canReview } from "@/lib/checkin";
import { todayIn } from "@/lib/dates";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { cookies } from "next/headers";
import { SESSION_COOKIE, hashSessionToken } from "@/lib/auth/tokens";

export type GuestResult = { ok?: boolean; message?: string } | undefined;

async function me() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function acceptHouseRules(bookingId: string) {
  const user = await me();
  await db.booking.updateMany({ where: { id: bookingId, guestId: user.id, status: "CONFIRMED", rulesAcceptedAt: null }, data: { rulesAcceptedAt: new Date() } });
  revalidatePath(`/trips/${bookingId}`);
}

const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1, "Choose a star rating.").max(5),
  body: z.string().trim().min(10, "Write at least a sentence or two.").max(2000, "Keep it under 2,000 characters."),
});

export async function submitReview(bookingId: string, _prev: GuestResult, fd: FormData): Promise<GuestResult> {
  const user = await me();
  const parsed = reviewSchema.safeParse({ rating: fd.get("rating") ?? 0, body: fd.get("body") ?? "" });
  if (!parsed.success) return { message: parsed.error.issues[0]?.message };
  const b = await db.booking.findUnique({ where: { id: bookingId }, include: { review: true, listing: { select: { slug: true } } } });
  if (!b || b.guestId !== user.id) return { message: "Booking not found." };
  if (!canReview({ status: b.status, checkOut: b.checkOut, today: todayIn(), hasReview: Boolean(b.review) })) return { message: "This stay can't be reviewed." };
  await db.review.create({ data: { bookingId: b.id, listingId: b.listingId, guestId: user.id, rating: parsed.data.rating, body: parsed.data.body } });
  revalidatePath(`/trips/${b.id}`);
  revalidatePath(`/stays/${b.listing.slug}`);
  return { ok: true, message: "Thanks for your review!" };
}

export async function toggleSaved(listingId: string, slug: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/stays/${slug}`)}`);
  const existing = await db.savedListing.findUnique({ where: { userId_listingId: { userId: user.id, listingId } } });
  if (existing) await db.savedListing.delete({ where: { userId_listingId: { userId: user.id, listingId } } });
  else if (await db.listing.findFirst({ where: { id: listingId, status: "PUBLISHED" }, select: { id: true } })) {
    await db.savedListing.create({ data: { userId: user.id, listingId } });
  }
  revalidatePath(`/stays/${slug}`);
  revalidatePath("/saved");
}

export async function updateProfile(_prev: GuestResult, fd: FormData): Promise<GuestResult> {
  const user = await me();
  const name = String(fd.get("name") ?? "").trim();
  if (!name || name.length > 80) return { message: "Enter your name (up to 80 characters)." };
  await db.user.update({ where: { id: user.id }, data: { name } });
  revalidatePath("/profile");
  return { ok: true, message: "Saved." };
}

export async function changePassword(_prev: GuestResult, fd: FormData): Promise<GuestResult> {
  const user = await me();
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("next") ?? "");
  if (next.length < 10 || next.length > 128) return { message: "Use at least 10 characters for the new password." };
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(current, row.passwordHash))) return { message: "Your current password isn't right." };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } });
  // Sign out every other device; keep this one signed in.
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  await db.session.deleteMany({ where: { userId: user.id, ...(token ? { NOT: { id: hashSessionToken(token) } } : {}) } });
  return { ok: true, message: "Password changed. Other devices have been signed out." };
}
