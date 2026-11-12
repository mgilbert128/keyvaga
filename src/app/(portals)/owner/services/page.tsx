import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { requirePortal } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { parseISODate } from "@/lib/dates";
import { PortalShell } from "@/components/layout/PortalShell";
import { ownerNav } from "@/components/layout/portal-nav";
import { Card, Chip } from "@/components/ui/Card";

export const metadata: Metadata = { title: "Find services" };

const CATEGORIES = [
  { key: "cleaning", label: "Cleaners" },
  { key: "handyman", label: "Handymen" },
  { key: "plumbing", label: "Plumbers" },
  { key: "electrical", label: "Electricians" },
  { key: "landscaping", label: "Landscaping" },
  { key: "linen", label: "Linen service" },
  { key: "photography", label: "Photographers" },
] as const;

const fmt = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

export default function Page({ searchParams }: PageProps<"/owner/services">) {
  return (
    <Suspense fallback={<div className="h-screen" aria-hidden="true" />}>
      <Services searchParams={searchParams} />
    </Suspense>
  );
}

async function Services({ searchParams }: { searchParams: PageProps<"/owner/services">["searchParams"] }) {
  const sp = await searchParams;
  await connection();
  const user = await requirePortal("owner", "/owner/services");
  const need = CATEGORIES.find((c) => c.key === sp.need);
  const date = parseISODate(typeof sp.date === "string" ? sp.date : null);
  const listing = typeof sp.listing === "string" ? await db.listing.findFirst({ where: { id: sp.listing, ownerId: user.id }, select: { title: true } }) : null;

  return (
    <PortalShell portal="Owner" user={user} nav={ownerNav("/owner/services")}>
      <div className="flex flex-col gap-8 pt-6 sm:pt-10">
        <div className="flex max-w-2xl flex-col gap-3">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Find help for your property</h1>
          <p className="text-lg text-ink-muted">Compare vetted local pros and request quotes in one tap.</p>
        </div>

        {need || listing || date ? (
          <p role="status" className="rounded-control bg-soft px-4 py-3 text-on-soft">
            Looking for: <strong>{need?.label ?? "a pro"}</strong>
            {listing ? <> for <strong>{listing.title}</strong></> : null}
            {date ? <> on <strong>{fmt.format(date)}</strong></> : null}
          </p>
        ) : null}

        <ul className="flex flex-wrap gap-3" aria-label="Service categories">
          {CATEGORIES.map((c) => (
            <li key={c.key}><Chip className={c.key === need?.key ? "ring-2 ring-brand" : ""}>{c.label}</Chip></li>
          ))}
        </ul>

        <Card className="flex flex-col gap-3">
          <h2 className="text-xl font-bold">Coming soon: the Keyvaga services marketplace</h2>
          <p className="text-ink-muted">
            Request a quote from one provider, or post a job once and get quotes from several. Link each job to a property and a date,
            like a turnover cleaning after a checkout. Compare quotes, accept one, message the provider, track the job, pay and leave a review.
          </p>
          <p className="text-sm text-ink-muted">This page is only visible to owners.</p>
        </Card>
      </div>
    </PortalShell>
  );
}
