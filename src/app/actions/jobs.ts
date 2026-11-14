"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/dal";
import { canReviewListings } from "@/lib/listing-policy";
import { JobError, cancelJob, createJob, markComplete, providerCanSee, releaseJob, reportProblem, resolveDispute, startAcceptQuote, submitQuote } from "@/lib/jobs";
import { parseISODate } from "@/lib/dates";
import { dollarsToCents } from "@/lib/pricing";
import { stripeConfigured } from "@/lib/stripe";

export type JobResult = { ok?: boolean; message?: string } | undefined;

async function user(role: "OWNER" | "PROVIDER") {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  if (!u.roles.includes(role)) redirect(`/no-access?portal=${role === "OWNER" ? "owner" : "provider"}`);
  return u;
}

const fail = (e: unknown): JobResult => {
  if (e instanceof JobError) return { message: e.message };
  console.error(e);
  return { message: "Something went wrong. Please try again." };
};

function refreshJob(jobId: string) {
  revalidatePath(`/owner/jobs/${jobId}`);
  revalidatePath(`/provider/jobs/${jobId}`);
  revalidatePath("/owner/jobs");
  revalidatePath("/provider/jobs");
  revalidatePath("/provider");
  revalidatePath("/owner");
}

export async function createJobAction(_prev: JobResult, fd: FormData): Promise<JobResult> {
  const u = await user("OWNER");
  let id: string;
  try {
    const job = await createJob(u.id, {
      listingId: String(fd.get("listingId") ?? ""),
      category: String(fd.get("category") ?? ""),
      title: String(fd.get("title") ?? ""),
      description: String(fd.get("description") ?? ""),
      preferredDate: parseISODate(String(fd.get("preferredDate") ?? "")),
      flexibleDate: fd.get("flexibleDate") === "on",
      bookingId: String(fd.get("bookingId") ?? "") || null,
      providerId: String(fd.get("providerId") ?? "") || null,
    });
    id = job.id;
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/owner/jobs");
  redirect(`/owner/jobs/${id}?created=1`);
}

export async function submitQuoteAction(jobId: string, _prev: JobResult, fd: FormData): Promise<JobResult> {
  const u = await user("PROVIDER");
  const profile = await db.providerProfile.findUnique({ where: { userId: u.id } });
  if (!profile) return { message: "Set up your business profile first." };
  const amountCents = dollarsToCents(String(fd.get("amount") ?? ""));
  if (!amountCents) return { message: "Enter your price in dollars, like 150." };
  try {
    await submitQuote({ ...profile, userId: u.id }, jobId, { amountCents, proposedDate: parseISODate(String(fd.get("proposedDate") ?? "")), message: String(fd.get("message") ?? "") });
  } catch (e) {
    return fail(e);
  }
  refreshJob(jobId);
  return { ok: true, message: "Quote sent. The owner will be notified." };
}

export async function acceptQuoteAction(jobId: string, quoteId: string) {
  const u = await user("OWNER");
  if (!stripeConfigured()) redirect(`/owner/jobs/${jobId}?error=${encodeURIComponent("Online payment isn't switched on yet.")}`);
  try {
    await startAcceptQuote(u.id, jobId, quoteId);
  } catch (e) {
    redirect(`/owner/jobs/${jobId}?error=${encodeURIComponent(e instanceof JobError ? e.message : "Couldn't start payment. Please try again.")}`);
  }
  redirect(`/owner/jobs/${jobId}/pay`);
}

export async function markCompleteAction(jobId: string, _prev: JobResult, fd: FormData): Promise<JobResult> {
  const u = await user("PROVIDER");
  try {
    await markComplete(u.id, jobId, String(fd.get("note") ?? ""));
  } catch (e) {
    return fail(e);
  }
  refreshJob(jobId);
  return { ok: true, message: "Marked as done. You'll be paid when the owner confirms, or automatically in 3 days." };
}

export async function releaseAction(jobId: string): Promise<JobResult> {
  const u = await user("OWNER");
  try {
    await releaseJob(u.id, jobId);
  } catch (e) {
    return fail(e);
  }
  refreshJob(jobId);
  return { ok: true, message: "Payment released. Thanks!" };
}

export async function reportProblemAction(jobId: string, _prev: JobResult, fd: FormData): Promise<JobResult> {
  const u = await user("OWNER");
  try {
    await reportProblem(u.id, jobId, String(fd.get("note") ?? ""));
  } catch (e) {
    return fail(e);
  }
  refreshJob(jobId);
  revalidatePath("/admin");
  return { ok: true, message: "Thanks for letting us know. Payment is on hold while Keyvaga looks into it." };
}

export async function cancelJobAction(jobId: string): Promise<JobResult> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  try {
    await cancelJob(u.id, jobId);
  } catch (e) {
    return fail(e);
  }
  refreshJob(jobId);
  return { ok: true, message: "Job cancelled. Any payment has been refunded in full." };
}

export async function resolveDisputeAction(jobId: string, outcome: "pay" | "refund") {
  const u = await getCurrentUser();
  if (!u || !canReviewListings(u)) redirect("/no-access?portal=admin");
  try {
    await resolveDispute(jobId, outcome);
  } catch (e) {
    console.error("resolve dispute failed", e);
  }
  refreshJob(jobId);
  revalidatePath("/admin");
}

/** Message between the job's owner and one provider. */
export async function sendJobMessage(jobId: string, providerId: string, _prev: JobResult, fd: FormData): Promise<JobResult> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  const body = String(fd.get("body") ?? "").trim();
  if (!body) return { message: "Write a message first." };
  if (body.length > 4000) return { message: "Keep messages under 4,000 characters." };
  const job = await db.job.findUnique({ where: { id: jobId }, include: { listing: { select: { city: true, region: true } }, quotes: { select: { providerId: true } }, acceptedQuote: { select: { providerId: true } } } });
  const profile = await db.providerProfile.findUnique({ where: { id: providerId } });
  if (!job || !profile) return { message: "Conversation not found." };
  const isOwner = job.ownerId === u.id;
  const isProvider = profile.userId === u.id && providerCanSee(profile, job);
  // Owners can message providers they sent the job to or who quoted.
  const ownerMayMessage = isOwner && (job.targetProviderId === providerId || job.quotes.some((q) => q.providerId === providerId));
  if (!ownerMayMessage && !isProvider) return { message: "Conversation not found." };
  await db.jobMessage.create({ data: { jobId, providerId, senderId: u.id, body } });
  refreshJob(jobId);
  return { ok: true };
}

export async function submitJobReview(jobId: string, _prev: JobResult, fd: FormData): Promise<JobResult> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  const rating = Number(fd.get("rating"));
  const body = String(fd.get("body") ?? "").trim();
  if (!(rating >= 1 && rating <= 5)) return { message: "Choose a star rating." };
  if (body.length < 10) return { message: "Write at least a sentence or two." };
  const job = await db.job.findUnique({ where: { id: jobId }, include: { acceptedQuote: { include: { provider: true } } } });
  if (!job || job.status !== "PAID") return { message: "You can review once the job is paid." };
  const subject = job.ownerId === u.id ? "PROVIDER" : job.acceptedQuote?.provider.userId === u.id ? "OWNER" : null;
  if (!subject) return { message: "Job not found." };
  const existing = await db.jobReview.findUnique({ where: { jobId_reviewerId: { jobId, reviewerId: u.id } } });
  if (existing) return { message: "You've already reviewed this job." };
  await db.jobReview.create({ data: { jobId, reviewerId: u.id, subject, rating, body: body.slice(0, 2000) } });
  refreshJob(jobId);
  return { ok: true, message: "Thanks for your review!" };
}
