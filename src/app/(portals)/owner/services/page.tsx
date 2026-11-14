import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { requirePortal } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { findProviders } from "@/lib/providers";
import { SERVICE_CATEGORIES, isServiceCategory, categoryLabel } from "@/lib/services";
import { parseISODate } from "@/lib/dates";
import { PortalShell } from "@/components/layout/PortalShell";
import { ownerNav } from "@/components/layout/portal-nav";
import { Card } from "@/components/ui/Card";
import { ButtonLink, buttonClass } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";
import { ProviderCard } from "@/components/services/ProviderCard";

export const metadata: Metadata = { title: "Find services" };
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
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const listings = await db.listing.findMany({ where: { ownerId: user.id }, orderBy: { createdAt: "asc" }, select: { id: true, title: true, city: true, region: true } });
  const listing = listings.find((l) => l.id === str("listing")) ?? listings[0] ?? null;
  const category = isServiceCategory(str("need")) ? str("need") : "";
  const date = parseISODate(str("date"));
  const text = str("q").slice(0, 60);
  const results = await findProviders({ category: category || undefined, city: listing?.city, region: listing?.region, text: text || undefined });
  const ctx = new URLSearchParams(Object.entries({ listing: listing?.id ?? "", category, date: str("date") }).filter(([, v]) => v)).toString();

  return (
    <PortalShell portal="Owner" user={user} nav={ownerNav("/owner/services")}>
      <div className="flex flex-col gap-8 pt-6 sm:pt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex max-w-2xl flex-col gap-3">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Find help for your property</h1>
            <p className="text-lg text-ink-muted">Compare vetted local pros and request quotes in one tap.</p>
          </div>
          <ButtonLink href={`/owner/jobs/new${ctx ? `?${ctx}` : ""}`}>Post a job</ButtonLink>
        </div>

        <form method="get" className="grid grid-cols-1 gap-4 rounded-card border border-line bg-surface p-6 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
          <div className="flex flex-col gap-2">
            <label htmlFor="need" className="text-sm font-semibold">What do you need?</label>
            <select id="need" name="need" defaultValue={category} className={inputClass}>
              <option value="">Any service</option>
              {SERVICE_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="listing" className="text-sm font-semibold">Property</label>
            <select id="listing" name="listing" defaultValue={listing?.id} className={inputClass}>
              {listings.map((l) => <option key={l.id} value={l.id}>{l.title}{l.city ? ` · ${l.city}` : ""}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="q" className="text-sm font-semibold">Name or town (optional)</label>
            <input id="q" name="q" defaultValue={text} className={inputClass} placeholder="e.g. Sparkle" />
          </div>
          {date ? <input type="hidden" name="date" value={str("date")} /> : null}
          <button type="submit" className={buttonClass("primary")}>Search pros</button>
        </form>

        {category || date ? (
          <p role="status" className="rounded-control bg-soft px-4 py-3 text-on-soft">
            Looking for: <strong>{category ? categoryLabel(category) : "a pro"}</strong>
            {listing ? <> for <strong>{listing.title}</strong></> : null}
            {date ? <> on <strong>{fmt.format(date)}</strong></> : null}
          </p>
        ) : null}

        <section aria-labelledby="results" className="flex flex-col gap-4">
          <h2 id="results" className="text-2xl font-bold">{listing?.city ? `Available near ${listing.city}` : "Available pros"}</h2>
          {!listing ? (
            <p className="text-ink-muted">Add a property first so we can find pros near it.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {results.map(({ profile, stats }) => (
                <li key={profile.id}>
                  <ProviderCard p={profile} stats={stats} requestHref={`/owner/jobs/new?provider=${profile.id}${ctx ? `&${ctx}` : ""}`} />
                </li>
              ))}
              <li>
                <Card className="flex h-full flex-col items-start gap-3 bg-soft">
                  <h3 className="text-xl font-bold">{results.length ? "Not sure who to hire?" : "No pros listed here yet"}</h3>
                  <p className="text-ink-muted">Post a job once and receive quotes from several providers in your area.</p>
                  <ButtonLink href={`/owner/jobs/new${ctx ? `?${ctx}` : ""}`} className="mt-auto">Post a job</ButtonLink>
                </Card>
              </li>
            </ul>
          )}
        </section>
      </div>
    </PortalShell>
  );
}
