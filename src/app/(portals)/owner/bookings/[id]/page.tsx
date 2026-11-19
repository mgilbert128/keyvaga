import { PaymentRequestList } from "@/components/booking/PaymentRequestList";
import { RequestPaymentForm } from "@/components/booking/RequestPaymentForm";
import { requestPaymentAction } from "@/app/actions/payment-requests";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { connection } from "next/server";
import { requirePortal } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { acceptRequestAction, declineRequestAction, ownerCancel } from "@/app/actions/bookings";
import { RequestDecision } from "@/components/booking/RequestDecision";
import { PortalShell } from "@/components/layout/PortalShell";
import { ownerNav } from "@/components/layout/portal-nav";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { BookingStatusChip } from "@/components/booking/BookingStatus";
import { BookingSummary } from "@/components/booking/BookingSummary";
import { CancelBooking } from "@/components/booking/CancelBooking";
import { formatCents } from "@/lib/money";
import { addDays, todayIn } from "@/lib/dates";
import { paidSoFar } from "@/lib/bookings";
import { doorCodesFor } from "@/lib/locks";

export const metadata: Metadata = { title: "Booking", robots: { index: false } };

export default function Page({ params }: PageProps<"/owner/bookings/[id]">) {
  return (
    <Suspense fallback={<div className="h-screen" aria-hidden="true" />}>
      <OwnerBooking params={params} />
    </Suspense>
  );
}

async function OwnerBooking({ params }: { params: PageProps<"/owner/bookings/[id]">["params"] }) {
  const { id } = await params;
  await connection();
  const user = await requirePortal("owner", `/owner/bookings/${id}`);
  const b = await db.booking.findUnique({ where: { id }, include: { paymentRequests: { orderBy: { createdAt: "desc" } }, listing: { select: { id: true, title: true, ownerId: true, regularCleanerId: true, timeZone: true } }, guest: { select: { name: true, email: true } }, jobs: { where: { category: "cleaning", status: { not: "CANCELLED" } }, include: { acceptedQuote: { include: { provider: { select: { businessName: true } } } }, targetProvider: { select: { businessName: true } } }, take: 1 } } });
  if (!b || b.listing.ownerId !== user.id || b.status === "PENDING_PAYMENT") notFound();
  const today = todayIn();
  const canCancel = b.status === "CONFIRMED" && b.checkOut > today;
  const { paidCents } = canCancel ? await paidSoFar(b.id) : { paidCents: 0 };

  return (
    <PortalShell portal="Owner" user={user} nav={ownerNav("/owner/bookings")}>
      <div className="flex flex-col gap-6 pt-6 sm:pt-10">
        <Link href="/owner/bookings" className="inline-flex min-h-11 items-center self-start text-brand underline underline-offset-4">← All bookings</Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{b.listing.title}</h1>
          <BookingStatusChip status={b.status} checkIn={b.checkIn} checkOut={b.checkOut} today={today} />
        </div>
        <p className="text-ink-muted">Guest: {b.guest.name} · {b.guest.email} · Booking {b.id.slice(-8).toUpperCase()}</p>
        {b.status === "REQUESTED" ? (
          <Card className="flex flex-col gap-3 border-brand">
            <h2 className="text-xl font-bold">{b.guest.name.split(" ")[0]} is requesting to book</h2>
            <p className="text-ink-muted">
              Please answer by {b.holdExpiresAt?.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: b.listing.timeZone, timeZoneName: "short" }) ?? "the deadline"}.
              Their card is authorized for {formatCents(b.dueNowCents)}; accepting charges it and confirms the booking. If you don&apos;t answer in time, the request expires and they aren&apos;t charged.
            </p>
            <RequestDecision accept={acceptRequestAction.bind(null, b.id)} decline={declineRequestAction.bind(null, b.id)} guestFirst={b.guest.name.split(" ")[0] ?? "the guest"} />
          </Card>
        ) : null}
        {b.status === "CANCELLED" && (b.cancelledBy === "declined" || b.cancelledBy === "withdrawn" || b.cancelledBy === "expired") ? (
          <p role="status" className="rounded-control bg-soft px-4 py-3 font-medium text-on-soft">
            {b.cancelledBy === "declined" ? "You declined this request. The guest wasn't charged." : b.cancelledBy === "withdrawn" ? "The guest withdrew this request before you answered." : "This request expired before it was answered. The guest wasn't charged."}
          </p>
        ) : b.status === "CANCELLED" ? (
          <p role="status" className="rounded-control bg-warn-soft px-4 py-3 font-medium text-on-warn-soft">
            {b.cancelledBy === "owner" ? "You cancelled this booking and the guest was refunded in full." : `The guest cancelled. ${b.payoutDueCents > 0 ? `You'll still receive ${formatCents(b.payoutDueCents)} under your cancellation policy.` : "No payout is due."}`}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={`/owner/messages/${b.id}`} variant="secondary">Message guest</ButtonLink>
          {b.status === "CONFIRMED" && b.checkOut >= today ? (
            b.jobs[0] ? (
              <ButtonLink href={`/owner/jobs/${b.jobs[0].id}`} variant="secondary">
                Cleaning: {b.jobs[0].status === "OPEN" ? `requested${b.jobs[0].targetProvider ? ` from ${b.jobs[0].targetProvider.businessName}` : ""}` : `${b.jobs[0].acceptedQuote?.provider.businessName ?? "scheduled"}`}
              </ButtonLink>
            ) : (
              <ButtonLink href={`/owner/jobs/new?category=cleaning&listing=${b.listing.id}&date=${b.checkOut.toISOString().slice(0, 10)}${b.listing.regularCleanerId ? `&provider=${b.listing.regularCleanerId}` : ""}`}>Book a cleaner</ButtonLink>
            )
          ) : null}
        </div>
        <Card><BookingSummary b={b} view="owner" /></Card>
        <DoorCodeLine bookingId={b.id} />
        {(b.status === "CONFIRMED" || b.status === "COMPLETED") && today <= addDays(b.checkOut, 14) ? (
          <Card className="flex flex-col gap-4" id="payment-requests">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-bold">Request a payment</h2>
              <p className="text-ink-muted">Ask {b.guest.name.split(" ")[0]} to pay for extras like a parking pass or beach gear. They approve and pay from their trip page; you get it minus Keyvaga&apos;s 5% fee (at least $1) once the stay starts.</p>
            </div>
            <PaymentRequestList requests={b.paymentRequests} view="owner" bookingId={b.id} />
            <RequestPaymentForm action={requestPaymentAction.bind(null, b.id)} />
          </Card>
        ) : b.paymentRequests.length ? (
          <Card className="flex flex-col gap-4"><h2 className="text-xl font-bold">Payment requests</h2><PaymentRequestList requests={b.paymentRequests} view="owner" bookingId={b.id} /></Card>
        ) : null}
        {canCancel ? (
          <Card className="flex flex-col gap-3">
            <h2 className="text-xl font-bold">Cancel this booking</h2>
            <p className="text-ink-muted">If you cancel, the guest gets a full refund and you won&apos;t receive a payout. Please only cancel if you really can&apos;t host.</p>
            <CancelBooking action={ownerCancel.bind(null, b.id)} label="Cancel and refund guest" preview={`${b.guest.name} will be refunded ${formatCents(paidCents)} in full${b.balanceStatus === "SCHEDULED" ? " and won't be charged the balance" : ""}.`} />
          </Card>
        ) : null}
      </div>
    </PortalShell>
  );
}

async function DoorCodeLine({ bookingId }: { bookingId: string }) {
  const codes = await doorCodesFor({ bookingId });
  if (!codes.length) return null;
  const label = (s: string) => (s === "SET" ? "ready on lock" : s === "SETTING" ? "scheduled" : "couldn't be added, see Smart locks");
  return (
    <p className="rounded-control bg-soft px-4 py-3 text-on-soft">
      <span className="font-semibold">Guest door code:</span>{" "}
      {codes.map((c) => `${c.lockName} ${c.code ?? "—"} (${label(c.status)})`).join(" · ")}{" "}
      <a href="/owner/locks" className="underline underline-offset-4">Smart locks</a>
    </p>
  );
}
