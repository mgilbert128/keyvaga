import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { requirePortal } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { reviewProvider } from "@/app/actions/provider";
import { categoryLabel } from "@/lib/services";
import { PortalShell } from "@/components/layout/PortalShell";
import { adminNav } from "@/components/layout/portal-nav";
import { Card, Chip } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";

export const metadata: Metadata = { title: "Providers" };

export default function Page() {
  return (
    <Suspense fallback={<div className="h-screen" aria-hidden="true" />}>
      <Providers />
    </Suspense>
  );
}

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

async function Providers() {
  await connection();
  const user = await requirePortal("admin", "/admin/providers");
  const [pending, live] = await Promise.all([
    db.providerProfile.findMany({ where: { status: "PENDING_REVIEW" }, orderBy: { submittedAt: "asc" }, include: { user: { select: { name: true, email: true } }, photos: { orderBy: { position: "asc" } } } }),
    db.providerProfile.findMany({ where: { status: { in: ["APPROVED", "PAUSED"] } }, orderBy: { businessName: "asc" }, select: { id: true, businessName: true, status: true, categories: true, region: true, serviceAreas: true } }),
  ]);

  // Coverage map: state → city → providers. "All of <state>" for providers with no city list.
  const byState = new Map<string, Map<string, typeof live>>();
  for (const p of live) {
    const state = p.region.toUpperCase() || "No state";
    const cities = p.serviceAreas.length ? p.serviceAreas.map(titleCase) : [`All of ${state}`];
    const m = byState.get(state) ?? new Map();
    for (const c of cities) m.set(c, [...(m.get(c) ?? []), p]);
    byState.set(state, m);
  }
  const states = [...byState.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <PortalShell portal="Admin" user={user} nav={adminNav("/admin/providers")}>
      <div className="flex flex-col gap-8 pt-6 sm:pt-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Providers</h1>

        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-bold">Waiting for approval ({pending.length})</h2>
          {pending.length === 0 ? <p className="text-ink-muted">Nothing waiting.</p> : pending.map((p) => (
            <Card key={p.id} className="flex flex-col gap-4">
              <div>
                <h3 className="text-xl font-bold">{p.businessName}</h3>
                <p className="text-sm text-ink-muted">{p.user.name} · {p.user.email} · submitted {p.submittedAt?.toLocaleDateString("en-US") ?? "—"}</p>
              </div>
              <ul className="flex flex-wrap gap-2">{p.categories.map((c) => <li key={c}><Chip>{categoryLabel(c)}</Chip></li>)}</ul>
              <p><strong>Serves:</strong> {p.serviceAreaText || `all of ${p.region}`} ({p.region})</p>
              <p className="whitespace-pre-line text-ink-muted">{p.bio}</p>
              {p.pricingGuidance ? <p className="text-sm"><strong>Pricing:</strong> {p.pricingGuidance}</p> : null}
              {p.photos.length ? (
                <ul className="flex gap-2 overflow-x-auto" aria-label="Photos">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.photos.map((ph) => <li key={ph.id} className="shrink-0"><img src={ph.url} alt="" className="h-24 w-24 rounded-lg object-cover" /></li>)}
                </ul>
              ) : null}
              <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-end">
                <form action={reviewProvider.bind(null, p.id, "approve")}><Button type="submit">Approve</Button></form>
                <form action={reviewProvider.bind(null, p.id, "reject")} className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-end">
                  <label htmlFor={`pnote-${p.id}`} className="sr-only">Note to provider</label>
                  <input id={`pnote-${p.id}`} name="note" placeholder="What should they change?" className={inputClass} maxLength={1000} />
                  <Button type="submit" variant="secondary">Request changes</Button>
                </form>
              </div>
            </Card>
          ))}
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-bold">Providers by location ({live.length})</h2>
          {states.length === 0 ? <p className="text-ink-muted">No approved providers yet.</p> : states.map(([state, cities]) => (
            <details key={state} className="rounded-card border border-line bg-surface" open={states.length <= 3}>
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-6 py-3 text-lg font-bold [&::-webkit-details-marker]:hidden">
                <span>{state}</span>
                <span className="text-sm font-normal text-ink-muted">{cities.size} area{cities.size === 1 ? "" : "s"}</span>
              </summary>
              <ul className="flex flex-col divide-y divide-line px-6 pb-4">
                {[...cities.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([city, ps]) => (
                  <li key={city} className="flex flex-col gap-1 py-3 sm:flex-row sm:justify-between">
                    <span className="font-semibold">{city}</span>
                    <span className="text-sm text-ink-muted">
                      {ps.map((p) => `${p.businessName}${p.status === "PAUSED" ? " (paused)" : ""} · ${p.categories.map(categoryLabel).join(", ")}`).join(" | ")}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </section>
      </div>
    </PortalShell>
  );
}
