import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { connection } from "next/server";
import { requirePortal } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { previewCancellation, syncPaymentIntent } from "@/lib/bookings";
import { guestCancel } from "@/app/actions/bookings";
import { PortalShell } from "@/components/layout/PortalShell";
import { guestNav } from "@/components/layout/portal-nav";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { BookingStatusChip } from "@/components/booking/BookingStatus";
import { BookingSummary } from "@/components/booking/BookingSummary";
import { CancelBooking } from "@/components/booking/CancelBooking";
import { POLICY_INFO } from "@/lib/booking-money";
import { formatCents } from "@/lib/money";
import { todayIn } from "@/lib/dates";
import { accessReleaseDate, canReview, isAccessReleased } from "@/lib/checkin";
import { acceptHouseRules, submitReview } from "@/app/actions/guest";
import { ReviewForm } from "@/components/booking/ReviewForm";
import { Chip } from "@/components/ui/Card";
import { buttonClass } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Your trip", robots: { index: false } };
const releaseFmt = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
function timeLabel(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(2000, 0, 1, h, m)).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
}

export default function Page({ params, searchParams }: PageProps<"/trips/[id]">) {
  return (
    <Suspense fallback={<div className="h-screen" aria-hidden="true" />}>
      <Trip params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Trip({ params, searchParams }: Pick<PageProps<"/trips/[id]">, "params" | "searchParams">) {
  const { id } = await params;
  const sp = await searchParams;
  await connection(); // may talk to Stripe: only for real requests, never prefetches
  const user = await requirePortal("guest", `/trips/${id}`);
  let b = await db.booking.findUnique({ where: { id }, include: { listing: { select: { title: true, city: true, region: true, slug: true, checkInTime: true, checkOutTime: true, houseRules: true, addressLine1: true, addressLine2: true, postalCode: true, checkInInstructions: true, accessReleaseDays: true, guidebook: true, owner: { select: { name: true } } } }, payments: true, review: true } });
  if (!b || b.guestId !== user.id) notFound();

  // Coming back from Stripe: confirm the payment right away instead of waiting for the webhook.
  if (b.status === "PENDING_PAYMENT" || sp.paid) {
    for (const p of b.payments.filter((p) => p.status === "PENDING" && p.stripeId?.startsWith("pi_"))) {
      await syncPaymentIntent(p.stripeId!).catch((e) => console.error("sync failed", e));
    }
    b = await db.booking.findUniqueOrThrow({ where: { id }, include: { listing: { select: { title: true, city: true, region: true, slug: true, checkInTime: true, checkOutTime: true, houseRules: true, addressLine1: true, addressLine2: true, postalCode: true, checkInInstructions: true, accessReleaseDays: true, guidebook: true, owner: { select: { name: true } } } }, payments: true, review: true } });
  }
  if (b.status === "PENDING_PAYMENT") redirect(`/book/${b.id}`);

  const today = todayIn();
  const canCancel = b.status === "CONFIRMED" && b.checkOut > today;
  const preview = canCancel ? await previewCancellation(b.id, "guest") : null;
  const failedBalance = b.status === "CONFIRMED" && b.balanceStatus === "FAILED";
  const released = isAccessReleased({ status: b.status, checkIn: b.checkIn, checkOut: b.checkOut, releaseDays: b.listing.accessReleaseDays, today });
  const reviewable = canReview({ status: b.status, checkOut: b.checkOut, today, hasReview: Boolean(b.review) });

  return (
    <PortalShell user={user} nav={guestNav("/trips")}>
      <div className="flex flex-col gap-6 pt-6 sm:pt-10">
        <Link href="/trips" className="inline-flex min-h-11 items-center self-start text-brand underline underline-offset-4">← All trips</Link>
        {sp.paid && b.status === "CONFIRMED" ? (
          <p role="status" className="rounded-control bg-soft px-4 py-3 text-lg font-semibold text-on-soft">You&apos;re booked! 🎉 Your host has been notified.</p>
        ) : null}
        {b.status === "CANCELLED" && (b.cancelledBy === "guest" || b.cancelledBy === "owner") ? (
          <p role="status" className="rounded-control bg-warn-soft px-4 py-3 font-medium text-on-warn-soft">
            {b.cancelledBy === "owner" ? "Your host cancelled this booking." : "You cancelled this booking."}{" "}
            {b.refundedCents > 0 ? `${formatCents(b.refundedCents)} is being refunded to your card (usually 5–10 business days).` : "No refund was due under the cancellation policy."}
          </p>
        ) : null}
        {b.status === "CANCELLED" && b.cancelledBy === "system" && b.refundedCents > 0 ? (
          <p role="alert" className="rounded-control bg-warn-soft px-4 py-3 text-on-warn-soft">Those dates were taken while your payment was processing, so we refunded you in full.</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{b.listing.title}</h1>
          <BookingStatusChip status={b.status} checkIn={b.checkIn} checkOut={b.checkOut} today={today} />
        </div>
        <p className="text-ink-muted">{b.listing.city}, {b.listing.region} · Hosted by {b.listing.owner.name} · Booking {b.id.slice(-8).toUpperCase()}</p>

        {failedBalance ? (
          <p role="alert" className="rounded-control bg-warn-soft px-4 py-3 text-on-warn-soft">
            We couldn&apos;t charge the remaining {formatCents(b.balanceCents)} to your saved card. We&apos;ll retry automatically; if it keeps failing, please contact support so your stay isn&apos;t at risk.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <ButtonLink href={`/messages/${b.id}`} variant="secondary">Message host</ButtonLink>
        </div>
        <Card><BookingSummary b={b} view="guest" /></Card>

        {b.status === "CONFIRMED" && b.checkOut > today ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card className="flex flex-col gap-3">
              <h2 className="text-xl font-bold">Check-in details</h2>
              <p className="text-ink-muted">Check-in after {timeLabel(b.listing.checkInTime)} · checkout by {timeLabel(b.listing.checkOutTime)}</p>
              {released ? (
                <>
                  <address className="not-italic">
                    <span className="font-semibold">{b.listing.addressLine1}</span>
                    {b.listing.addressLine2 ? <>, {b.listing.addressLine2}</> : null}
                    <br />
                    {b.listing.city}, {b.listing.region} {b.listing.postalCode}
                  </address>
                  {b.listing.checkInInstructions ? (
                    <div className="whitespace-pre-line rounded-control bg-soft px-4 py-3 text-on-soft">{b.listing.checkInInstructions}</div>
                  ) : (
                    <p className="text-ink-muted">Your host hasn&apos;t added access instructions yet. <a href={`/messages/${b.id}`} className="text-brand underline">Message them</a>.</p>
                  )}
                </>
              ) : (
                <p className="rounded-control bg-soft px-4 py-3 text-on-soft">
                  The address and access instructions appear here on {releaseFmt.format(accessReleaseDate(b.checkIn, b.listing.accessReleaseDays))}.
                </p>
              )}
            </Card>
            <Card className="flex flex-col gap-3">
              <h2 className="text-xl font-bold">Before you arrive</h2>
              <ul className="flex flex-col divide-y divide-line">
                <li className="flex items-center justify-between gap-3 py-3">
                  <span>Payment</span>
                  <Chip tone={b.balanceStatus === "FAILED" ? "warn" : "soft"}>{b.balanceCents === 0 || b.balanceStatus === "PAID" ? "Paid" : b.balanceStatus === "FAILED" ? "Needs attention" : "Deposit paid"}</Chip>
                </li>
                <li className="flex flex-col gap-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span>Agree to house rules</span>
                    {b.rulesAcceptedAt ? <Chip>Done</Chip> : null}
                  </div>
                  {!b.rulesAcceptedAt ? (
                    <details className="group">
                      <summary className={buttonClass("secondary", "list-none [&::-webkit-details-marker]:hidden")}>Review</summary>
                      <div className="mt-3 flex flex-col gap-3">
                        <ul className="list-disc pl-5 text-ink-muted">
                          <li>Check-in after {timeLabel(b.listing.checkInTime)}, checkout by {timeLabel(b.listing.checkOutTime)}</li>
                          <li>Up to {b.guests} guest{b.guests === 1 ? "" : "s"} as booked</li>
                          {b.listing.houseRules.split("\n").map((r) => r.trim()).filter(Boolean).map((r, i) => <li key={i}>{r}</li>)}
                        </ul>
                        <form action={acceptHouseRules.bind(null, b.id)}>
                          <button type="submit" className={buttonClass("primary")}>I agree to the house rules</button>
                        </form>
                      </div>
                    </details>
                  ) : null}
                </li>
              </ul>
            </Card>
          </div>
        ) : null}

        {b.status === "CONFIRMED" && b.listing.guidebook ? (
          <Card className="flex flex-col gap-3">
            <h2 className="text-xl font-bold">Digital guidebook</h2>
            <p className="text-sm text-ink-muted">Tips from {b.listing.owner.name.split(" ")[0]}</p>
            <div className="whitespace-pre-line">{b.listing.guidebook}</div>
          </Card>
        ) : null}

        {reviewable ? (
          <Card className="flex flex-col gap-3">
            <h2 className="text-xl font-bold">Leave a review</h2>
            <ReviewForm action={submitReview.bind(null, b.id)} />
          </Card>
        ) : b.review ? (
          <Card className="flex flex-col gap-2">
            <h2 className="text-xl font-bold">Your review</h2>
            <p aria-label={`${b.review.rating} out of 5 stars`} className="text-xl text-brand">{"★".repeat(b.review.rating)}<span className="text-line-strong">{"★".repeat(5 - b.review.rating)}</span></p>
            <p className="whitespace-pre-line text-ink-muted">{b.review.body}</p>
          </Card>
        ) : null}

        {b.checkOut <= today || b.status === "CANCELLED" ? (
          <div><a href={`/stays/${b.listing.slug}`} className={buttonClass("secondary")}>Book again</a></div>
        ) : null}

        <Card className="flex flex-col gap-3">
          <h2 className="text-xl font-bold">Cancellation: {POLICY_INFO[b.cancellationPolicy].label}</h2>
          <p className="text-ink-muted">{POLICY_INFO[b.cancellationPolicy].summary}</p>
          {canCancel && preview ? (
            <CancelBooking
              action={guestCancel.bind(null, b.id)}
              preview={
                preview.refundCents > 0
                  ? `If you cancel today you'll get ${formatCents(preview.refundCents)} back${b.balanceStatus === "SCHEDULED" ? " and the remaining balance won't be charged" : ""}.`
                  : `Under this policy, cancelling today is not refundable${b.balanceStatus === "SCHEDULED" ? ", but the remaining balance won't be charged" : ""}.`
              }
            />
          ) : null}
        </Card>
      </div>
    </PortalShell>
  );
}
