import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { connection } from "next/server";
import { requirePortal } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { ownerCancel } from "@/app/actions/bookings";
import { PortalShell } from "@/components/layout/PortalShell";
import { ownerNav } from "@/components/layout/portal-nav";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { BookingStatusChip } from "@/components/booking/BookingStatus";
import { BookingSummary } from "@/components/booking/BookingSummary";
import { CancelBooking } from "@/components/booking/CancelBooking";
import { formatCents } from "@/lib/money";
import { todayIn } from "@/lib/dates";
import { paidSoFar } from "@/lib/bookings";

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
  const b = await db.booking.findUnique({ where: { id }, include: { listing: { select: { title: true, ownerId: true } }, guest: { select: { name: true, email: true } } } });
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
        {b.status === "CANCELLED" ? (
          <p role="status" className="rounded-control bg-warn-soft px-4 py-3 font-medium text-on-warn-soft">
            {b.cancelledBy === "owner" ? "You cancelled this booking and the guest was refunded in full." : `The guest cancelled. ${b.payoutDueCents > 0 ? `You'll still receive ${formatCents(b.payoutDueCents)} under your cancellation policy.` : "No payout is due."}`}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={`/owner/messages/${b.id}`} variant="secondary">Message guest</ButtonLink>
        </div>
        <Card><BookingSummary b={b} view="owner" /></Card>
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
