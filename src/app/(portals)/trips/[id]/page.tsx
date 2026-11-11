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
import { BookingStatusChip } from "@/components/booking/BookingStatus";
import { BookingSummary } from "@/components/booking/BookingSummary";
import { CancelBooking } from "@/components/booking/CancelBooking";
import { POLICY_INFO } from "@/lib/booking-money";
import { formatCents } from "@/lib/money";
import { todayIn } from "@/lib/dates";

export const metadata: Metadata = { title: "Your trip", robots: { index: false } };

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
  let b = await db.booking.findUnique({ where: { id }, include: { listing: { select: { title: true, city: true, region: true, slug: true, checkInTime: true, checkOutTime: true, owner: { select: { name: true } } } }, payments: true } });
  if (!b || b.guestId !== user.id) notFound();

  // Coming back from Stripe: confirm the payment right away instead of waiting for the webhook.
  if (b.status === "PENDING_PAYMENT" || sp.paid) {
    for (const p of b.payments.filter((p) => p.status === "PENDING" && p.stripeId?.startsWith("pi_"))) {
      await syncPaymentIntent(p.stripeId!).catch((e) => console.error("sync failed", e));
    }
    b = await db.booking.findUniqueOrThrow({ where: { id }, include: { listing: { select: { title: true, city: true, region: true, slug: true, checkInTime: true, checkOutTime: true, owner: { select: { name: true } } } }, payments: true } });
  }
  if (b.status === "PENDING_PAYMENT") redirect(`/book/${b.id}`);

  const today = todayIn();
  const canCancel = b.status === "CONFIRMED" && b.checkOut > today;
  const preview = canCancel ? await previewCancellation(b.id, "guest") : null;
  const failedBalance = b.status === "CONFIRMED" && b.balanceStatus === "FAILED";

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

        <Card><BookingSummary b={b} view="guest" /></Card>

        <Card className="flex flex-col gap-2">
          <h2 className="text-xl font-bold">Check-in details</h2>
          <p className="text-ink-muted">Check-in after {b.listing.checkInTime}, checkout by {b.listing.checkOutTime}. The address and access instructions appear here closer to your arrival.</p>
        </Card>

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
