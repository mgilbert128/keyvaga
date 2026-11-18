import "server-only";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { idOf, stripe } from "@/lib/stripe";
import { REQUEST_MAX_CENTS, REQUEST_MIN_CENTS, paymentRequestAmounts } from "@/lib/booking-money";
import { addDays, todayIn } from "@/lib/dates";
import { taxesFor } from "@/lib/tax";
import { NO_TAX } from "@/lib/tax-calc";
import type { Prisma } from "@/generated/prisma/client";
import { notifyPaymentRequested, notifyPaymentRequestPaid } from "@/lib/notify";

/**
 * Payment requests: an owner asks a booked guest for extra money (parking pass, beach gear...).
 * The guest approves and pays with Stripe; Keyvaga holds the money and pays the owner
 * (amount − host fee + owner-filed tax) once the stay has started. Owners can cancel a request until
 * it's paid; paid requests are refunded only if the booking is cancelled before check-in.
 */
export class PaymentRequestError extends Error {}

async function ensureCustomer(userId: string): Promise<string> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.stripeCustomerId) return user.stripeCustomerId;
  const c = await stripe().customers.create({ email: user.email, name: user.name, metadata: { keyvagaUserId: user.id } });
  await db.user.update({ where: { id: user.id }, data: { stripeCustomerId: c.id } });
  return c.id;
}

/** Owners can request money from confirmed bookings, up to 14 days after checkout. */
const REQUEST_WINDOW_DAYS = 14;

export async function createPaymentRequest(ownerId: string, bookingId: string, input: { description: string; amountCents: number; taxable: boolean }) {
  const b = await db.booking.findUnique({ where: { id: bookingId }, include: { listing: { select: { ownerId: true, city: true, region: true } } } });
  if (!b || b.listing.ownerId !== ownerId) throw new PaymentRequestError("Booking not found.");
  if (b.status !== "CONFIRMED" && b.status !== "COMPLETED") throw new PaymentRequestError("You can only request payments for confirmed bookings.");
  if (todayIn() > addDays(b.checkOut, REQUEST_WINDOW_DAYS)) throw new PaymentRequestError(`Requests can be sent up to ${REQUEST_WINDOW_DAYS} days after checkout.`);
  const description = input.description.trim().slice(0, 140);
  if (!description) throw new PaymentRequestError("Say what the payment is for, like “Second parking pass”.");
  if (!Number.isInteger(input.amountCents) || input.amountCents < REQUEST_MIN_CENTS || input.amountCents > REQUEST_MAX_CENTS) {
    throw new PaymentRequestError(`Enter an amount between $${REQUEST_MIN_CENTS / 100} and $${(REQUEST_MAX_CENTS / 100).toLocaleString("en-US")}.`);
  }
  const taxes = input.taxable ? await taxesFor(b.listing, input.amountCents) : NO_TAX;
  const a = paymentRequestAmounts(input.amountCents, taxes);
  const r = await db.paymentRequest.create({
    data: {
      bookingId,
      description,
      amountCents: a.amountCents,
      taxCents: a.taxCents,
      keyvagaTaxCents: a.keyvagaTaxCents,
      ownerTaxCents: a.ownerTaxCents,
      taxLines: taxes.lines.length ? (taxes.lines as unknown as Prisma.InputJsonValue) : undefined,
      totalCents: a.totalCents,
      hostFeeCents: a.hostFeeCents,
      ownerPayoutCents: a.ownerPayoutCents,
    },
  });
  void notifyPaymentRequested(r.id);
  return r;
}

async function loadForGuest(guestId: string, requestId: string) {
  const r = await db.paymentRequest.findUnique({ where: { id: requestId }, include: { booking: { select: { id: true, guestId: true, status: true } } } });
  if (!r || r.booking.guestId !== guestId) throw new PaymentRequestError("Request not found.");
  return r;
}

/** Creates (or reuses) the Stripe payment for a request and returns its client secret for the card form. */
export async function startRequestPayment(guestId: string, requestId: string): Promise<string | null> {
  const r = await loadForGuest(guestId, requestId);
  if (r.status !== "REQUESTED") return null;
  if (r.booking.status === "CANCELLED") throw new PaymentRequestError("This booking was cancelled.");
  if (r.stripePaymentIntentId) {
    const existing = await stripe().paymentIntents.retrieve(r.stripePaymentIntentId);
    if (existing.status !== "canceled" && existing.status !== "succeeded") return existing.client_secret;
    if (existing.status === "succeeded") {
      await syncRequestPayment(existing);
      return null;
    }
  }
  const pi = await stripe().paymentIntents.create(
    {
      amount: r.totalCents,
      currency: "usd",
      customer: await ensureCustomer(guestId),
      automatic_payment_methods: { enabled: true },
      description: `Keyvaga: ${r.description}`,
      metadata: { paymentRequestId: r.id, bookingId: r.bookingId, kind: "PAYMENT_REQUEST" },
      transfer_group: r.bookingId,
    },
    { idempotencyKey: `payment-request-${r.id}-${r.updatedAt.getTime()}` },
  );
  await db.paymentRequest.update({ where: { id: r.id }, data: { stripePaymentIntentId: pi.id } });
  return pi.client_secret;
}

/** Brings a request in line with Stripe. Safe to call repeatedly (webhook + return page). */
export async function syncRequestPayment(piOrId: string | Stripe.PaymentIntent) {
  const pi = typeof piOrId === "string" ? await stripe().paymentIntents.retrieve(piOrId) : piOrId;
  const r = await db.paymentRequest.findUnique({ where: { stripePaymentIntentId: pi.id } });
  if (!r) return null;
  if (pi.status === "succeeded" && r.status !== "PAID" && r.status !== "REFUNDED") {
    // Conditional update so the webhook and the return page can't both mark it paid.
    const { count } = await db.paymentRequest.updateMany({
      where: { id: r.id, status: { in: ["REQUESTED", "DECLINED", "CANCELLED"] } },
      data: { status: "PAID", paidAt: new Date(), stripeChargeId: idOf(pi.latest_charge) },
    });
    if (count) {
      void notifyPaymentRequestPaid(r.id);
      await payOutRequest(r.id).catch((e) => console.error("payment request payout failed", e));
    }
    return "paid";
  }
  return pi.status;
}

export async function declinePaymentRequest(guestId: string, requestId: string) {
  const r = await loadForGuest(guestId, requestId);
  if (r.status !== "REQUESTED") throw new PaymentRequestError("This request can't be declined now.");
  await cancelOpenIntent(r.stripePaymentIntentId);
  await db.paymentRequest.updateMany({ where: { id: r.id, status: "REQUESTED" }, data: { status: "DECLINED" } });
}

/** Owners can withdraw a request until the guest pays it. */
export async function cancelPaymentRequest(ownerId: string, requestId: string) {
  const r = await db.paymentRequest.findUnique({ where: { id: requestId }, include: { booking: { include: { listing: { select: { ownerId: true } } } } } });
  if (!r || r.booking.listing.ownerId !== ownerId) throw new PaymentRequestError("Request not found.");
  if (r.status !== "REQUESTED") throw new PaymentRequestError("Only unpaid requests can be cancelled.");
  await cancelOpenIntent(r.stripePaymentIntentId);
  await db.paymentRequest.updateMany({ where: { id: r.id, status: "REQUESTED" }, data: { status: "CANCELLED" } });
}

async function cancelOpenIntent(piId: string | null) {
  if (!piId) return;
  const pi = await stripe().paymentIntents.retrieve(piId);
  if (pi.status === "succeeded") {
    await syncRequestPayment(pi);
    throw new PaymentRequestError("This request was just paid.");
  }
  if (pi.status !== "canceled") await stripe().paymentIntents.cancel(piId).catch(() => {});
}

/**
 * When a booking is cancelled: open requests are cancelled, and paid requests not yet paid out are
 * refunded in full (only possible before check-in, since payouts happen once the stay starts).
 */
export async function settleRequestsForCancelledBooking(bookingId: string) {
  const requests = await db.paymentRequest.findMany({ where: { bookingId, status: { in: ["REQUESTED", "PAID"] } } });
  for (const r of requests) {
    if (r.status === "REQUESTED") {
      await cancelOpenIntent(r.stripePaymentIntentId).catch(() => {});
      await db.paymentRequest.updateMany({ where: { id: r.id, status: "REQUESTED" }, data: { status: "CANCELLED" } });
    } else if (!r.paidOutAt && r.stripePaymentIntentId) {
      await stripe().refunds.create({ payment_intent: r.stripePaymentIntentId, metadata: { paymentRequestId: r.id } }, { idempotencyKey: `payment-request-refund-${r.id}` });
      await db.paymentRequest.update({ where: { id: r.id }, data: { status: "REFUNDED", refundedAt: new Date() } });
    }
  }
}

/** Pays the owner's share once the stay has started. Retried by the daily job until it succeeds. */
export async function payOutRequest(requestId: string) {
  const r = await db.paymentRequest.findUniqueOrThrow({ where: { id: requestId }, include: { booking: { include: { listing: { include: { owner: true } } } } } });
  if (r.status !== "PAID" || r.paidOutAt || r.ownerPayoutCents <= 0) return "skipped";
  if (r.booking.status === "CANCELLED") return "booking_cancelled";
  if (r.booking.checkIn > todayIn()) return "not_due";
  const owner = r.booking.listing.owner;
  if (!owner.stripeAccountId || !owner.payoutsEnabled) return "owner_not_connected";
  if (!r.stripeChargeId) return "no_charge";
  const t = await stripe().transfers.create(
    { amount: r.ownerPayoutCents, currency: "usd", destination: owner.stripeAccountId, source_transaction: r.stripeChargeId, transfer_group: r.bookingId, metadata: { paymentRequestId: r.id, bookingId: r.bookingId } },
    { idempotencyKey: `payment-request-payout-${r.id}` },
  );
  await db.paymentRequest.update({ where: { id: r.id }, data: { paidOutAt: new Date(), stripeTransferId: t.id } });
  return "paid";
}

/** Daily: pay out every paid request whose stay has started. */
export async function payOutDueRequests() {
  const due = await db.paymentRequest.findMany({ where: { status: "PAID", paidOutAt: null, booking: { checkIn: { lte: todayIn() }, status: { not: "CANCELLED" } } }, select: { id: true } });
  const results: Record<string, string> = {};
  for (const { id } of due) {
    const res = await payOutRequest(id).catch((e) => `error: ${e instanceof Error ? e.message : e}`);
    if (res !== "paid") results[id] = res;
  }
  return results;
}
