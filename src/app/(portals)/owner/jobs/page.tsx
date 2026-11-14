import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { connection } from "next/server";
import { requirePortal } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { JOB_STATUS_LABEL, categoryNoun, type JobStatus } from "@/lib/services";
import { PortalShell } from "@/components/layout/PortalShell";
import { ownerNav } from "@/components/layout/portal-nav";
import { ButtonLink } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Card";
import { formatCents } from "@/lib/money";

export const metadata: Metadata = { title: "Service jobs" };
const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export default function Page() {
  return (
    <Suspense fallback={<div className="h-screen" aria-hidden="true" />}>
      <Jobs />
    </Suspense>
  );
}

async function Jobs() {
  await connection();
  const user = await requirePortal("owner", "/owner/jobs");
  const jobs = await db.job.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "desc" },
    include: { listing: { select: { title: true } }, quotes: { where: { status: "SUBMITTED" }, select: { id: true } }, acceptedQuote: { include: { provider: { select: { businessName: true } } } }, targetProvider: { select: { businessName: true } } },
  });
  return (
    <PortalShell portal="Owner" user={user} nav={ownerNav("/owner/jobs")}>
      <div className="flex flex-col gap-6 pt-6 sm:pt-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Service jobs</h1>
          <ButtonLink href="/owner/services">Find a pro</ButtonLink>
        </div>
        {jobs.length === 0 ? <p className="text-ink-muted">No jobs yet. Find a cleaner, handyman or other pro for your property.</p> : (
          <ul className="flex flex-col gap-3">
            {jobs.map((j) => (
              <li key={j.id} className="relative flex flex-col gap-2 rounded-card border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-bold"><Link href={`/owner/jobs/${j.id}`} className="after:absolute after:inset-0 after:rounded-card">{j.title}</Link></h2>
                  <p className="text-sm text-ink-muted">
                    {j.listing.title} · {categoryNoun(j.category)}
                    {j.scheduledDate ?? j.preferredDate ? ` · ${fmt.format((j.scheduledDate ?? j.preferredDate)!)}` : ""}
                    {j.acceptedQuote && j.status !== "OPEN" ? ` · ${j.acceptedQuote.provider.businessName} · ${formatCents(j.ownerTotalCents)}` : j.targetProvider ? ` · sent to ${j.targetProvider.businessName}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {j.status === "OPEN" && j.quotes.length ? <Chip>{j.quotes.length} quote{j.quotes.length === 1 ? "" : "s"}</Chip> : null}
                  <Chip tone={j.status === "DISPUTED" || j.status === "COMPLETED" ? "warn" : "soft"}>{JOB_STATUS_LABEL[j.status as JobStatus]}</Chip>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PortalShell>
  );
}
