import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { connection } from "next/server";
import { requirePortal } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { getOrCreateProfile, providerStats } from "@/lib/providers";
import { providerInbox } from "@/lib/jobs";
import { refreshPayoutStatus } from "@/lib/payouts";
import { stripeConfigured } from "@/lib/stripe";
import { responseTimeLabel } from "@/lib/services";
import { PortalShell } from "@/components/layout/PortalShell";
import { providerNav } from "@/components/layout/portal-nav";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { Stars } from "@/components/services/Stars";
import { formatCents } from "@/lib/money";

export const metadata: Metadata = { title: "Provider overview" };
const fmt = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

export default function Page() {
  return (
    <Suspense fallback={<div className="h-screen" aria-hidden="true" />}>
      <Overview />
    </Suspense>
  );
}

async function Overview() {
  await connection();
  const user = await requirePortal("provider", "/provider");
  const profile = await getOrCreateProfile(user);
  const [inbox, stats, payout] = await Promise.all([
    profile.status === "APPROVED" ? providerInbox(profile) : Promise.resolve([]),
    providerStats([profile.id]).then((m) => m.get(profile.id)!),
    stripeConfigured() ? refreshPayoutStatus(user.id).catch(() => null) : Promise.resolve(null),
  ]);
  const newRequests = inbox.filter((j) => j.status === "OPEN" && !j.quotes.length);
  const upcoming = await db.job.findMany({ where: { acceptedQuote: { providerId: profile.id }, status: "ASSIGNED" }, orderBy: { scheduledDate: "asc" }, include: { listing: { select: { title: true, city: true } } } });
  const steps = [
    { done: profile.bio.length >= 30 && profile.categories.length > 0 && profile.photos.length > 0, text: "Complete your business profile", href: "/provider/profile" },
    { done: profile.status !== "DRAFT", text: "Submit your profile for review", href: "/provider/profile" },
    { done: profile.status === "APPROVED" || profile.status === "PAUSED", text: "Get approved by Keyvaga", href: "/provider/profile" },
    { done: Boolean(payout?.payoutsEnabled), text: "Set up payouts", href: "/provider/payouts" },
  ];

  return (
    <PortalShell portal="Services" user={user} nav={providerNav("/provider")}>
      <div className="flex flex-col gap-6 pt-6 sm:pt-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Welcome, {profile.businessName}</h1>
        {steps.some((s) => !s.done) ? (
          <Card className="flex flex-col gap-3">
            <h2 className="text-xl font-bold">Get set up</h2>
            <ol className="flex flex-col gap-2">
              {steps.map((s, i) => (
                <li key={i} className="flex items-center justify-between gap-3">
                  <span className={s.done ? "text-ink-muted line-through" : ""}>{s.done ? "✓ " : `${i + 1}. `}{s.text}</span>
                  {!s.done ? <Link href={s.href} className="text-brand underline underline-offset-4">Go</Link> : null}
                </li>
              ))}
            </ol>
          </Card>
        ) : null}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card><p className="text-ink-muted">New requests</p><p className="text-4xl font-bold">{newRequests.length}</p></Card>
          <Card><p className="text-ink-muted">Rating</p><p className="text-2xl font-bold"><Stars rating={stats.rating} count={stats.reviewCount} /></p><p className="text-sm text-ink-muted">{responseTimeLabel(stats.responseHours) ?? "Quote quickly to build your response time"}</p></Card>
          <Card><p className="text-ink-muted">Jobs completed</p><p className="text-4xl font-bold">{stats.jobsDone}</p></Card>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="flex flex-col gap-3">
            <div className="flex items-center justify-between"><h2 className="text-xl font-bold">New requests</h2><Link href="/provider/jobs" className="text-brand underline underline-offset-4">All jobs</Link></div>
            {newRequests.length === 0 ? <p className="text-ink-muted">{profile.status === "APPROVED" ? "No new requests right now." : "You'll see job requests once your profile is approved."}</p> : (
              <ul className="flex flex-col divide-y divide-line">
                {newRequests.slice(0, 6).map((j) => (
                  <li key={j.id} className="flex items-center justify-between gap-3 py-3">
                    <Link href={`/provider/jobs/${j.id}`} className="hover:underline">{j.title} · {j.listing.city}{j.targetProviderId ? " · sent to you" : ""}</Link>
                    <ButtonLink href={`/provider/jobs/${j.id}`} variant="secondary">Quote</ButtonLink>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="flex flex-col gap-3">
            <h2 className="text-xl font-bold">Schedule</h2>
            {upcoming.length === 0 ? <p className="text-ink-muted">No scheduled jobs.</p> : (
              <ul className="flex flex-col divide-y divide-line">
                {upcoming.map((j) => (
                  <li key={j.id} className="flex items-center justify-between gap-3 py-3">
                    <Link href={`/provider/jobs/${j.id}`} className="hover:underline">{j.scheduledDate ? fmt.format(j.scheduledDate) : "Date TBC"} · {j.title} · {j.listing.city}</Link>
                    <span className="font-semibold">{formatCents(j.providerPayoutCents)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </PortalShell>
  );
}
