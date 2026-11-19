import "server-only";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { stripe, idOf } from "@/lib/stripe";
import { HOLD_MINUTES, bookingAmounts, cancellationOutcome, paymentSchedule, splitPayoutAcrossCharges } from "@/lib/booking-money";
import { addDays, rangeHasConflict, todayIn, toISODate, unavailableNights } from "@/lib/dates";
import { quoteStay } from "@/lib/pricing";
import { taxesFor } from "@/lib/tax";
import { payOutDueRequests, settleRequestsForCancelledBooking } from "@/lib/payment-requests";
import type { Prisma } from "@/generated/prisma/client";
import { autoRequestTurnover, cancelJobsForBooking } from "@/lib/jobs";
import { sendDueAutoMessages } from "@/lib/auto-messages-server";
import { notifyBookingCancelled, notifyBookingConfirmed, notifyBookingRequested, notifyRequestEnded } from "@/lib/notify";
import { issueBookingCodes, revokeBookingCodes } from "@/lib/locks";
import { refreshStaleFeeds } from "@/lib/calendar-sync";
import { pushBookingToHospitable, refreshHospitableIfStale, releaseBookingInHospitable } from "@/lib/hospitable";

/** Bookings that occupy dates: confirmed ones, and holds that haven't expired yet. */
export function occupyingBookings(now = new Date()): Prisma.BookingWhereInput {
  return { OR: [{ status: "CONFIRMED" }, { status: "PENDING_PAYMENT", holdExpiresAt: { gt: now } }, { status: "REQUESTED", holdExpiresAt: { gt: now } }] };
}

export class BookingError extends Error {}

/** How long an owner has to accept a request to book. Card authorizations last 7 days, so this stays well inside. */
export const REQUEST_HOURS = 24;

/** Releases dates held by guests who started checkout but didn't pay in time, and requests the owner didn't answer. */
export async function expireStaleHolds(listingId?: string) {
  const stale = await db.booking.findMany({
    where: { status: { in: ["PENDING_PAYMENT", "REQUESTED"] }, holdExpiresAt: { lte: new Date() }, ...(listingId ? { listingId } : {}) },
    include: { payments: { where: { status: "PENDING" } } },
  });
  for (const b of stale) {
    const wasRequest = b.status === "REQUESTED";
    const { count } = await db.booking.updateMany({
      where: { id: b.id, status: b.status },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelledBy: wasRequest ? "expired" : "system" },
    });
    if (!count) continue;
    for (const p of b.payments) {
      if (p.stripeId?.startsWith("pi_")) {
        // Releases the card hold (or abandons the unpaid checkout). Already paid/cancelled: sync handles it.
        await stripe().paymentIntents.cancel(p.stripeId).catch(() => {});
      }
      await db.payment.update({ where: { id: p.id }, data: { status: "CANCELED" } }).catch(() => {});
    }
    if (wasRequest) await notifyRequestEnded(b.id, "expired");
  }
  return stale.length;
}

async function ensureCustomer(userId: string): Promise<string> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.stripeCustomerId) return user.stripeCustomerId;
  const c = await stripe().customers.create({ email: user.email, name: user.name, metadata: { keyvagaUserId: user.id } });
  await db.user.update({ where: { id: user.id }, data: { stripeCustomerId: c.id } });
  return c.id;
}

/**
 * Step 1 of checkout: holds the dates for HOLD_MINUTES and creates the Stripe payment for what's due now.
 * The database refuses overlapping bookings, so two guests can't hold the same nights.
 */
export async function startBooking(input: { guestId: string; listingId: string; checkIn: Date; checkOut: Date; guests: number; pets?: boolean }) {
  const listing = await db.listing.findFirst({ where: { id: input.listingId, status: "PUBLISHED" }, include: { seasonalRates: true, dateRates: { where: { date: { gte: input.checkIn, lt: input.checkOut } } } } });
  if (!listing) throw new BookingError("This stay isn't available.");
  if (listing.ownerId === input.guestId) throw new BookingError("You can't book your own listing.");
  if (input.guests < 1 || input.guests > listing.maxGuests) throw new BookingError(`This place sleeps up to ${listing.maxGuests}.`);

  const today = todayIn();
  if (input.checkIn < today) throw new BookingError("Check-in can't be in the past.");
  if (input.checkIn > addDays(today, 540)) throw new BookingError("Bookings open up to 18 months ahead.");
  const quote = quoteStay({ ...listing, seasons: listing.seasonalRates, dateRates: listing.dateRates }, input.checkIn, input.checkOut);
  if (!quote.ok) throw new BookingError(quote.reason === "below_min_nights" ? `This stay has a ${quote.minNights}-night minimum.` : "Check-out must be after check-in.");

  // Pick up bookings made on Airbnb/Vrbo/etc. in the last few minutes before taking this one.
  await refreshStaleFeeds(listing.id, 10).catch((e) => console.error("calendar refresh before booking failed", e));
  await refreshHospitableIfStale(listing.id, 10).catch((e) => console.error("hospitable refresh before booking failed", e));
  const blocks = await db.calendarBlock.findMany({ where: { listingId: listing.id, startDate: { lt: input.checkOut }, endDate: { gt: input.checkIn } } });
  if (rangeHasConflict(input.checkIn, input.checkOut, unavailableNights(blocks.map((b) => ({ start: b.startDate, end: b.endDate })))))
    throw new BookingError("Some of those nights aren't available. Try other dates.");

  const petsOk = listing.petFeeCents > 0 || listing.amenities.includes("pets_allowed");
  if (input.pets && !petsOk) throw new BookingError("This place doesn't allow pets.");
  const petFeeCents = input.pets ? listing.petFeeCents : 0;
  const subtotalCents = quote.totalCents + petFeeCents;
  const taxes = await taxesFor(listing, subtotalCents);
  const amounts = bookingAmounts(subtotalCents, taxes);
  const schedule = paymentSchedule(amounts.guestTotalCents, input.checkIn, today);

  await expireStaleHolds(listing.id);
  let booking;
  try {
    booking = await db.booking.create({
      data: {
        listingId: listing.id,
        guestId: input.guestId,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        guests: input.guests,
        status: "PENDING_PAYMENT",
        holdExpiresAt: new Date(Date.now() + HOLD_MINUTES * 60_000),
        isRequest: !listing.instantBook,
        nightlyCents: quote.nightsCents - quote.discountCents, // nights after any weekly/monthly discount
        cleaningCents: quote.cleaningCents,
        pets: Boolean(input.pets),
        petFeeCents,
        serviceCents: amounts.guestFeeCents,
        totalCents: amounts.guestTotalCents,
        hostFeeCents: amounts.hostFeeCents,
        hostPayoutCents: amounts.hostPayoutCents,
        taxCents: amounts.taxCents,
        keyvagaTaxCents: amounts.keyvagaTaxCents,
        ownerTaxCents: amounts.ownerTaxCents,
        taxLines: taxes.lines.length ? (taxes.lines as unknown as Prisma.InputJsonValue) : undefined,
        cancellationPolicy: listing.cancellationPolicy,
        dueNowCents: schedule.dueNowCents,
        balanceCents: schedule.kind === "split" ? schedule.balanceCents : 0,
        balanceDueDate: schedule.kind === "split" ? schedule.balanceDueDate : null,
      },
    });
  } catch (e) {
    if (e instanceof Error && /Booking_no_overlap|exclusion|conflicting key/i.test(e.message)) {
      throw new BookingError("Someone just booked some of those nights. Try other dates.");
    }
    throw e;
  }

  try {
    const customer = await ensureCustomer(input.guestId);
    const kind = schedule.kind === "split" ? "DEPOSIT" : "FULL";
    const pi = await stripe().paymentIntents.create(
      {
        amount: schedule.dueNowCents,
        currency: "usd",
        customer,
        // Save the card so the balance can be charged automatically later.
        ...(schedule.kind === "split" ? { setup_future_usage: "off_session" as const } : {}),
        automatic_payment_methods: { enabled: true },
        // Request to book: only authorize the card now; it's charged when the owner accepts.
        ...(listing.instantBook ? {} : { capture_method: "manual" as const }),
        description: `Keyvaga ${kind === "DEPOSIT" ? "deposit" : "payment"}: ${listing.title}, ${toISODate(input.checkIn)} to ${toISODate(input.checkOut)}`,
        metadata: { bookingId: booking.id, kind },
        transfer_group: booking.id,
      },
      { idempotencyKey: `booking-${booking.id}-${kind}` },
    );
    await db.payment.create({ data: { bookingId: booking.id, kind, amountCents: schedule.dueNowCents, stripeId: pi.id } });
    return { bookingId: booking.id };
  } catch (e) {
    await db.booking.update({ where: { id: booking.id }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelledBy: "system" } });
    throw e;
  }
}

/** Client secret for the guest's pending payment, so the checkout page can collect card details. */
export async function getCheckoutSecret(bookingId: string): Promise<string | null> {
  const p = await db.payment.findFirst({ where: { bookingId, kind: { in: ["DEPOSIT", "FULL", "BALANCE"] }, status: "PENDING" }, orderBy: { createdAt: "desc" } });
  if (!p?.stripeId) return null;
  const pi = await stripe().paymentIntents.retrieve(p.stripeId);
  return pi.status === "succeeded" || pi.status === "canceled" ? null : pi.client_secret;
}

/**
 * Brings our records in line with Stripe for one PaymentIntent. Safe to call many times
 * (from the confirmation page and from Stripe webhooks).
 */
export async function syncPaymentIntent(piOrId: string | Stripe.PaymentIntent) {
  const pi = typeof piOrId === "string" ? await stripe().paymentIntents.retrieve(piOrId) : piOrId;
  const payment = await db.payment.findUnique({ where: { stripeId: pi.id }, include: { booking: true } });
  if (!payment) return null;
  const booking = payment.booking;

  if (pi.status === "requires_capture") {
    // Request to book: the card is authorized. Hand the dates to the owner to accept within REQUEST_HOURS.
    if (booking.status === "REQUESTED") return "requested";
    if (booking.status === "PENDING_PAYMENT" || (booking.status === "CANCELLED" && booking.cancelledBy === "system")) {
      try {
        const { count } = await db.booking.updateMany({
          where: { id: booking.id, status: booking.status },
          data: {
            status: "REQUESTED",
            holdExpiresAt: new Date(Date.now() + REQUEST_HOURS * 3_600_000),
            cancelledAt: null,
            cancelledBy: null,
            stripePaymentMethodId: idOf(pi.payment_method),
          },
        });
        if (count) await notifyBookingRequested(booking.id);
        return "requested";
      } catch {
        // The checkout hold lapsed and someone else took the dates: release the card hold.
        await stripe().paymentIntents.cancel(pi.id).catch(() => {});
        await db.payment.update({ where: { id: payment.id }, data: { status: "CANCELED" } });
        return "refunded_conflict";
      }
    }
    return booking.status.toLowerCase();
  }
  if (pi.status === "succeeded") {
    if (payment.status !== "SUCCEEDED") {
      await db.payment.update({ where: { id: payment.id }, data: { status: "SUCCEEDED", stripeChargeId: idOf(pi.latest_charge), failureMessage: null } });
    }
    if (payment.kind === "BALANCE") {
      await db.booking.update({ where: { id: booking.id }, data: { balanceStatus: "PAID" } });
      return "balance_paid";
    }
    if (booking.status === "CONFIRMED") return "confirmed";
    if (booking.status === "PENDING_PAYMENT" || booking.status === "REQUESTED" || (booking.status === "CANCELLED" && booking.cancelledBy === "system")) {
      try {
        // Conditional update: only the first sync (page return or webhook) confirms, so follow-ups run once.
        const { count } = await db.booking.updateMany({
          where: { id: booking.id, status: booking.status },
          data: {
            status: "CONFIRMED",
            confirmedAt: new Date(),
            holdExpiresAt: null,
            cancelledAt: null,
            cancelledBy: null,
            stripePaymentMethodId: idOf(pi.payment_method),
            balanceStatus: booking.balanceCents > 0 ? "SCHEDULED" : "NONE",
            payoutDueCents: booking.hostPayoutCents,
            payoutStatus: "PENDING",
          },
        });
        if (count === 0) return "confirmed"; // another request confirmed it a moment ago
        // Smart locks: create the guest's door code before messages go out, so {door_code} has a value.
        await issueBookingCodes(booking.id).catch((e) => console.error("door codes failed", e));
        await notifyBookingConfirmed(booking.id);
        // Linked Hospitable property: block these nights there so Airbnb, Vrbo and the rest close too.
        await pushBookingToHospitable(booking.id).catch((e) => console.error("hospitable block failed", e));
        // Owner's regular cleaner gets the turnover request automatically (if they turned it on).
        await autoRequestTurnover(booking.id).catch((e) => console.error("auto turnover request failed", e));
        // "Thanks for booking" and any messages already due (late bookings) go out right away.
        await sendDueAutoMessages(booking.id).catch((e) => console.error("auto messages failed", e));
        return "confirmed";
      } catch {
        // The hold expired and someone else booked the dates while this payment was finishing: refund in full.
        await refundPaymentIntent(booking.id, pi.id, pi.amount_received, "Dates were no longer available");
        await db.booking.update({ where: { id: booking.id }, data: { status: "CANCELLED", cancelledBy: "system", refundedCents: { increment: pi.amount_received } } });
        return "refunded_conflict";
      }
    }
    return booking.status.toLowerCase();
  }
  if (pi.status === "canceled") {
    await db.payment.update({ where: { id: payment.id }, data: { status: "CANCELED" } });
    return "canceled";
  }
  if (pi.last_payment_error) {
    await db.payment.update({ where: { id: payment.id }, data: { failureMessage: pi.last_payment_error.message ?? "Payment failed" } });
  }
  return pi.status;
}

/** The owner accepts a request to book: charge the authorized card, which confirms the booking. */
export async function approveRequest(bookingId: string) {
  const b = await db.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { payments: { where: { status: "PENDING" } } } });
  if (b.status !== "REQUESTED") throw new BookingError("This request has already been answered.");
  if (!b.holdExpiresAt || b.holdExpiresAt <= new Date()) {
    await expireStaleHolds(b.listingId);
    throw new BookingError("This request expired, so the dates were released and the guest wasn't charged.");
  }
  const p = b.payments.find((x) => x.stripeId?.startsWith("pi_"));
  if (!p) throw new BookingError("The guest's payment couldn't be found. Please decline and ask them to book again.");
  try {
    const pi = await stripe().paymentIntents.capture(p.stripeId!, {}, { idempotencyKey: `approve-${b.id}` });
    await syncPaymentIntent(pi);
  } catch (e) {
    console.error("capture failed", e);
    const pi = await stripe().paymentIntents.retrieve(p.stripeId!).catch(() => null);
    if (pi?.status === "succeeded") { await syncPaymentIntent(pi); return; }
    throw new BookingError("The guest's card couldn't be charged. Please decline the request; they can book again with another card.");
  }
}

/** The owner declines, or the guest withdraws, a request: release the card hold and free the dates. */
export async function endRequest(bookingId: string, reason: "declined" | "withdrawn") {
  const b = await db.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { payments: { where: { status: "PENDING" } } } });
  if (b.status !== "REQUESTED") throw new BookingError("This request has already been answered.");
  const { count } = await db.booking.updateMany({ where: { id: b.id, status: "REQUESTED" }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelledBy: reason } });
  if (!count) throw new BookingError("This request has already been answered.");
  for (const p of b.payments) {
    if (p.stripeId?.startsWith("pi_")) await stripe().paymentIntents.cancel(p.stripeId).catch((e) => console.error("release card hold failed", e));
    await db.payment.update({ where: { id: p.id }, data: { status: "CANCELED" } }).catch(() => {});
  }
  await notifyRequestEnded(b.id, reason);
}

async function refundPaymentIntent(bookingId: string, paymentIntentId: string, amountCents: number, reason: string) {
  if (amountCents <= 0) return;
  const r = await stripe().refunds.create(
    { payment_intent: paymentIntentId, amount: amountCents, metadata: { bookingId, reason } },
    { idempotencyKey: `refund-${paymentIntentId}-${amountCents}-${reason.slice(0, 20)}` },
  );
  await db.payment.create({ data: { bookingId, kind: "REFUND", amountCents, stripeId: r.id, status: r.status === "failed" ? "FAILED" : "SUCCEEDED" } });
}

/** Charges the remaining balance with the card saved at booking. */
export async function chargeBalance(bookingId: string) {
  const b = await db.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { guest: true } });
  if (b.status !== "CONFIRMED" || b.balanceCents <= 0 || b.balanceStatus === "PAID" || b.balanceStatus === "CANCELLED") return "skipped";
  if (!b.stripePaymentMethodId || !b.guest.stripeCustomerId) {
    await db.booking.update({ where: { id: b.id }, data: { balanceStatus: "FAILED", balanceAttempts: { increment: 1 } } });
    return "no_card";
  }
  const attempt = b.balanceAttempts + 1;
  try {
    const pi = await stripe().paymentIntents.create(
      {
        amount: b.balanceCents,
        currency: "usd",
        customer: b.guest.stripeCustomerId,
        payment_method: b.stripePaymentMethodId,
        off_session: true,
        confirm: true,
        description: `Keyvaga balance for booking ${b.id}`,
        metadata: { bookingId: b.id, kind: "BALANCE" },
        transfer_group: b.id,
      },
      { idempotencyKey: `booking-${b.id}-BALANCE-${attempt}` },
    );
    await db.payment.upsert({
      where: { stripeId: pi.id },
      create: { bookingId: b.id, kind: "BALANCE", amountCents: b.balanceCents, stripeId: pi.id },
      update: {},
    });
    await db.booking.update({ where: { id: b.id }, data: { balanceAttempts: attempt } });
    return await syncPaymentIntent(pi);
  } catch (e) {
    const err = e as Stripe.errors.StripeError;
    const piId = err.payment_intent?.id;
    if (piId) {
      await db.payment.upsert({
        where: { stripeId: piId },
        create: { bookingId: b.id, kind: "BALANCE", amountCents: b.balanceCents, stripeId: piId, status: "FAILED", failureMessage: err.message },
        update: { status: "FAILED", failureMessage: err.message },
      });
    }
    await db.booking.update({ where: { id: b.id }, data: { balanceStatus: "FAILED", balanceAttempts: attempt } });
    return "failed";
  }
}

/** Money the guest has actually paid so far (charges minus refunds). */
export async function paidSoFar(bookingId: string) {
  const payments = await db.payment.findMany({ where: { bookingId, status: "SUCCEEDED" } });
  const charges = payments.filter((p) => p.kind === "DEPOSIT" || p.kind === "FULL" || p.kind === "BALANCE");
  const refunds = payments.filter((p) => p.kind === "REFUND").reduce((s, p) => s + p.amountCents, 0);
  return { charges, paidCents: charges.reduce((s, p) => s + p.amountCents, 0) - refunds };
}

export async function previewCancellation(bookingId: string, by: "guest" | "owner") {
  const b = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });
  const { paidCents } = await paidSoFar(bookingId);
  const subtotal = b.nightlyCents + b.cleaningCents + b.petFeeCents;
  const amounts = bookingAmounts(subtotal, { keyvagaTaxCents: b.keyvagaTaxCents, ownerTaxCents: b.ownerTaxCents });
  return cancellationOutcome({ by, policy: b.cancellationPolicy, amounts, paidCents, checkIn: b.checkIn, today: todayIn() });
}

/** Cancels a confirmed booking, refunds per the policy (or in full if the owner cancels) and frees the dates. */
export async function cancelBooking(bookingId: string, by: "guest" | "owner") {
  const b = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });
  if (b.status !== "CONFIRMED") throw new BookingError("Only confirmed bookings can be cancelled.");
  if (b.checkOut <= todayIn()) throw new BookingError("This stay has already ended.");
  const outcome = await previewCancellation(bookingId, by);
  const { charges } = await paidSoFar(bookingId);

  // Mark cancelled first so the dates free up and no balance is charged, then refund.
  await db.booking.update({
    where: { id: b.id },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelledBy: by,
      balanceStatus: b.balanceStatus === "SCHEDULED" || b.balanceStatus === "FAILED" ? "CANCELLED" : b.balanceStatus,
      payoutDueCents: outcome.hostPayoutCents,
      payoutStatus: outcome.hostPayoutCents > 0 ? "PENDING" : "NONE",
      taxRetainedCents: outcome.taxRetainedCents,
    },
  });

  let remaining = outcome.refundCents;
  for (const c of [...charges].reverse()) {
    if (remaining <= 0) break;
    const amount = Math.min(remaining, c.amountCents);
    await refundPaymentIntent(b.id, c.stripeId!, amount, `Cancelled by ${by}`);
    remaining -= amount;
  }
  await db.booking.update({ where: { id: b.id }, data: { refundedCents: { increment: outcome.refundCents - remaining } } });
  // No stay, no turnover: cancel any cleaning booked for it.
  await revokeBookingCodes(b.id).catch((e) => console.error("remove door codes failed", e));
  await cancelJobsForBooking(b.id).catch((e) => console.error("cancel cleaning for booking failed", e));
  // Extra payments for this stay: cancel open requests, refund paid ones in full.
  await settleRequestsForCancelledBooking(b.id).catch((e) => console.error("settle payment requests failed", e));
  await releaseBookingInHospitable(b.id).catch((e) => console.error("hospitable release failed", e));
  await notifyBookingCancelled(b.id, by, outcome.refundCents - remaining);
  return outcome;
}

/** Sends the owner's share once the stay has started (or the original check-in date has passed after a cancellation). */
export async function payOutBooking(bookingId: string) {
  const b = await db.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { listing: { include: { owner: true } } } });
  if (b.payoutStatus !== "PENDING" || b.payoutDueCents <= 0) return "skipped";
  if (b.checkIn > todayIn()) return "not_yet";
  if (b.status === "CONFIRMED" && b.balanceCents > 0 && b.balanceStatus !== "PAID") return "awaiting_balance";
  const owner = b.listing.owner;
  if (!owner.stripeAccountId || !owner.payoutsEnabled) return "owner_not_connected";

  const { charges } = await paidSoFar(b.id);
  const parts = splitPayoutAcrossCharges(
    b.payoutDueCents,
    charges.filter((c) => c.stripeChargeId).map((c) => ({ id: c.stripeChargeId!, amountCents: c.amountCents })),
  );
  for (const part of parts) {
    const t = await stripe().transfers.create(
      { amount: part.amountCents, currency: "usd", destination: owner.stripeAccountId, source_transaction: part.id, transfer_group: b.id, metadata: { bookingId: b.id } },
      { idempotencyKey: `payout-${b.id}-${part.id}` },
    );
    await db.payment.upsert({
      where: { stripeId: t.id },
      create: { bookingId: b.id, kind: "PAYOUT", amountCents: part.amountCents, stripeId: t.id, status: "SUCCEEDED" },
      update: {},
    });
  }
  await db.booking.update({ where: { id: b.id }, data: { payoutStatus: "PAID" } });
  return "paid";
}

/** The daily job: release stale holds, charge balances that are due, pay owners whose guests have checked in. */
export async function runDailyJobs() {
  const today = todayIn();
  const expired = await expireStaleHolds();
  const dueBalances = await db.booking.findMany({
    where: {
      status: "CONFIRMED",
      balanceCents: { gt: 0 },
      balanceDueDate: { lte: today },
      OR: [{ balanceStatus: "SCHEDULED" }, { balanceStatus: "FAILED", balanceAttempts: { lt: 3 } }],
    },
    select: { id: true },
  });
  const balances: Record<string, string> = {};
  for (const { id } of dueBalances) balances[id] = String(await chargeBalance(id).catch((e) => `error: ${e.message}`));

  const duePayouts = await db.booking.findMany({ where: { payoutStatus: "PENDING", checkIn: { lte: today } }, select: { id: true } });
  const payouts: Record<string, string> = {};
  for (const { id } of duePayouts) payouts[id] = String(await payOutBooking(id).catch((e) => `error: ${e.message}`));
  const requestPayouts = await payOutDueRequests().catch((e) => ({ all: `error: ${e instanceof Error ? e.message : e}` }));
  return { expired, balances, payouts, requestPayouts };
}
