import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { requirePortal } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { refreshPayoutStatus } from "@/lib/payouts";
import { stripeConfigured } from "@/lib/stripe";
import { openPayoutDashboard, startPayoutSetup } from "@/app/actions/bookings";
import { PortalShell } from "@/components/layout/PortalShell";
import { ownerNav } from "@/components/layout/portal-nav";
import { Card, Chip } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatCents } from "@/lib/money";

export const metadata: Metadata = { title: "Payouts" };
const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export default function Page({ searchParams }: PageProps<"/owner/payouts">) {
  return (
    <Suspense fallback={<div className="h-screen" aria-hidden="true" />}>
      <Payouts searchParams={searchParams} />
    </Suspense>
  );
}

async function Payouts({ searchParams }: { searchParams: PageProps<"/owner/payouts">["searchParams"] }) {
  const sp = await searchParams;
  await connection(); // talks to Stripe
  const user = await requirePortal("owner", "/owner/payouts");
  const status = stripeConfigured()
    ? await refreshPayoutStatus(user.id).catch(() => ({ connected: false, payoutsEnabled: false, detailsSubmitted: false, error: true as const }))
    : { connected: false, payoutsEnabled: false, detailsSubmitted: false };

  const [upcoming, sent] = await Promise.all([
    db.booking.findMany({ where: { listing: { ownerId: user.id }, payoutStatus: "PENDING" }, orderBy: { checkIn: "asc" }, include: { listing: { select: { title: true } } } }),
    db.payment.findMany({ where: { kind: "PAYOUT", booking: { listing: { ownerId: user.id } } }, orderBy: { createdAt: "desc" }, take: 50, include: { booking: { include: { listing: { select: { title: true } } } } } }),
  ]);
  const upcomingTotal = upcoming.reduce((s, b) => s + b.payoutDueCents, 0);
  const error = typeof sp.error === "string" ? sp.error : null;

  return (
    <PortalShell portal="Owner" user={user} nav={ownerNav("/owner/payouts")}>
      <div className="flex flex-col gap-6 pt-6 sm:pt-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Payouts</h1>
        {error ? <p role="alert" className="rounded-control border border-danger/30 bg-danger/5 px-4 py-3 font-medium text-danger">{error}</p> : null}

        <Card className="flex flex-col items-start gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-bold">Payout account</h2>
            {status.payoutsEnabled ? <Chip>Ready</Chip> : status.connected ? <Chip tone="warn">Setup not finished</Chip> : <Chip tone="warn">Not set up</Chip>}
          </div>
          {status.payoutsEnabled ? (
            <>
              <p className="text-ink-muted">Payouts go to the bank account you added with Stripe, Keyvaga&apos;s payment partner. You&apos;re paid after each guest checks in, minus Keyvaga&apos;s 5% host fee.</p>
              <form action={openPayoutDashboard}><Button type="submit" variant="secondary">View payouts and bank details</Button></form>
            </>
          ) : (
            <>
              <p className="text-ink-muted">
                To receive money from bookings, add your bank account through Stripe, Keyvaga&apos;s payment partner. It takes about 5 minutes and Stripe may ask for ID to verify you. Guests can book before you finish; your payouts wait until you do.
              </p>
              <form action={startPayoutSetup}><Button type="submit">{status.connected ? "Finish payout setup" : "Set up payouts"}</Button></form>
            </>
          )}
        </Card>

        <Card className="flex flex-col gap-3">
          <h2 className="text-xl font-bold">Upcoming payouts · {formatCents(upcomingTotal)}</h2>
          {upcoming.length === 0 ? (
            <p className="text-ink-muted">Nothing scheduled yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {upcoming.map((b) => (
                <li key={b.id} className="flex justify-between gap-4 py-2">
                  <span>{b.listing.title} · check-in {fmt.format(b.checkIn)}</span>
                  <span className="font-semibold">{formatCents(b.payoutDueCents)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="flex flex-col gap-3">
          <h2 className="text-xl font-bold">Sent</h2>
          {sent.length === 0 ? (
            <p className="text-ink-muted">No payouts sent yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {sent.map((p) => (
                <li key={p.id} className="flex justify-between gap-4 py-2">
                  <span>{p.booking.listing.title} · {fmt.format(p.createdAt)}</span>
                  <span className="font-semibold">{formatCents(p.amountCents)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </PortalShell>
  );
}
