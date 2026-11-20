import "server-only";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { stripe, idOf } from "@/lib/stripe";
import { addDays, todayIn } from "@/lib/dates";
import { sendEmail } from "@/lib/email";
import { siteUrl } from "@/lib/site";
import { formatCents } from "@/lib/money";

/**
 * Security deposits: a hold (authorization) on the guest's saved card, never a charge unless the owner claims damage.
 *
 * - Placed automatically on check-in day by the hourly cron (card saved at booking with setup_future_usage).
 * - Card holds last about 5–7 days (Visa: 4 days 18 hours for holds we start), so before a hold runs out
 *   and the stay plus the 5-day release window isn't over, a new hold is placed and the old one cancelled.
 * - After checkout the owner releases it or charges some or all of it with a reason. If they do nothing by
 *   releaseBy (5 days after checkout), it's released automatically.
 * - Charged amounts go to the owner's Stripe account in full. Keyvaga takes no fee on deposits.
 */
export const RELEASE_DAYS = 5;
const RENEW_HOURS_BEFORE_EXPIRY = 30;
const MAX_ATTEMPTS = 3;

export class DepositError extends Error {}

const day = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const first = (name: string) => name.split(" ")[0] ?? name;

/** 5 days after checkout, at noon Central (17:00 UTC). */
export function releaseDeadline(checkOut: Date): Date {
  const d = addDays(checkOut, RELEASE_DAYS);
  return new Date(d.getTime() + 17 * 3_600_000);
}

/** When Stripe says the authorization must be captured by; falls back to a safe 4 days. */
function captureBefore(pi: Stripe.PaymentIntent): Date {
  const charge = pi.latest_charge && typeof pi.latest_charge === "object" ? pi.latest_charge : null;
  const card = charge?.payment_method_details?.card as { capture_before?: number } | undefined;
  if (card?.capture_before) return new Date(card.capture_before * 1000);
  return new Date(Date.now() + 4 * 86_400_000);
}

async function cancelIntent(id: string | null | undefined) {
  if (!id) return;
  try {
    await stripe().paymentIntents.cancel(id);
  } catch (e) {
    // Already cancelled, expired or captured: nothing left to release.
    console.info("deposit cancel skipped", id, e instanceof Error ? e.message : e);
  }
}

const loadBooking = (bookingId: string) =>
  db.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { guest: true, depositHold: true, listing: { select: { title: true, owner: { select: { name: true, email: true, stripeAccountId: true, payoutsEnabled: true } } } } },
  });

/** Places (or renews) the hold for a booking. Returns a short status for the cron log. */
export async function placeDepositHold(bookingId: string): Promise<string> {
  const b = await loadBooking(bookingId);
  if (b.status !== "CONFIRMED" || b.securityDepositCents <= 0) return "skipped";
  const old = b.depositHold;
  if (old && (old.status === "RELEASED" || old.status === "CHARGED")) return "done";
  const releaseBy = releaseDeadline(b.checkOut);
  if (releaseBy <= new Date()) return "too_late";
  const renewing = old?.status === "HELD";
  const attempt = (old?.attempts ?? 0) + 1;

  if (!b.stripePaymentMethodId || !b.guest.stripeCustomerId) {
    await db.depositHold.upsert({
      where: { bookingId: b.id },
      create: { bookingId: b.id, amountCents: b.securityDepositCents, status: "FAILED", releaseBy, attempts: MAX_ATTEMPTS, lastError: "No saved card for this booking." },
      update: { lastError: "No saved card for this booking.", attempts: MAX_ATTEMPTS },
    });
    if (!old) await notifyOwnerProblem(b.id, "We couldn't place the security deposit hold because there's no saved card for this booking.");
    return "no_card";
  }

  try {
    const pi = await stripe().paymentIntents.create(
      {
        amount: b.securityDepositCents,
        currency: "usd",
        customer: b.guest.stripeCustomerId,
        payment_method: b.stripePaymentMethodId,
        off_session: true,
        confirm: true,
        capture_method: "manual",
        description: `Keyvaga security deposit hold: ${b.listing.title}`,
        metadata: { bookingId: b.id, kind: "SECURITY_DEPOSIT" },
        transfer_group: b.id,
        expand: ["latest_charge"],
      },
      { idempotencyKey: `deposit-${b.id}-${(old?.renewals ?? 0) + (renewing ? 1 : 0)}-${attempt}` },
    );
    if (pi.status !== "requires_capture") {
      await cancelIntent(pi.id);
      throw new DepositError(`The card couldn't be authorized (${pi.status}).`);
    }
    const data = { amountCents: b.securityDepositCents, status: "HELD" as const, stripePaymentIntentId: pi.id, expiresAt: captureBefore(pi), releaseBy, attempts: 0, lastError: null };
    await db.depositHold.upsert({
      where: { bookingId: b.id },
      create: { bookingId: b.id, ...data },
      update: { ...data, renewals: renewing ? { increment: 1 } : undefined },
    });
    if (renewing) await cancelIntent(old?.stripePaymentIntentId);
    else await notifyGuestHeld(b.id);
    return renewing ? "renewed" : "held";
  } catch (e) {
    const message = (e instanceof Error ? e.message : String(e)).slice(0, 300);
    const failedPi = (e as Stripe.errors.StripeError)?.payment_intent?.id;
    if (failedPi) await cancelIntent(failedPi);
    if (renewing) {
      // Keep the current hold until it runs out; try again next hour (up to MAX_ATTEMPTS).
      await db.depositHold.update({ where: { bookingId: b.id }, data: { attempts: attempt, lastError: message } });
      if (attempt === MAX_ATTEMPTS) await notifyOwnerProblem(b.id, `We couldn't renew the security deposit hold (${message}). The current hold ends ${old?.expiresAt ? day.format(old.expiresAt) : "soon"}. You can still charge it before then.`);
    } else {
      await db.depositHold.upsert({
        where: { bookingId: b.id },
        create: { bookingId: b.id, amountCents: b.securityDepositCents, status: "FAILED", releaseBy, attempts: attempt, lastError: message },
        update: { status: "FAILED", attempts: attempt, lastError: message },
      });
      if (attempt === MAX_ATTEMPTS) await notifyOwnerProblem(b.id, `We couldn't place the security deposit hold on the guest's card (${message}).`);
    }
    return `failed: ${message}`;
  }
}

/** Owner (or the automatic deadline) releases the hold. */
export async function releaseDeposit(bookingId: string, by: "owner" | "auto" | "cancelled"): Promise<void> {
  const b = await loadBooking(bookingId);
  const h = b.depositHold;
  if (!h || (h.status !== "HELD" && h.status !== "FAILED")) return;
  if (h.status === "HELD") await cancelIntent(h.stripePaymentIntentId);
  await db.depositHold.update({ where: { id: h.id }, data: { status: "RELEASED", decidedAt: new Date(), lastError: null } });
  if (h.status === "HELD" && by !== "cancelled") await notifyGuestReleased(b.id);
}

/** Owner charges some or all of the hold for damage, with a reason the guest sees. */
export async function chargeDeposit(bookingId: string, amountCents: number, reason: string): Promise<void> {
  const b = await loadBooking(bookingId);
  const h = b.depositHold;
  if (!h || h.status !== "HELD" || !h.stripePaymentIntentId) throw new DepositError("There's no active deposit hold to charge.");
  if (b.checkIn > todayIn()) throw new DepositError("You can charge the deposit once the stay has started.");
  if (!Number.isInteger(amountCents) || amountCents < 100 || amountCents > h.amountCents) throw new DepositError(`Enter an amount between $1 and ${formatCents(h.amountCents)}.`);
  const why = reason.replace(/\s+/g, " ").trim().slice(0, 1000);
  if (why.length < 10) throw new DepositError("Explain what the charge is for, so the guest understands it.");
  let pi: Stripe.PaymentIntent;
  try {
    pi = await stripe().paymentIntents.capture(h.stripePaymentIntentId, { amount_to_capture: amountCents }, { idempotencyKey: `deposit-capture-${h.id}-${h.stripePaymentIntentId}` });
  } catch (e) {
    throw new DepositError(`Stripe couldn't charge the deposit: ${(e instanceof Error ? e.message : String(e)).slice(0, 200)}. If the hold has expired, contact support.`);
  }
  let transferId: string | null = null;
  const owner = b.listing.owner;
  const chargeId = idOf(pi.latest_charge);
  if (owner.stripeAccountId && owner.payoutsEnabled && chargeId) {
    const t = await stripe().transfers.create(
      { amount: amountCents, currency: "usd", destination: owner.stripeAccountId, source_transaction: chargeId, transfer_group: b.id, metadata: { bookingId: b.id, kind: "SECURITY_DEPOSIT" } },
      { idempotencyKey: `deposit-payout-${h.id}` },
    );
    transferId = t.id;
  }
  await db.depositHold.update({
    where: { id: h.id },
    data: { status: "CHARGED", chargedCents: amountCents, chargeReason: why, decidedAt: new Date(), stripeTransferId: transferId, lastError: transferId ? null : "Charged; payout to the owner is waiting for their Stripe payout setup." },
  });
  await notifyGuestCharged(b.id);
}

/** Stripe webhook: the current hold was cancelled or expired on Stripe's side. */
export async function syncDepositIntent(pi: Stripe.PaymentIntent) {
  if (pi.status !== "canceled") return;
  const h = await db.depositHold.findFirst({ where: { stripePaymentIntentId: pi.id, status: "HELD" } });
  if (!h) return; // an old hold we replaced, or already decided
  await db.depositHold.update({ where: { id: h.id }, data: { status: "RELEASED", decidedAt: new Date(), lastError: "The card hold expired." } });
}

/** Hourly: place holds on check-in day, renew before they expire, release at the deadline or when a booking is cancelled. */
export async function runDepositJobs() {
  const now = new Date();
  const today = todayIn();
  const out: Record<string, string> = {};

  const due = await db.booking.findMany({
    where: {
      status: "CONFIRMED",
      securityDepositCents: { gt: 0 },
      checkIn: { lte: today },
      checkOut: { gte: addDays(today, -RELEASE_DAYS) },
      OR: [{ depositHold: { is: null } }, { depositHold: { is: { status: "FAILED", attempts: { lt: MAX_ATTEMPTS }, updatedAt: { lt: new Date(now.getTime() - 3 * 3_600_000) } } } }],
    },
    select: { id: true },
    take: 200,
  });
  for (const { id } of due) out[`place ${id}`] = await placeDepositHold(id).catch((e) => `error: ${e instanceof Error ? e.message : e}`);

  const renew = await db.depositHold.findMany({
    where: { status: "HELD", attempts: { lt: MAX_ATTEMPTS }, expiresAt: { lt: new Date(now.getTime() + RENEW_HOURS_BEFORE_EXPIRY * 3_600_000) }, booking: { status: "CONFIRMED" } },
    select: { bookingId: true, expiresAt: true, releaseBy: true },
    take: 200,
  });
  for (const h of renew) {
    if (h.expiresAt && h.expiresAt >= h.releaseBy) continue; // the current hold already lasts past the deadline
    out[`renew ${h.bookingId}`] = await placeDepositHold(h.bookingId).catch((e) => `error: ${e instanceof Error ? e.message : e}`);
  }

  const release = await db.depositHold.findMany({
    where: { status: { in: ["HELD", "FAILED"] }, OR: [{ releaseBy: { lte: now } }, { booking: { status: "CANCELLED" } }] },
    select: { bookingId: true, booking: { select: { status: true } } },
    take: 200,
  });
  for (const h of release) {
    await releaseDeposit(h.bookingId, h.booking.status === "CANCELLED" ? "cancelled" : "auto").catch((e) => console.error("deposit release failed", h.bookingId, e));
    out[`release ${h.bookingId}`] = "released";
  }
  return { checked: due.length + renew.length + release.length, ...out };
}

// ---------- emails (best effort) ----------

async function safe(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    console.error("deposit email failed", e instanceof Error ? e.message : e);
  }
}

function notifyGuestHeld(bookingId: string) {
  return safe(async () => {
    const b = await loadBooking(bookingId);
    await sendEmail(b.guest.email, {
      subject: `Security deposit hold for ${b.listing.title}`,
      heading: `Enjoy your stay, ${first(b.guest.name)}!`,
      paragraphs: [
        `As part of your booking, a refundable security deposit of ${formatCents(b.securityDepositCents)} is now on hold on your card. It's a hold, not a charge.`,
        `It will be released within ${RELEASE_DAYS} days after checkout (by ${day.format(addDays(b.checkOut, RELEASE_DAYS))}) unless your host reports damage. Your bank may take a few days to show the release.`,
      ],
      button: { label: "View your trip", url: `${siteUrl()}/trips/${b.id}` },
    });
  });
}

function notifyGuestReleased(bookingId: string) {
  return safe(async () => {
    const b = await loadBooking(bookingId);
    await sendEmail(b.guest.email, {
      subject: `Your security deposit has been released`,
      heading: "Your deposit has been released",
      paragraphs: [`The ${formatCents(b.securityDepositCents)} security deposit hold for ${b.listing.title} has been released. Depending on your bank, it can take a few days to disappear from your statement. Thanks for staying with Keyvaga!`],
      button: { label: "View your trip", url: `${siteUrl()}/trips/${b.id}` },
    });
  });
}

function notifyGuestCharged(bookingId: string) {
  return safe(async () => {
    const b = await loadBooking(bookingId);
    const h = b.depositHold!;
    const rest = h.amountCents - h.chargedCents;
    await sendEmail(b.guest.email, {
      subject: `Security deposit charge for ${b.listing.title}`,
      heading: "Part of your security deposit was charged",
      paragraphs: [
        `Your host charged ${formatCents(h.chargedCents)} of your ${formatCents(h.amountCents)} security deposit for ${b.listing.title}.`,
        `Reason from your host: "${h.chargeReason}"`,
        rest > 0 ? `The remaining ${formatCents(rest)} has been released.` : "",
        `If you have questions, reply to this email or message your host from your trip page.`,
      ].filter(Boolean),
      button: { label: "View your trip", url: `${siteUrl()}/trips/${b.id}` },
    });
    await sendEmail(b.listing.owner.email, {
      subject: `Deposit charged: ${formatCents(h.chargedCents)}`,
      heading: "Deposit charge complete",
      paragraphs: [
        `You charged ${formatCents(h.chargedCents)} of the security deposit for ${b.guest.name}'s stay at ${b.listing.title}. The guest has been emailed your reason.`,
        h.stripeTransferId ? "The full amount is on its way to your Stripe account." : "Finish setting up payouts on your Payouts page to receive it.",
      ],
      button: { label: "View booking", url: `${siteUrl()}/owner/bookings/${b.id}` },
    });
  });
}

function notifyOwnerProblem(bookingId: string, message: string) {
  return safe(async () => {
    const b = await loadBooking(bookingId);
    await sendEmail(b.listing.owner.email, {
      subject: `Security deposit issue: ${b.listing.title}`,
      heading: "There's a problem with a security deposit",
      paragraphs: [message, `Booking: ${b.guest.name}, ${day.format(b.checkIn)} – ${day.format(b.checkOut)}.`],
      button: { label: "View booking", url: `${siteUrl()}/owner/bookings/${b.id}` },
    });
  });
}
