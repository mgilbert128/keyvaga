"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { dollarsToCents } from "@/lib/pricing";
import { PaymentRequestError, cancelPaymentRequest, createPaymentRequest, declinePaymentRequest } from "@/lib/payment-requests";

export type RequestFormState = { ok: boolean; message: string } | null;

/** Owner: ask the guest for an extra payment on this booking. */
export async function requestPaymentAction(bookingId: string, _prev: RequestFormState, formData: FormData): Promise<RequestFormState> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/owner/bookings/${bookingId}`);
  const amountCents = dollarsToCents(String(formData.get("amount") ?? ""));
  if (amountCents === null) return { ok: false, message: "Enter the amount in dollars, like 25 or 40.00." };
  try {
    await createPaymentRequest(user.id, bookingId, {
      description: String(formData.get("description") ?? ""),
      amountCents,
      taxable: formData.get("taxable") === "on",
    });
  } catch (e) {
    if (e instanceof PaymentRequestError) return { ok: false, message: e.message };
    console.error("create payment request failed", e);
    return { ok: false, message: "Couldn't send the request. Please try again." };
  }
  revalidatePath(`/owner/bookings/${bookingId}`);
  revalidatePath(`/trips/${bookingId}`);
  return { ok: true, message: "Request sent. The guest has been emailed and can pay from their trip page." };
}

export async function cancelRequestAction(bookingId: string, requestId: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/owner/bookings/${bookingId}`);
  await cancelPaymentRequest(user.id, requestId).catch((e) => console.error("cancel payment request failed", e));
  revalidatePath(`/owner/bookings/${bookingId}`);
  revalidatePath(`/trips/${bookingId}`);
}

export async function declineRequestAction(bookingId: string, requestId: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/trips/${bookingId}`);
  await declinePaymentRequest(user.id, requestId).catch((e) => console.error("decline payment request failed", e));
  revalidatePath(`/trips/${bookingId}`);
  revalidatePath(`/owner/bookings/${bookingId}`);
}
