import "server-only";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { stripe, idOf } from "@/lib/stripe";
import { AUTO_RELEASE_DAYS, isServiceCategory, jobAmounts, nextJobStatus, providerServes, type JobStatus } from "@/lib/services";
import { todayIn } from "@/lib/dates";
import { notifyHired, notifyJobDone, notifyJobRequest, notifyQuoteReceived } from "@/lib/notify";
import { issueJobCodes, revokeJobCodes } from "@/lib/locks";
import { checklistFor, completionBlockers, usesChecklist } from "@/lib/checklist";

export class JobError extends Error {}

type Profile = { id: string; status: string; categories: string[]; serviceAreas: string[]; region: string };
type JobForAccess = { status: string; targetProviderId: string | null; category: string; listing: { city: string; region: string }; quotes?: { providerId: string }[]; acceptedQuote?: { providerId: string } | null };

/** A provider may see a job if it was sent to them, they already quoted on it, or it's open and in their area and category. */
export function providerCanSee(p: Profile, j: JobForAccess): boolean {
  if (j.targetProviderId === p.id) return true;
  if (j.acceptedQuote?.providerId === p.id) return true;
  if (j.quotes?.some((q) => q.providerId === p.id)) return true;
  return j.status === "OPEN" && !j.targetProviderId && providerServes(p, { category: j.category, city: j.listing.city, region: j.listing.region });
}

export async function createJob(ownerId: string, input: { listingId: string; category: string; title: string; description: string; preferredDate: Date | null; flexibleDate: boolean; bookingId?: string | null; providerId?: string | null }) {
  const listing = await db.listing.findFirst({ where: { id: input.listingId, ownerId }, select: { id: true, city: true, region: true, cleaningChecklist: true, cleaningMinPhotos: true } });
  if (!listing) throw new JobError("Choose one of your properties.");
  if (!isServiceCategory(input.category)) throw new JobError("Choose what kind of help you need.");
  if (!input.title.trim()) throw new JobError("Give the job a short title.");
  if (input.description.trim().length < 10) throw new JobError("Describe the job in a sentence or two.");
  if (input.preferredDate && input.preferredDate < todayIn()) throw new JobError("The date can't be in the past.");
  let bookingId: string | null = null;
  if (input.bookingId) {
    const b = await db.booking.findFirst({ where: { id: input.bookingId, listingId: listing.id, status: "CONFIRMED" }, select: { id: true } });
    bookingId = b?.id ?? null;
  }
  if (input.providerId) {
    const p = await db.providerProfile.findUnique({ where: { id: input.providerId } });
    if (!p || p.status !== "APPROVED") throw new JobError("That provider isn't available.");
    if (p.userId === ownerId) throw new JobError("You can't hire yourself.");
  }
  const job = await db.job.create({
    data: {
      ownerId,
      listingId: listing.id,
      bookingId,
      category: input.category,
      title: input.title.trim().slice(0, 100),
      description: input.description.trim().slice(0, 3000),
      preferredDate: input.preferredDate,
      flexibleDate: input.flexibleDate,
      targetProviderId: input.providerId ?? null,
      // Cleanings carry the listing's checklist so the cleaner sees it when quoting and works through it on the day.
      ...(usesChecklist(input.category)
        ? { minPhotos: listing.cleaningMinPhotos, checklist: { create: checklistFor(listing).map((label, position) => ({ label, position })) } }
        : {}),
    },
  });
  await notifyJobRequest(job.id);
  return job;
}

/** Jobs a provider should see in their inbox. */
export async function providerInbox(profile: Profile) {
  const jobs = await db.job.findMany({
    where: {
      OR: [
        { targetProviderId: profile.id },
        { quotes: { some: { providerId: profile.id } } },
        { status: "OPEN", targetProviderId: null, category: { in: profile.categories.length ? profile.categories : ["_none"] }, ...(profile.region ? { listing: { region: { equals: profile.region, mode: "insensitive" as const } } } : {}) },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { listing: { select: { title: true, city: true, region: true } }, quotes: { where: { providerId: profile.id } }, acceptedQuote: { select: { providerId: true } } },
  });
  return jobs.filter((j) => providerCanSee(profile, j));
}

export async function submitQuote(profile: Profile & { userId: string }, jobId: string, input: { amountCents: number; proposedDate: Date | null; message: string }) {
  if (profile.status !== "APPROVED") throw new JobError("Your profile must be approved before you can quote.");
  const job = await db.job.findUnique({ where: { id: jobId }, include: { listing: { select: { city: true, region: true } }, quotes: true, acceptedQuote: true } });
  if (!job || !providerCanSee(profile, job)) throw new JobError("Job not found.");
  if (job.status !== "OPEN") throw new JobError("This job is no longer taking quotes.");
  if (job.ownerId === profile.userId) throw new JobError("You can't quote on your own job.");
  if (!Number.isInteger(input.amountCents) || input.amountCents < 500 || input.amountCents > 5_000_000) throw new JobError("Enter a price between $5 and $50,000.");
  if (input.proposedDate && input.proposedDate < todayIn()) throw new JobError("The date can't be in the past.");
  const quote = await db.quote.upsert({
    where: { jobId_providerId: { jobId, providerId: profile.id } },
    create: { jobId, providerId: profile.id, amountCents: input.amountCents, proposedDate: input.proposedDate, message: input.message.trim().slice(0, 2000) },
    update: { amountCents: input.amountCents, proposedDate: input.proposedDate, message: input.message.trim().slice(0, 2000), status: "SUBMITTED" },
  });
  await notifyQuoteReceived(quote.id);
  return quote;
}

async function ensureCustomer(userId: string): Promise<string> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.stripeCustomerId) return user.stripeCustomerId;
  const c = await stripe().customers.create({ email: user.email, name: user.name, metadata: { keyvagaUserId: user.id } });
  await db.user.update({ where: { id: user.id }, data: { stripeCustomerId: c.id } });
  return c.id;
}

/** Owner chooses a quote: records the price and creates the Stripe payment. The job is scheduled once payment succeeds. */
export async function startAcceptQuote(ownerId: string, jobId: string, quoteId: string) {
  const job = await db.job.findUnique({ where: { id: jobId }, include: { payments: { where: { kind: "CHARGE", status: "PENDING" } } } });
  if (!job || job.ownerId !== ownerId) throw new JobError("Job not found.");
  if (job.status !== "OPEN") throw new JobError("This job already has a provider.");
  const quote = await db.quote.findFirst({ where: { id: quoteId, jobId, status: "SUBMITTED" } });
  if (!quote) throw new JobError("That quote is no longer available.");
  const a = jobAmounts(quote.amountCents);

  // Switching to a different quote cancels the earlier unpaid payment.
  for (const p of job.payments) {
    if (p.stripeId) await stripe().paymentIntents.cancel(p.stripeId).catch(() => {});
    await db.jobPayment.update({ where: { id: p.id }, data: { status: "CANCELED" } });
  }
  await db.job.update({
    where: { id: job.id },
    data: { acceptedQuoteId: quote.id, quoteCents: a.quoteCents, ownerFeeCents: a.ownerFeeCents, ownerTotalCents: a.ownerTotalCents, providerFeeCents: a.providerFeeCents, providerPayoutCents: a.providerPayoutCents },
  });
  const pi = await stripe().paymentIntents.create(
    {
      amount: a.ownerTotalCents,
      currency: "usd",
      customer: await ensureCustomer(ownerId),
      automatic_payment_methods: { enabled: true },
      description: `Keyvaga service: ${job.title}`,
      metadata: { jobId: job.id, quoteId: quote.id, kind: "JOB_CHARGE" },
      transfer_group: `job_${job.id}`,
    },
    { idempotencyKey: `job-${job.id}-quote-${quote.id}-${quote.updatedAt.getTime()}` },
  );
  await db.jobPayment.upsert({ where: { stripeId: pi.id }, create: { jobId: job.id, kind: "CHARGE", amountCents: a.ownerTotalCents, stripeId: pi.id }, update: { status: "PENDING" } });
  return { jobId: job.id };
}

export async function getJobCheckoutSecret(jobId: string): Promise<string | null> {
  const p = await db.jobPayment.findFirst({ where: { jobId, kind: "CHARGE", status: "PENDING" }, orderBy: { createdAt: "desc" } });
  if (!p?.stripeId) return null;
  const pi = await stripe().paymentIntents.retrieve(p.stripeId);
  return pi.status === "succeeded" || pi.status === "canceled" ? null : pi.client_secret;
}

/** Brings a job's payment in line with Stripe. Safe to call repeatedly (return page + webhook). */
export async function syncJobPayment(piOrId: string | Stripe.PaymentIntent) {
  const pi = typeof piOrId === "string" ? await stripe().paymentIntents.retrieve(piOrId) : piOrId;
  const payment = await db.jobPayment.findUnique({ where: { stripeId: pi.id }, include: { job: { include: { acceptedQuote: true } } } });
  if (!payment) return null;
  if (pi.status === "succeeded") {
    if (payment.status !== "SUCCEEDED") await db.jobPayment.update({ where: { id: payment.id }, data: { status: "SUCCEEDED", stripeChargeId: idOf(pi.latest_charge) } });
    const job = payment.job;
    if (job.status === "OPEN" && job.acceptedQuote && pi.metadata.quoteId === job.acceptedQuote.id) {
      await db.$transaction([
        db.job.update({ where: { id: job.id }, data: { status: "ASSIGNED", scheduledDate: job.acceptedQuote.proposedDate ?? job.preferredDate } }),
        db.quote.update({ where: { id: job.acceptedQuote.id }, data: { status: "ACCEPTED" } }),
        db.quote.updateMany({ where: { jobId: job.id, id: { not: job.acceptedQuote.id }, status: "SUBMITTED" }, data: { status: "DECLINED" } }),
      ]);
      await issueJobCodes(job.id).catch((e) => console.error("job door codes failed", e));
      await notifyHired(job.id);
      return "assigned";
    }
    return job.status.toLowerCase();
  }
  if (pi.status === "canceled") await db.jobPayment.update({ where: { id: payment.id }, data: { status: "CANCELED" } });
  return pi.status;
}

async function loadJob(jobId: string) {
  return db.job.findUniqueOrThrow({ where: { id: jobId }, include: { acceptedQuote: { include: { provider: { include: { user: true } } } }, payments: true } });
}

async function transition(jobId: string, action: Parameters<typeof nextJobStatus>[0], data: Record<string, unknown> = {}) {
  const job = await db.job.findUniqueOrThrow({ where: { id: jobId } });
  const to = nextJobStatus(action, job.status as JobStatus);
  if (!to) throw new JobError("That isn't possible for this job right now.");
  // Conditional update so two clicks (or a click + the daily job) can't both apply.
  const { count } = await db.job.updateMany({ where: { id: jobId, status: job.status }, data: { status: to, ...data } });
  if (!count) throw new JobError("This job was just updated. Please refresh.");
  return to;
}

export async function markComplete(providerUserId: string, jobId: string, note: string) {
  const job = await loadJob(jobId);
  if (job.acceptedQuote?.provider.userId !== providerUserId) throw new JobError("Job not found.");
  if (usesChecklist(job.category)) {
    const [items, photoCount] = await Promise.all([db.jobChecklistItem.findMany({ where: { jobId }, select: { doneAt: true } }), db.jobPhoto.count({ where: { jobId } })]);
    const blockers = completionBlockers({ items, photoCount, minPhotos: job.minPhotos });
    if (blockers.length) throw new JobError(`Almost there: ${blockers.join(" and ")}.`);
  }
  await transition(jobId, "mark_complete", { completedAt: new Date(), completionNote: note.trim().slice(0, 1000) || null, releaseAfter: new Date(Date.now() + AUTO_RELEASE_DAYS * 86_400_000) });
  await revokeJobCodes(jobId).catch((e) => console.error("remove job door codes failed", e));
  await notifyJobDone(jobId);
}

/** Sends the provider's share (quote − 5%) to their Stripe account. Retried by the daily job until it succeeds. */
export async function payOutJob(jobId: string) {
  const job = await loadJob(jobId);
  if (job.status !== "PAID" || job.paidOutAt || job.providerPayoutCents <= 0) return "skipped";
  const provider = job.acceptedQuote?.provider.user;
  if (!provider?.stripeAccountId || !provider.payoutsEnabled) return "provider_not_connected";
  const charge = job.payments.find((p) => p.kind === "CHARGE" && p.status === "SUCCEEDED" && p.stripeChargeId);
  if (!charge) return "no_charge";
  const t = await stripe().transfers.create(
    { amount: job.providerPayoutCents, currency: "usd", destination: provider.stripeAccountId, source_transaction: charge.stripeChargeId!, transfer_group: `job_${job.id}`, metadata: { jobId: job.id } },
    { idempotencyKey: `job-payout-${job.id}` },
  );
  await db.jobPayment.upsert({ where: { stripeId: t.id }, create: { jobId: job.id, kind: "PAYOUT", amountCents: job.providerPayoutCents, stripeId: t.id, status: "SUCCEEDED" }, update: {} });
  await db.job.update({ where: { id: job.id }, data: { paidOutAt: new Date() } });
  return "paid";
}

export async function releaseJob(ownerId: string | "system", jobId: string) {
  const job = await loadJob(jobId);
  if (ownerId !== "system" && job.ownerId !== ownerId) throw new JobError("Job not found.");
  await transition(jobId, ownerId === "system" ? "auto_release" : "release");
  return payOutJob(jobId).catch((e) => `error: ${e.message}`);
}

export async function reportProblem(ownerId: string, jobId: string, note: string) {
  const job = await loadJob(jobId);
  if (job.ownerId !== ownerId) throw new JobError("Job not found.");
  if (note.trim().length < 10) throw new JobError("Tell us what went wrong in a sentence or two.");
  await transition(jobId, "report_problem", { disputeNote: note.trim().slice(0, 2000) });
}

async function refundJobCharge(jobId: string, reason: string) {
  const charges = await db.jobPayment.findMany({ where: { jobId, kind: "CHARGE", status: "SUCCEEDED" } });
  for (const c of charges) {
    const r = await stripe().refunds.create({ payment_intent: c.stripeId!, metadata: { jobId, reason } }, { idempotencyKey: `job-refund-${c.stripeId}` });
    await db.jobPayment.upsert({ where: { stripeId: r.id }, create: { jobId, kind: "REFUND", amountCents: c.amountCents, stripeId: r.id, status: "SUCCEEDED" }, update: {} });
  }
}

/** Owner or provider cancels before the work is done. Anything paid is refunded in full. */
export async function cancelJob(userId: string, jobId: string) {
  const job = await loadJob(jobId);
  const by = job.ownerId === userId ? "owner" : job.acceptedQuote?.provider.userId === userId ? "provider" : null;
  if (!by) throw new JobError("Job not found.");
  await transition(jobId, "cancel", { cancelledAt: new Date(), cancelledBy: by });
  for (const p of job.payments.filter((p) => p.kind === "CHARGE" && p.status === "PENDING")) {
    if (p.stripeId) await stripe().paymentIntents.cancel(p.stripeId).catch(() => {});
    await db.jobPayment.update({ where: { id: p.id }, data: { status: "CANCELED" } });
  }
  await revokeJobCodes(jobId).catch((e) => console.error("remove job door codes failed", e));
  await refundJobCharge(jobId, `Cancelled by ${by}`);
  await db.quote.updateMany({ where: { jobId, status: { in: ["SUBMITTED", "ACCEPTED"] } }, data: { status: "WITHDRAWN" } });
}

/** Admin decision on a reported problem: pay the provider, or refund the owner in full. */
export async function resolveDispute(jobId: string, outcome: "pay" | "refund") {
  if (outcome === "pay") {
    await transition(jobId, "resolve_pay");
    return payOutJob(jobId).catch((e) => `error: ${e.message}`);
  }
  await transition(jobId, "resolve_refund", { cancelledAt: new Date(), cancelledBy: "admin" });
  await refundJobCharge(jobId, "Dispute resolved with refund");
  return "refunded";
}

/** Daily: auto-release completed jobs after the waiting period and retry provider payouts. */
export async function runDailyJobTasks() {
  const due = await db.job.findMany({ where: { status: "COMPLETED", releaseAfter: { lte: new Date() } }, select: { id: true } });
  const released: Record<string, string> = {};
  for (const { id } of due) released[id] = String(await releaseJob("system", id).catch((e) => `error: ${e.message}`));
  const unpaid = await db.job.findMany({ where: { status: "PAID", paidOutAt: null }, select: { id: true } });
  const payouts: Record<string, string> = {};
  for (const { id } of unpaid) payouts[id] = String(await payOutJob(id).catch((e) => `error: ${e.message}`));
  return { released, payouts };
}

// ---------- Turnover cleanings ----------

const shortDate = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

/** Title and details for the cleaning after a booking's checkout (used for auto and one-tap requests). */
export async function turnoverDetails(bookingId: string) {
  const b = await db.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { listing: true } });
  const next = await db.booking.findFirst({
    where: { listingId: b.listingId, status: "CONFIRMED", checkIn: { gte: b.checkOut } },
    orderBy: { checkIn: "asc" },
    select: { checkIn: true },
  });
  const sameDay = next && +next.checkIn === +b.checkOut;
  return {
    booking: b,
    title: `Turnover cleaning after checkout ${shortDate.format(b.checkOut)}`,
    description: [
      `Guests check out ${shortDate.format(b.checkOut)} by ${b.listing.checkOutTime}.`,
      next ? `Next guests check in ${sameDay ? "the same day" : shortDate.format(next.checkIn)} from ${b.listing.checkInTime}${sameDay ? ", so the clean must be finished before then" : ""}.` : "No next booking yet.",
      `${b.listing.bedrooms} bedroom${b.listing.bedrooms === 1 ? "" : "s"}, ${b.listing.bathrooms.toString()} bath${b.listing.bathrooms.toString() === "1" ? "" : "s"}, sleeps ${b.listing.maxGuests}.`,
      "Usual turnover: strip and remake beds, bathrooms, kitchen, floors, trash, restock basics.",
    ].join("\n"),
  };
}

/**
 * Called when a booking is confirmed: if the owner turned on automatic turnover requests and has an
 * approved regular cleaner, send that cleaner a request for checkout day. Never creates duplicates.
 */
export async function autoRequestTurnover(bookingId: string) {
  const b = await db.booking.findUnique({ where: { id: bookingId }, include: { listing: { include: { regularCleaner: true } } } });
  if (!b || b.status !== "CONFIRMED") return "skipped";
  const l = b.listing;
  if (!l.autoRequestCleaning || !l.regularCleaner || l.regularCleaner.status !== "APPROVED") return "not_enabled";
  const existing = await db.job.findFirst({ where: { bookingId, category: "cleaning", status: { not: "CANCELLED" } } });
  if (existing) return "exists";
  const d = await turnoverDetails(bookingId);
  await createJob(l.ownerId, { listingId: l.id, category: "cleaning", title: d.title, description: d.description, preferredDate: b.checkOut, flexibleDate: false, bookingId, providerId: l.regularCleaner.id });
  return "requested";
}

/** Called when a booking is cancelled: cancel its cleaning jobs (refunding anything paid). */
export async function cancelJobsForBooking(bookingId: string) {
  const jobs = await db.job.findMany({ where: { bookingId, status: { in: ["OPEN", "ASSIGNED"] } }, select: { id: true, ownerId: true } });
  for (const j of jobs) await cancelJob(j.ownerId, j.id).catch((e) => console.error("cancel job for booking failed", j.id, e));
  return jobs.length;
}

// ---------- Cleaning checklist ----------

/** Hired provider ticks or unticks a checklist item while the job is in progress. */
export async function setChecklistItem(providerUserId: string, jobId: string, itemId: string, done: boolean) {
  const job = await loadJob(jobId);
  if (job.acceptedQuote?.provider.userId !== providerUserId) throw new JobError("Job not found.");
  if (job.status !== "ASSIGNED") throw new JobError("This job isn't in progress.");
  const { count } = await db.jobChecklistItem.updateMany({ where: { id: itemId, jobId }, data: { doneAt: done ? new Date() : null } });
  if (!count) throw new JobError("Checklist item not found.");
}

/** Who may see a job's proof photos: the owner, the hired provider, and admins. */
export async function canSeeJobPhotos(user: { id: string; roles: string[] }, jobId: string) {
  if (user.roles.includes("ADMIN")) return true;
  const job = await db.job.findUnique({ where: { id: jobId }, select: { ownerId: true, acceptedQuote: { select: { provider: { select: { userId: true } } } } } });
  return Boolean(job && (job.ownerId === user.id || job.acceptedQuote?.provider.userId === user.id));
}
