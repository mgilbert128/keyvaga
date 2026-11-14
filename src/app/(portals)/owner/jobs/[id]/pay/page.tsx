import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { connection } from "next/server";
import { requirePortal } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { getJobCheckoutSecret } from "@/lib/jobs";
import { PortalShell } from "@/components/layout/PortalShell";
import { ownerNav } from "@/components/layout/portal-nav";
import { Card } from "@/components/ui/Card";
import { PaymentForm } from "@/components/booking/PaymentForm";
import { formatCents } from "@/lib/money";

export const metadata: Metadata = { title: "Pay for service", robots: { index: false } };

export default function Page({ params }: PageProps<"/owner/jobs/[id]/pay">) {
  return (
    <Suspense fallback={<div className="h-screen" aria-hidden="true" />}>
      <Pay params={params} />
    </Suspense>
  );
}

async function Pay({ params }: { params: PageProps<"/owner/jobs/[id]/pay">["params"] }) {
  const { id } = await params;
  await connection();
  const user = await requirePortal("owner", `/owner/jobs/${id}/pay`);
  const job = await db.job.findUnique({ where: { id }, include: { acceptedQuote: { include: { provider: { select: { businessName: true } } } }, listing: { select: { title: true } } } });
  if (!job || job.ownerId !== user.id) notFound();
  if (job.status !== "OPEN") redirect(`/owner/jobs/${job.id}`);
  const secret = await getJobCheckoutSecret(job.id).catch(() => null);
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  return (
    <PortalShell portal="Owner" user={user} nav={ownerNav("/owner/jobs")}>
      <div className="grid grid-cols-1 gap-6 pt-6 sm:pt-10 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-4">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Confirm and pay</h1>
          {!secret || !key ? <Card><p role="alert">Payment can&apos;t be loaded right now. Go back to the job and accept the quote again.</p></Card> : (
            <Card>
              <PaymentForm publishableKey={key} clientSecret={secret} bookingId={job.id} amountLabel={formatCents(job.ownerTotalCents)} holdExpiresAt={null} returnPath={`/owner/jobs/${job.id}?paid=1`} />
            </Card>
          )}
          <p className="text-sm text-ink-muted">Keyvaga holds your payment and releases it to the pro only after the job is done. Cancel before the job for a full refund.</p>
        </div>
        <Card className="flex h-fit flex-col gap-3">
          <h2 className="text-xl font-bold">{job.title}</h2>
          <p className="text-ink-muted">{job.listing.title} · {job.acceptedQuote?.provider.businessName}</p>
          <dl className="flex flex-col gap-2 border-t border-line pt-3">
            <div className="flex justify-between"><dt>Quote</dt><dd>{formatCents(job.quoteCents)}</dd></div>
            <div className="flex justify-between"><dt>Keyvaga fee (5%)</dt><dd>{formatCents(job.ownerFeeCents)}</dd></div>
            <div className="flex justify-between border-t border-line pt-2 text-lg font-bold"><dt>Total</dt><dd>{formatCents(job.ownerTotalCents)}</dd></div>
          </dl>
        </Card>
      </div>
    </PortalShell>
  );
}
