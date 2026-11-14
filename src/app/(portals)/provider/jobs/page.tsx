import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { connection } from "next/server";
import { requirePortal } from "@/lib/auth/dal";
import { getOrCreateProfile } from "@/lib/providers";
import { providerInbox } from "@/lib/jobs";
import { categoryNoun } from "@/lib/services";
import { PortalShell } from "@/components/layout/PortalShell";
import { providerNav } from "@/components/layout/portal-nav";
import { Chip } from "@/components/ui/Card";
import { formatCents } from "@/lib/money";

export const metadata: Metadata = { title: "Jobs" };
const fmt = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

export default function Page() {
  return (
    <Suspense fallback={<div className="h-screen" aria-hidden="true" />}>
      <Jobs />
    </Suspense>
  );
}

async function Jobs() {
  await connection();
  const user = await requirePortal("provider", "/provider/jobs");
  const profile = await getOrCreateProfile(user);
  const jobs = await providerInbox(profile);
  const mine = (j: (typeof jobs)[number]) => j.acceptedQuote?.providerId === profile.id && j.status !== "OPEN";
  const groups = [
    { title: "New requests", items: jobs.filter((j) => j.status === "OPEN" && !j.quotes.length) },
    { title: "Quotes sent", items: jobs.filter((j) => j.status === "OPEN" && j.quotes.length) },
    { title: "Scheduled", items: jobs.filter((j) => mine(j) && j.status === "ASSIGNED") },
    { title: "Done, awaiting payment", items: jobs.filter((j) => mine(j) && (j.status === "COMPLETED" || j.status === "DISPUTED")) },
    { title: "Completed", items: jobs.filter((j) => mine(j) && j.status === "PAID") },
  ];
  return (
    <PortalShell portal="Services" user={user} nav={providerNav("/provider/jobs")}>
      <div className="flex flex-col gap-8 pt-6 sm:pt-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Jobs</h1>
        {profile.status !== "APPROVED" ? <p className="rounded-control bg-warn-soft px-4 py-3 text-on-warn-soft">Job requests appear here once your profile is approved. <Link href="/provider/profile" className="underline">Business profile</Link></p> : null}
        {groups.map((g) => (
          <section key={g.title} className="flex flex-col gap-3">
            <h2 className="text-xl font-bold">{g.title} <span className="font-normal text-ink-muted">({g.items.length})</span></h2>
            {g.items.length === 0 ? <p className="text-sm text-ink-muted">None.</p> : (
              <ul className="flex flex-col gap-3">
                {g.items.map((j) => (
                  <li key={j.id} className="relative flex flex-col gap-1 rounded-card border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="font-bold"><Link href={`/provider/jobs/${j.id}`} className="after:absolute after:inset-0 after:rounded-card">{j.title}</Link></h3>
                      <p className="text-sm text-ink-muted">{categoryNoun(j.category)} · {j.listing.city}, {j.listing.region}{(j.scheduledDate ?? j.preferredDate) ? ` · ${fmt.format((j.scheduledDate ?? j.preferredDate)!)}` : ""}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {j.targetProviderId === profile.id && j.status === "OPEN" ? <Chip>Sent to you</Chip> : null}
                      {j.quotes[0] && j.status === "OPEN" ? <Chip>Your quote {formatCents(j.quotes[0].amountCents)}</Chip> : null}
                      {mine(j) ? <Chip>{formatCents(j.providerPayoutCents)}</Chip> : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </PortalShell>
  );
}
