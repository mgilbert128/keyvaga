import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/dal";
import { getCheckoutSecret } from "@/lib/bookings";
import { formatCents } from "@/lib/money";
import { POLICY_INFO } from "@/lib/booking-money";
import { Card } from "@/components/ui/Card";
import { PaymentForm } from "@/components/booking/PaymentForm";

export const metadata: Metadata = { title: "Confirm and pay", robots: { index: false } };

const fmt = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export default function Page({ params }: PageProps<"/book/[id]">) {
  return (
    <Suspense fallback={<div className="mt-10 h-96 animate-pulse rounded-card bg-surface" aria-hidden="true" />}>
      <Checkout params={params} />
    </Suspense>
  );
}

async function Checkout({ params }: { params: PageProps<"/book/[id]">["params"] }) {
  const { id } = await params;
  await connection(); // talks to Stripe: only for real requests, never prefetches
  const user = await requireUser(`/book/${id}`);
  const b = await db.booking.findUnique({ where: { id }, include: { listing: { select: { title: true, city: true, region: true, slug: true } } } });
  if (!b || b.guestId !== user.id) notFound();
  if (b.status === "CONFIRMED") redirect(`/trips/${b.id}`);

  const expired = b.status !== "PENDING_PAYMENT" || (b.holdExpiresAt && b.holdExpiresAt < new Date());
  const clientSecret = expired ? null : await getCheckoutSecret(b.id).catch(() => null);
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const nights = Math.round((b.checkOut.getTime() - b.checkIn.getTime()) / 86_400_000);

  return (
    <div className="grid grid-cols-1 gap-8 pt-6 sm:pt-10 lg:grid-cols-[1fr_24rem]">
      <div className="flex flex-col gap-6">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Confirm and pay</h1>
        {expired ? (
          <Card className="flex flex-col items-start gap-4">
            <p className="font-semibold">This reservation hold has expired, so the dates were released.</p>
            <Link href={`/stays/${b.listing.slug}?checkIn=${b.checkIn.toISOString().slice(0, 10)}&checkOut=${b.checkOut.toISOString().slice(0, 10)}&guests=${b.guests}`} className="font-semibold text-brand underline underline-offset-4">
              Try again
            </Link>
          </Card>
        ) : !publishableKey || !clientSecret ? (
          <Card><p role="alert">Payment can&apos;t be loaded right now. Please refresh the page or try again in a few minutes.</p></Card>
        ) : (
          <Card>
            <h2 className="mb-4 text-xl font-bold">Payment</h2>
            <PaymentForm publishableKey={publishableKey} clientSecret={clientSecret} bookingId={b.id} amountLabel={formatCents(b.dueNowCents)} holdExpiresAt={b.holdExpiresAt?.toISOString() ?? null} />
          </Card>
        )}
        <Card className="flex flex-col gap-2 text-sm">
          <h2 className="text-lg font-bold">Cancellation policy: {POLICY_INFO[b.cancellationPolicy].label}</h2>
          <p className="text-ink-muted">{POLICY_INFO[b.cancellationPolicy].summary}</p>
          <p className="text-ink-muted">By paying you agree to the house rules and Keyvaga&apos;s terms. Your booking is confirmed instantly.</p>
        </Card>
      </div>

      <aside>
        <Card className="flex flex-col gap-4">
          <div>
            <h2 className="text-xl font-bold">{b.listing.title}</h2>
            <p className="text-ink-muted">{b.listing.city}, {b.listing.region}</p>
          </div>
          <dl className="grid grid-cols-2 gap-2 border-t border-line pt-4 text-sm">
            <dt className="text-ink-muted">Check in</dt><dd>{fmt.format(b.checkIn)}</dd>
            <dt className="text-ink-muted">Check out</dt><dd>{fmt.format(b.checkOut)}</dd>
            <dt className="text-ink-muted">Guests</dt><dd>{b.guests}</dd>
          </dl>
          <dl className="flex flex-col gap-2 border-t border-line pt-4">
            <div className="flex justify-between"><dt>{nights} night{nights === 1 ? "" : "s"}</dt><dd>{formatCents(b.nightlyCents)}</dd></div>
            {b.cleaningCents ? <div className="flex justify-between"><dt>Cleaning fee</dt><dd>{formatCents(b.cleaningCents)}</dd></div> : null}
            <div className="flex justify-between"><dt>Keyvaga service fee</dt><dd>{formatCents(b.serviceCents)}</dd></div>
            <div className="flex justify-between border-t border-line pt-2 text-lg font-bold"><dt>Total (USD)</dt><dd>{formatCents(b.totalCents)}</dd></div>
          </dl>
          <dl className="flex flex-col gap-2 rounded-control bg-soft px-4 py-3 text-sm text-on-soft">
            <div className="flex justify-between font-semibold"><dt>Due today</dt><dd>{formatCents(b.dueNowCents)}</dd></div>
            {b.balanceCents > 0 && b.balanceDueDate ? (
              <div className="flex justify-between"><dt>Charged {fmt.format(b.balanceDueDate)}</dt><dd>{formatCents(b.balanceCents)}</dd></div>
            ) : null}
          </dl>
        </Card>
      </aside>
    </div>
  );
}
