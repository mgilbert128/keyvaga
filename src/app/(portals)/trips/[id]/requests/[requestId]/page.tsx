import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { connection } from "next/server";
import { requirePortal } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { PaymentRequestError, startRequestPayment } from "@/lib/payment-requests";
import { PortalShell } from "@/components/layout/PortalShell";
import { guestNav } from "@/components/layout/portal-nav";
import { Card } from "@/components/ui/Card";
import { PaymentForm } from "@/components/booking/PaymentForm";
import { formatCents } from "@/lib/money";
import { formatRate, parseTaxLines } from "@/lib/tax-calc";

export const metadata: Metadata = { title: "Pay request", robots: { index: false } };

export default function Page({ params }: PageProps<"/trips/[id]/requests/[requestId]">) {
  return (
    <Suspense fallback={<div className="h-screen" aria-hidden="true" />}>
      <PayRequest params={params} />
    </Suspense>
  );
}

async function PayRequest({ params }: { params: PageProps<"/trips/[id]/requests/[requestId]">["params"] }) {
  const { id, requestId } = await params;
  await connection();
  const user = await requirePortal("guest", `/trips/${id}/requests/${requestId}`);
  const r = await db.paymentRequest.findUnique({ where: { id: requestId }, include: { booking: { include: { listing: { select: { title: true, owner: { select: { name: true } } } } } } } });
  if (!r || r.bookingId !== id || r.booking.guestId !== user.id) notFound();
  if (r.status !== "REQUESTED") redirect(`/trips/${id}#payment-requests`);
  let secret: string | null = null;
  let problem = "";
  try {
    secret = await startRequestPayment(user.id, r.id);
  } catch (e) {
    problem = e instanceof PaymentRequestError ? e.message : "Payment can't be loaded right now. Please try again in a moment.";
    if (!(e instanceof PaymentRequestError)) console.error("start request payment failed", e);
  }
  if (!secret && !problem) redirect(`/trips/${id}#payment-requests`);
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const taxLines = parseTaxLines(r.taxLines);
  return (
    <PortalShell user={user} nav={guestNav("/trips")}>
      <div className="grid grid-cols-1 gap-6 pt-6 sm:pt-10 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-4">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Pay your host&apos;s request</h1>
          {problem || !secret || !key ? (
            <Card><p role="alert">{problem || "Payment can't be loaded right now. Please try again in a moment."}</p></Card>
          ) : (
            <Card>
              <PaymentForm publishableKey={key} clientSecret={secret} bookingId={id} amountLabel={formatCents(r.totalCents)} holdExpiresAt={null} returnPath={`/trips/${id}?requestPaid=${r.id}#payment-requests`} />
            </Card>
          )}
          <p className="text-sm text-ink-muted">Keyvaga holds this payment and releases it to your host once your stay starts. If the booking is cancelled before check-in, it&apos;s refunded in full.</p>
        </div>
        <Card className="flex h-fit flex-col gap-3">
          <h2 className="text-xl font-bold">{r.description}</h2>
          <p className="text-ink-muted">{r.booking.listing.title} · requested by {r.booking.listing.owner.name.split(" ")[0]}</p>
          <dl className="flex flex-col gap-2 border-t border-line pt-3">
            <div className="flex justify-between"><dt>Amount</dt><dd>{formatCents(r.amountCents)}</dd></div>
            {taxLines.map((t) => <div key={t.name} className="flex justify-between"><dt>{t.name} ({formatRate(t.ratePpm)})</dt><dd>{formatCents(t.cents)}</dd></div>)}
            <div className="flex justify-between border-t border-line pt-2 text-lg font-bold"><dt>Total</dt><dd>{formatCents(r.totalCents)}</dd></div>
          </dl>
        </Card>
      </div>
    </PortalShell>
  );
}
