"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/dal";
import { BookingError, cancelBooking, startBooking } from "@/lib/bookings";
import { parseISODate } from "@/lib/dates";
import { payoutOnboardingLink, payoutDashboardLink } from "@/lib/payouts";
import { stripeConfigured } from "@/lib/stripe";

/** "Reserve" on a stay page: holds the dates and sends the guest to checkout. */
export async function reserve(formData: FormData) {
  const listingId = String(formData.get("listingId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const checkInS = String(formData.get("checkIn") ?? "");
  const checkOutS = String(formData.get("checkOut") ?? "");
  const guests = Number.parseInt(String(formData.get("guests") ?? "1"), 10) || 1;
  const back = `/stays/${encodeURIComponent(slug)}?checkIn=${checkInS}&checkOut=${checkOutS}&guests=${guests}`;

  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(back)}`);
  if (!stripeConfigured()) redirect(`${back}&error=${encodeURIComponent("Online payment isn't switched on yet.")}`);

  const checkIn = parseISODate(checkInS);
  const checkOut = parseISODate(checkOutS);
  if (!checkIn || !checkOut) redirect(`${back}&error=${encodeURIComponent("Choose your dates first.")}`);

  let bookingId: string;
  try {
    ({ bookingId } = await startBooking({ guestId: user.id, listingId, checkIn, checkOut, guests }));
  } catch (e) {
    const msg = e instanceof BookingError ? e.message : "Something went wrong starting your booking. Please try again.";
    if (!(e instanceof BookingError)) console.error("startBooking failed", e);
    redirect(`${back}&error=${encodeURIComponent(msg)}`);
  }
  redirect(`/book/${bookingId}`);
}

export type CancelState = { ok?: boolean; message?: string } | undefined;

export async function guestCancel(bookingId: string): Promise<CancelState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const b = await db.booking.findUnique({ where: { id: bookingId }, select: { guestId: true } });
  if (!b || b.guestId !== user.id) return { message: "Booking not found." };
  return doCancel(bookingId, "guest");
}

export async function ownerCancel(bookingId: string): Promise<CancelState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const b = await db.booking.findUnique({ where: { id: bookingId }, select: { listing: { select: { ownerId: true } } } });
  if (!b || b.listing.ownerId !== user.id || !user.roles.includes("OWNER")) return { message: "Booking not found." };
  return doCancel(bookingId, "owner");
}

async function doCancel(bookingId: string, by: "guest" | "owner"): Promise<CancelState> {
  try {
    await cancelBooking(bookingId, by);
  } catch (e) {
    if (e instanceof BookingError) return { message: e.message };
    console.error("cancel failed", e);
    return { message: "We couldn't finish the cancellation. Please try again or contact support." };
  }
  revalidatePath(`/trips/${bookingId}`);
  revalidatePath("/trips");
  revalidatePath("/owner/bookings");
  return { ok: true, message: "Booking cancelled." };
}

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export async function startPayoutSetup() {
  const user = await getCurrentUser();
  if (!user || !user.roles.includes("OWNER")) redirect("/no-access?portal=owner");
  let url: string;
  try {
    url = await payoutOnboardingLink(user.id, await origin());
  } catch (e) {
    console.error("payout onboarding failed", e);
    redirect(`/owner/payouts?error=${encodeURIComponent(e instanceof Error && /signed up for Connect/i.test(e.message) ? "Payouts aren't enabled on Keyvaga's Stripe account yet." : "Couldn't open payout setup. Please try again.")}`);
  }
  redirect(url);
}

export async function openPayoutDashboard() {
  const user = await getCurrentUser();
  if (!user || !user.roles.includes("OWNER")) redirect("/no-access?portal=owner");
  const url = await payoutDashboardLink(user.id).catch(() => null);
  redirect(url ?? "/owner/payouts");
}

