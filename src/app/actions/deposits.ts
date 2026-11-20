"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/dal";
import { DepositError, chargeDeposit, releaseDeposit } from "@/lib/deposits";
import { dollarsToCents } from "@/lib/pricing";

export type DepositFormState = { ok?: boolean; message?: string } | undefined;

async function ownerOf(bookingId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const b = await db.booking.findUnique({ where: { id: bookingId }, select: { listing: { select: { ownerId: true } } } });
  if (!b || b.listing.ownerId !== user.id) throw new DepositError("Booking not found.");
}

export async function releaseDepositAction(bookingId: string, _prev: DepositFormState): Promise<DepositFormState> {
  try {
    await ownerOf(bookingId);
    await releaseDeposit(bookingId, "owner");
  } catch (e) {
    if (e instanceof DepositError) return { message: e.message };
    console.error("deposit release failed", e instanceof Error ? e.message : e);
    return { message: "Couldn't release the deposit. Please try again." };
  }
  revalidatePath(`/owner/bookings/${bookingId}`);
  revalidatePath(`/trips/${bookingId}`);
  return { ok: true, message: "Deposit released. The guest has been emailed." };
}

export async function chargeDepositAction(bookingId: string, _prev: DepositFormState, fd: FormData): Promise<DepositFormState> {
  const cents = dollarsToCents(String(fd.get("amount") ?? ""));
  if (!cents) return { message: "Enter the amount in dollars, like 150." };
  try {
    await ownerOf(bookingId);
    await chargeDeposit(bookingId, cents, String(fd.get("reason") ?? ""));
  } catch (e) {
    if (e instanceof DepositError) return { message: e.message };
    console.error("deposit charge failed", e instanceof Error ? e.message : e);
    return { message: "Couldn't charge the deposit. Please try again." };
  }
  revalidatePath(`/owner/bookings/${bookingId}`);
  revalidatePath(`/trips/${bookingId}`);
  return { ok: true, message: "Deposit charged. The guest has been emailed your reason, and the rest was released." };
}
