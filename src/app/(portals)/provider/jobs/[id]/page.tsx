import { Suspense } from "react";
import { doorCodesFor } from "@/lib/locks";
import { DoorCodes } from "@/components/locks/DoorCodes";
import { ChecklistPreview, ChecklistReview, ChecklistWork } from "@/components/jobs/Checklist";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { connection } from "next/server";
import { requirePortal } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { getOrCreateProfile } from "@/lib/providers";
import { providerCanSee } from "@/lib/jobs";
import { JOB_STATUS_LABEL, categoryNoun, jobAmounts, type JobStatus } from "@/lib/services";
import { cancelJobAction, markCompleteAction, sendJobMessage, submitJobReview, submitQuoteAction } from "@/app/actions/jobs";
import { PortalShell } from "@/components/layout/PortalShell";
import { providerNav } from "@/components/layout/portal-nav";
import { Card, Chip } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { TextAreaField } from "@/components/ui/Select";
import { ActionForm } from "@/components/owner/ActionForm";
import { JobThread } from "@/components/services/JobThread";
import { CancelBooking } from "@/components/booking/CancelBooking";
import { ReviewForm } from "@/components/booking/ReviewForm";
import { formatCents } from "@/lib/money";
import { centsToDollarsInput } from "@/lib/pricing";
import { todayIn, toISODate } from "@/lib/dates";

export const metadata: Metadata = { title: "Job", robots: { index: false } };
const fmt = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export default function Page({ params }: PageProps<"/provider/jobs/[id]">) {
  return (
    <Suspense fallback={<div className="h-screen" aria-hidden="true" />}>
      <Job params={params} />
    </Suspense>
  );
}

async function Job({ params }: { params: PageProps<"/provider/jobs/[id]">["params"] }) {
  const { id } = await params;
  await connection();
  const user = await requirePortal("provider", `/provider/jobs/${id}`);
  const profile = await getOrCreateProfile(user);
  const job = await db.job.findUnique({
    where: { id },
    include: { listing: { select: { title: true, city: true, region: true, addressLine1: true, postalCode: true, bedrooms: true, bathrooms: true, timeZone: true } }, owner: { select: { name: true } }, quotes: true, acceptedQuote: true, reviews: true, checklist: { orderBy: { position: "asc" } } },
  });
  if (!job || !providerCanSee(profile, job)) notFound();
  const myQuote = job.quotes.find((q) => q.providerId === profile.id);
  const hired = job.acceptedQuote?.providerId === profile.id && job.status !== "OPEN";
  const status = job.status as JobStatus;
  const photos = hired ? await db.jobPhoto.findMany({ where: { jobId: job.id }, orderBy: { createdAt: "asc" }, select: { id: true, caption: true, createdAt: true } }) : [];
  const doorCodes = hired && job.status === "ASSIGNED" ? await doorCodesFor({ jobId: job.id }) : [];
  const messages = await db.jobMessage.findMany({ where: { jobId: job.id, providerId: profile.id }, orderBy: { createdAt: "asc" }, include: { sender: { select: { id: true, name: true } } } });
  const myReview = job.reviews.find((r) => r.reviewerId === user.id);

  return (
    <PortalShell portal="Services" user={user} nav={providerNav("/provider/jobs")}>
      <div className="flex flex-col gap-6 pt-6 sm:pt-10">
        <Link href="/provider/jobs" className="inline-flex min-h-11 items-center self-start text-brand underline underline-offset-4">← All jobs</Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{job.title}</h1>
          <Chip>{hired || status === "OPEN" ? JOB_STATUS_LABEL[status] : "Another pro was chosen"}</Chip>
        </div>
        <p className="text-ink-muted">
          {categoryNoun(job.category)} · {job.listing.city}, {job.listing.region} · {job.listing.bedrooms} bd / {job.listing.bathrooms.toString()} ba · for {job.owner.name.split(" ")[0]}
          {job.preferredDate ? ` · preferred ${fmt.format(job.preferredDate)}${job.flexibleDate ? " (flexible)" : ""}` : ""}
        </p>
        <Card className="flex flex-col gap-4">
          <p className="whitespace-pre-line">{job.description}</p>
          {!hired ? <ChecklistPreview items={job.checklist} minPhotos={job.minPhotos} /> : null}
        </Card>

        {hired ? (
          <Card className="flex flex-col gap-2">
            <h2 className="text-xl font-bold">You&apos;re hired 🎉</h2>
            <p>{job.scheduledDate ? `Scheduled for ${fmt.format(job.scheduledDate)}. ` : ""}Address: <strong>{job.listing.addressLine1}, {job.listing.city}, {job.listing.region} {job.listing.postalCode}</strong></p>
            <DoorCodes codes={doorCodes} timeZone={job.listing.timeZone} />
            <p className="text-ink-muted">Quote {formatCents(job.quoteCents)} − Keyvaga fee {formatCents(job.providerFeeCents)} = <strong className="text-ink">{formatCents(job.providerPayoutCents)}</strong> to you</p>
          </Card>
        ) : null}

        {status === "OPEN" && profile.status === "APPROVED" ? (
          <Card className="flex flex-col gap-4">
            <h2 className="text-xl font-bold">{myQuote ? "Update your quote" : "Send a quote"}</h2>
            <ActionForm action={submitQuoteAction.bind(null, job.id)} submitLabel={myQuote ? "Update quote" : "Send quote"}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Your price ($)" id="amount" inputMode="decimal" required defaultValue={myQuote ? centsToDollarsInput(myQuote.amountCents) : ""} placeholder="150" hint={myQuote ? `You'd receive ${formatCents(jobAmounts(myQuote.amountCents).providerPayoutCents)} after Keyvaga's 5% fee.` : "Keyvaga keeps 5% when you're paid."} />
                <Field label="Date you can do it" id="proposedDate" type="date" min={toISODate(todayIn())} defaultValue={myQuote?.proposedDate ? toISODate(myQuote.proposedDate) : job.preferredDate ? toISODate(job.preferredDate) : undefined} />
              </div>
              <TextAreaField label="Message to the owner" id="message" rows={3} maxLength={2000} defaultValue={myQuote?.message} hint="What's included, how long it takes, anything you need from them." />
            </ActionForm>
          </Card>
        ) : null}

        {hired && status === "ASSIGNED" && (job.checklist.length || job.minPhotos) ? (
          <Card><ChecklistWork jobId={job.id} items={job.checklist} photos={photos} minPhotos={job.minPhotos} /></Card>
        ) : null}
        {hired && status !== "ASSIGNED" && (job.checklist.length || photos.length) ? (
          <Card><ChecklistReview items={job.checklist} photos={photos} minPhotos={job.minPhotos} /></Card>
        ) : null}

        {hired && status === "ASSIGNED" ? (
          <Card className="flex flex-col gap-4">
            <h2 className="text-xl font-bold">Finished the job?</h2>
            <ActionForm action={markCompleteAction.bind(null, job.id)} submitLabel="Mark as done">
              <TextAreaField label="Note for the owner (optional)" id="note" rows={2} maxLength={1000} placeholder="e.g. All done, linens restocked, noticed a dripping faucet in bath 2." />
            </ActionForm>
            <p className="text-sm text-ink-muted">You&apos;re paid when the owner confirms, or automatically 3 days after you mark it done.</p>
            <details>
              <summary className="min-h-11 cursor-pointer text-danger underline underline-offset-4">Can&apos;t do this job?</summary>
              <div className="mt-3"><CancelBooking action={cancelJobAction.bind(null, job.id)} label="Cancel job" preview="The owner will get a full refund. Please message them first." /></div>
            </details>
          </Card>
        ) : null}
        {hired && status === "COMPLETED" ? <p className="rounded-control bg-soft px-4 py-3 text-on-soft">Marked as done. Waiting for the owner to confirm; payment is released automatically 3 days after you finished.</p> : null}
        {hired && status === "DISPUTED" ? <p className="rounded-control bg-warn-soft px-4 py-3 text-on-warn-soft">The owner reported a problem: “{job.disputeNote}”. Keyvaga will review and contact you.</p> : null}
        {hired && status === "PAID" ? (
          <Card className="flex flex-col gap-3">
            <p className="font-semibold">{job.paidOutAt ? `Paid ${formatCents(job.providerPayoutCents)} ✓` : `Payment of ${formatCents(job.providerPayoutCents)} released. It's sent as soon as your payout account is set up.`}</p>
            <h2 className="text-xl font-bold">{myReview ? "Your review of the owner" : "Review this owner"}</h2>
            {myReview ? <p className="text-ink-muted">{"★".repeat(myReview.rating)} {myReview.body}</p> : <ReviewForm action={submitJobReview.bind(null, job.id)} />}
          </Card>
        ) : null}

        <Card className="flex flex-col gap-4">
          <h2 className="text-xl font-bold">Messages with {job.owner.name.split(" ")[0]}</h2>
          <JobThread meId={user.id} messages={messages} action={sendJobMessage.bind(null, job.id, profile.id)} emptyText="Have a question before quoting? Ask the owner here." />
        </Card>
      </div>
    </PortalShell>
  );
}
