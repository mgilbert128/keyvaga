import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { requirePortal } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { refreshPayoutStatus } from "@/lib/payouts";
import { stripeConfigured } from "@/lib/stripe";
import { getOrCreateProfile } from "@/lib/providers";
import { openProviderPayoutDashboard, startProviderPayoutSetup } from "@/app/actions/provider";
import { PortalShell } from "@/components/layout/PortalShell";
import { providerNav } from "@/components/layout/portal-nav";
import { Card, Chip } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatCents } from "@/lib/money";

export const metadata: Metadata = { title: "Payouts" };
const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export default function Page({ searchParams }: PageProps<"/provider/payouts">) {
  return (
    <Suspense fallback={<div className="h-screen" aria-hidden="true" />}>
      <Payouts searchParams={searchParams} />
    </Suspense>
  );
}

async function Payouts({ searchParams }: { searchParams: PageProps<"/provider/payouts">["searchParams"] }) {
  const sp = await searchParams;
  await connection();
  const user = await requirePortal("provider", "/provider/payouts");
  const profile = await getOrCreateProfile(user);
  const status = stripeConfigured() ? await refreshPayoutStatus(user.id).catch(() => ({ connected: false, payoutsEnabled: false, detailsSubmitted: false })) : { connected: false, payoutsEnabled: false, detailsSubmitted: false };
  const [pending, sent] = await Promise.all([
    db.job.findMany({ where: { acceptedQuote: { providerId: profile.id }, status: { in: ["ASSIGNED", "COMPLETED", "DISPUTED"] } }, orderBy: { scheduledDate: "asc" }, include: { listing: { select: { title: true } } } }),
    db.jobPayment.findMany({ where: { kind: "PAYOUT", job: { acceptedQuote: { providerId: profile.id } } }, orderBy: { createdAt: "desc" }, take: 50, include: { job: { select: { title: true } } } }),
  ]);
  const error = typeof sp.error === "string" ? sp.error : null;
  return (
    <PortalShell portal="Services" user={user} nav={providerNav("/provider/payouts")}>
      <div className="flex flex-col gap-6 pt-6 sm:pt-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Payouts</h1>
        {error ? <p role="alert" className="rounded-control border border-danger/30 bg-danger/5 px-4 py-3 font-medium text-danger">{error}</p> : null}
        <Card className="flex flex-col items-start gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-bold">Payout account</h2>
            {status.payoutsEnabled ? <Chip>Ready</Chip> : <Chip tone="warn">{status.connected ? "Setup not finished" : "Not set up"}</Chip>}
          </div>
          <p className="text-ink-muted">
            Owners pay Keyvaga when they accept your quote. You&apos;re paid when they confirm the job is done, or automatically 3 days after you mark it complete. Keyvaga keeps a 5% service fee.
          </p>
          {status.payoutsEnabled ? (
            <form action={openProviderPayoutDashboard}><Button type="submit" variant="secondary">View payouts and bank details</Button></form>
          ) : (
            <form action={startProviderPayoutSetup}><Button type="submit">{status.connected ? "Finish payout setup" : "Set up payouts"}</Button></form>
          )}
        </Card>
        <Card className="flex flex-col gap-3">
          <h2 className="text-xl font-bold">Coming up</h2>
          {pending.length === 0 ? <p className="text-ink-muted">No jobs in progress.</p> : (
            <ul className="flex flex-col divide-y divide-line">
              {pending.map((j) => <li key={j.id} className="flex justify-between gap-4 py-2"><span>{j.title} · {j.listing.title}</span><span className="font-semibold">{formatCents(j.providerPayoutCents)}</span></li>)}
            </ul>
          )}
        </Card>
        <Card className="flex flex-col gap-3">
          <h2 className="text-xl font-bold">Paid</h2>
          {sent.length === 0 ? <p className="text-ink-muted">No payouts yet.</p> : (
            <ul className="flex flex-col divide-y divide-line">
              {sent.map((s) => <li key={s.id} className="flex justify-between gap-4 py-2"><span>{s.job.title} · {fmt.format(s.createdAt)}</span><span className="font-semibold">{formatCents(s.amountCents)}</span></li>)}
            </ul>
          )}
        </Card>
      </div>
    </PortalShell>
  );
}
