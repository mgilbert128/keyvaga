import { Suspense } from "react";
import { ChecklistReview } from "@/components/jobs/Checklist";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { connection } from "next/server";
import { requirePortal } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { providerStats } from "@/lib/providers";
import { syncJobPayment } from "@/lib/jobs";
import { JOB_STATUS_LABEL, categoryNoun, jobAmounts, responseTimeLabel, type JobStatus } from "@/lib/services";
import { acceptQuoteAction, cancelJobAction, releaseAction, reportProblemAction, sendJobMessage, submitJobReview } from "@/app/actions/jobs";
import { PortalShell } from "@/components/layout/PortalShell";
import { ownerNav } from "@/components/layout/portal-nav";
import { Card, Chip } from "@/components/ui/Card";
import { Button, buttonClass } from "@/components/ui/Button";
import { TextAreaField } from "@/components/ui/Select";
import { ActionForm } from "@/components/owner/ActionForm";
import { ActionButton } from "@/components/services/ActionButton";
import { JobThread } from "@/components/services/JobThread";
import { Stars } from "@/components/services/Stars";
import { CancelBooking } from "@/components/booking/CancelBooking";
import { ReviewForm } from "@/components/booking/ReviewForm";
import { formatCents } from "@/lib/money";

export const metadata: Metadata = { title: "Service job", robots: { index: false } };
const fmt = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const dt = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });

export default function Page({ params, searchParams }: PageProps<"/owner/jobs/[id]">) {
  return (
    <Suspense fallback={<div className="h-screen" aria-hidden="true" />}>
      <Job params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Job({ params, searchParams }: Pick<PageProps<"/owner/jobs/[id]">, "params" | "searchParams">) {
  const { id } = await params;
  const sp = await searchParams;
  await connection();
  const user = await requirePortal("owner", `/owner/jobs/${id}`);
  const load = () => db.job.findUnique({
    where: { id },
    include: {
      listing: { select: { title: true, city: true } },
      booking: { select: { id: true, checkOut: true } },
      targetProvider: { select: { id: true, businessName: true, slug: true } },
      quotes: { orderBy: { amountCents: "asc" }, include: { provider: { select: { id: true, businessName: true, slug: true } } } },
      acceptedQuote: { include: { provider: { select: { id: true, businessName: true, slug: true } } } },
      payments: true,
      reviews: true,
      checklist: { orderBy: { position: "asc" } },
      photos: { orderBy: { createdAt: "asc" }, select: { id: true, caption: true, createdAt: true } },
    },
  });
  let job = await load();
  if (!job || job.ownerId !== user.id) notFound();
  // Returning from Stripe checkout: confirm right away instead of waiting for the webhook.
  if (job.status === "OPEN" && job.payments.some((p) => p.kind === "CHARGE" && p.status === "PENDING")) {
    for (const p of job.payments.filter((p) => p.kind === "CHARGE" && p.status === "PENDING" && p.stripeId)) await syncJobPayment(p.stripeId!).catch(() => {});
    job = (await load())!;
  }
  await db.job.update({ where: { id: job.id }, data: { ownerLastReadAt: new Date() } });

  const stats = await providerStats(job.quotes.map((q) => q.providerId));
  const threadProviders = [...new Map([...(job.targetProvider ? [job.targetProvider] : []), ...job.quotes.map((q) => q.provider)].map((p) => [p.id, p])).values()];
  const withId = typeof sp.with === "string" && threadProviders.some((p) => p.id === sp.with) ? sp.with : (job.acceptedQuote?.providerId ?? threadProviders[0]?.id);
  const messages = withId ? await db.jobMessage.findMany({ where: { jobId: job.id, providerId: withId }, orderBy: { createdAt: "asc" }, include: { sender: { select: { id: true, name: true } } } }) : [];
  const status = job.status as JobStatus;
  const myReview = job.reviews.find((r) => r.reviewerId === user.id);
  const error = typeof sp.error === "string" ? sp.error : null;
  const provider = job.acceptedQuote?.provider;

  return (
    <PortalShell portal="Owner" user={user} nav={ownerNav("/owner/jobs")}>
      <div className="flex flex-col gap-6 pt-6 sm:pt-10">
        <Link href="/owner/jobs" className="inline-flex min-h-11 items-center self-start text-brand underline underline-offset-4">← All jobs</Link>
        {sp.created ? <p role="status" className="rounded-control bg-soft px-4 py-3 font-medium text-on-soft">{job.targetProvider ? `Request sent to ${job.targetProvider.businessName}.` : `Job posted. Pros near ${job.listing.city} can now send quotes.`}</p> : null}
        {sp.paid && status === "ASSIGNED" ? <p role="status" className="rounded-control bg-soft px-4 py-3 text-lg font-semibold text-on-soft">Booked! {provider?.businessName} is scheduled.</p> : null}
        {error ? <p role="alert" className="rounded-control border border-danger/30 bg-danger/5 px-4 py-3 font-medium text-danger">{error}</p> : null}

        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{job.title}</h1>
          <Chip tone={status === "COMPLETED" || status === "DISPUTED" ? "warn" : "soft"}>{JOB_STATUS_LABEL[status]}</Chip>
        </div>
        <p className="text-ink-muted">
          {job.listing.title} · {categoryNoun(job.category)}
          {job.preferredDate ? ` · preferred ${fmt.format(job.preferredDate)}${job.flexibleDate ? " (flexible)" : ""}` : ""}
          {job.booking ? ` · after the checkout on ${fmt.format(job.booking.checkOut)}` : ""}
        </p>
        <Card><p className="whitespace-pre-line">{job.description}</p></Card>

        {status === "OPEN" ? (
          <Card className="flex flex-col gap-4">
            <h2 className="text-xl font-bold">Quotes</h2>
            {job.quotes.filter((q) => q.status === "SUBMITTED").length === 0 ? (
              <p className="text-ink-muted">{job.targetProvider ? `Waiting for ${job.targetProvider.businessName} to send a quote.` : `Waiting for quotes from pros near ${job.listing.city}.`}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {job.quotes.filter((q) => q.status === "SUBMITTED").map((q) => {
                  const s = stats.get(q.providerId)!;
                  const a = jobAmounts(q.amountCents);
                  return (
                    <li key={q.id} className="flex flex-col gap-3 rounded-control border border-line p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-col gap-1">
                        <Link href={`/owner/services/${q.provider.slug}`} className="text-lg font-bold hover:underline">{q.provider.businessName}</Link>
                        <p className="text-sm text-ink-muted"><Stars rating={s.rating} count={s.reviewCount || undefined} />{responseTimeLabel(s.responseHours) ? ` · ${responseTimeLabel(s.responseHours)}` : ""}</p>
                        {q.proposedDate ? <p className="text-sm">Can do it {fmt.format(q.proposedDate)}</p> : null}
                        {q.message ? <p className="whitespace-pre-line text-sm text-ink-muted">“{q.message}”</p> : null}
                      </div>
                      <div className="flex flex-col items-start gap-2 sm:items-end">
                        <p className="text-2xl font-bold">{formatCents(q.amountCents)}</p>
                        <p className="text-xs text-ink-muted">+ {formatCents(a.ownerFeeCents)} Keyvaga fee = {formatCents(a.ownerTotalCents)}</p>
                        <form action={acceptQuoteAction.bind(null, job.id, q.id)}><Button type="submit">Accept and pay</Button></form>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="text-sm text-ink-muted">Keyvaga holds your payment and only releases it to the pro after the job is done.</p>
          </Card>
        ) : null}

        {provider && status !== "OPEN" ? (
          <Card className="flex flex-col gap-2">
            <h2 className="text-xl font-bold">{provider.businessName}</h2>
            <p className="text-ink-muted">
              {job.scheduledDate ? `Scheduled for ${fmt.format(job.scheduledDate)} · ` : ""}{formatCents(job.quoteCents)} + {formatCents(job.ownerFeeCents)} Keyvaga fee = <strong className="text-ink">{formatCents(job.ownerTotalCents)}</strong> paid
            </p>
          </Card>
        ) : null}

        {status !== "OPEN" && status !== "CANCELLED" && (job.checklist.length || job.photos.length) ? (
          <Card><ChecklistReview items={job.checklist} photos={job.photos} minPhotos={job.minPhotos} /></Card>
        ) : null}

        {status === "COMPLETED" ? (
          <Card className="flex flex-col gap-4">
            <h2 className="text-xl font-bold">{provider?.businessName} marked this job as done</h2>
            {job.completionNote ? <p className="whitespace-pre-line rounded-control bg-soft px-4 py-3 text-on-soft">“{job.completionNote}”</p> : null}
            <p className="text-ink-muted">{job.checklist.length || job.photos.length ? "Check the checklist and photos above. " : ""}If everything looks good, release the payment. Otherwise report a problem. Payment is released automatically on {job.releaseAfter ? dt.format(job.releaseAfter) : "the release date"}.</p>
            <ActionButton action={releaseAction.bind(null, job.id)} label="Everything's good: release payment" />
            <details className="group">
              <summary className={buttonClass("ghost", "list-none text-danger [&::-webkit-details-marker]:hidden")}>Report a problem</summary>
              <div className="mt-3">
                <ActionForm action={reportProblemAction.bind(null, job.id)} submitLabel="Report problem">
                  <TextAreaField label="What went wrong?" id="note" rows={3} maxLength={2000} required />
                </ActionForm>
              </div>
            </details>
          </Card>
        ) : null}
        {status === "DISPUTED" ? <p className="rounded-control bg-warn-soft px-4 py-3 text-on-warn-soft">You reported a problem. Payment is on hold while Keyvaga reviews it. We&apos;ll be in touch.</p> : null}
        {status === "CANCELLED" ? <p className="rounded-control bg-warn-soft px-4 py-3 text-on-warn-soft">This job was cancelled{job.cancelledBy ? ` by ${job.cancelledBy === "owner" ? "you" : job.cancelledBy === "provider" ? "the provider" : "Keyvaga"}` : ""}. Any payment was refunded in full.</p> : null}

        {status === "PAID" ? (
          <Card className="flex flex-col gap-3">
            <h2 className="text-xl font-bold">{myReview ? "Your review" : `Review ${provider?.businessName}`}</h2>
            {myReview ? (
              <>
                <p className="text-xl text-brand" aria-label={`${myReview.rating} out of 5 stars`}>{"★".repeat(myReview.rating)}<span className="text-line-strong">{"★".repeat(5 - myReview.rating)}</span></p>
                <p className="whitespace-pre-line text-ink-muted">{myReview.body}</p>
              </>
            ) : <ReviewForm action={submitJobReview.bind(null, job.id)} />}
          </Card>
        ) : null}

        {threadProviders.length ? (
          <Card className="flex flex-col gap-4">
            <h2 className="text-xl font-bold">Messages</h2>
            {threadProviders.length > 1 ? (
              <nav aria-label="Conversations" className="flex flex-wrap gap-2">
                {threadProviders.map((p) => (
                  <Link key={p.id} href={`/owner/jobs/${job.id}?with=${p.id}`} aria-current={p.id === withId ? "page" : undefined} className="inline-flex min-h-11 items-center rounded-full border border-line px-4 aria-[current=page]:border-brand aria-[current=page]:bg-soft aria-[current=page]:font-semibold">{p.businessName}</Link>
                ))}
              </nav>
            ) : null}
            {withId ? <JobThread meId={user.id} messages={messages} action={sendJobMessage.bind(null, job.id, withId)} emptyText={`No messages with ${threadProviders.find((p) => p.id === withId)?.businessName} yet.`} /> : null}
          </Card>
        ) : null}

        {status === "OPEN" || status === "ASSIGNED" ? (
          <Card className="flex flex-col gap-3">
            <h2 className="text-lg font-bold">Cancel this job</h2>
            <p className="text-sm text-ink-muted">{status === "ASSIGNED" ? "You'll get a full refund. Please give the pro as much notice as possible." : "No charge. Pros will stop sending quotes."}</p>
            <CancelBooking action={cancelJobAction.bind(null, job.id)} label="Cancel job" preview={status === "ASSIGNED" ? `${formatCents(job.ownerTotalCents)} will be refunded to your card.` : "This job will be closed."} />
          </Card>
        ) : null}
      </div>
    </PortalShell>
  );
}
