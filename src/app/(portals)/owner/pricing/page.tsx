import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { connection } from "next/server";
import { requirePortal } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { ownerListingsWithSelection } from "@/lib/owner-pages";
import { addSeason, deleteSeason, updatePricing } from "@/app/actions/calendar";
import { PortalShell } from "@/components/layout/PortalShell";
import { ownerNav } from "@/components/layout/portal-nav";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { buttonClass } from "@/components/ui/Button";
import { ActionForm } from "@/components/owner/ActionForm";
import { ListingPicker } from "@/components/owner/ListingPicker";
import { formatCents } from "@/lib/money";
import { centsToDollarsInput } from "@/lib/pricing";
import { addDays } from "@/lib/dates";

export const metadata: Metadata = { title: "Pricing" };
const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export default function Page({ searchParams }: PageProps<"/owner/pricing">) {
  return (
    <Suspense fallback={<div className="h-screen" aria-hidden="true" />}>
      <Pricing searchParams={searchParams} />
    </Suspense>
  );
}

async function Pricing({ searchParams }: { searchParams: PageProps<"/owner/pricing">["searchParams"] }) {
  const sp = await searchParams;
  await connection();
  const user = await requirePortal("owner", "/owner/pricing");
  const { listings, current } = await ownerListingsWithSelection(user.id, typeof sp.listing === "string" ? sp.listing : undefined);
  const listing = current ? await db.listing.findUniqueOrThrow({ where: { id: current.id }, include: { seasonalRates: { orderBy: { startDate: "asc" } } } }) : null;

  return (
    <PortalShell portal="Owner" user={user} nav={ownerNav("/owner/pricing")}>
      <div className="flex flex-col gap-6 pt-6 sm:pt-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Pricing</h1>
        {!listing ? (
          <p className="text-ink-muted">Add a listing first. <Link href="/owner/listings/new" className="text-brand underline">Add a listing</Link></p>
        ) : (
          <>
            <ListingPicker listings={listings} current={listing.id} action="/owner/pricing" />
            <Card className="flex flex-col gap-2">
              <h2 className="text-xl font-bold">Base price</h2>
              <p className="text-ink-muted">
                {formatCents(listing.nightlyRateCents)} per night · {listing.cleaningFeeCents ? `${formatCents(listing.cleaningFeeCents)} cleaning fee` : "no cleaning fee"} · {listing.minNights}-night minimum.{" "}
                <Link href={`/owner/listings/${listing.id}`} className="text-brand underline underline-offset-4">Change in listing details</Link>
              </p>
            </Card>

            <Card className="flex flex-col gap-4">
              <div>
                <h2 className="text-xl font-bold">Weekend rate and discounts</h2>
                <p className="text-ink-muted">Weekend rate applies to Friday and Saturday nights. Discounts apply to the nights, not the cleaning fee; the larger one applies.</p>
              </div>
              <ActionForm action={updatePricing.bind(null, listing.id)} submitLabel="Save pricing">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Field label="Weekend rate ($ per night)" id="weekendRate" inputMode="decimal" placeholder={`Same as base (${centsToDollarsInput(listing.nightlyRateCents)})`} defaultValue={listing.weekendRateCents ? centsToDollarsInput(listing.weekendRateCents) : ""} />
                  <Field label="Weekly discount, 7+ nights (%)" id="weeklyDiscount" type="number" min={0} max={90} step={1} inputMode="numeric" defaultValue={listing.weeklyDiscountBps / 100} />
                  <Field label="Monthly discount, 28+ nights (%)" id="monthlyDiscount" type="number" min={0} max={90} step={1} inputMode="numeric" defaultValue={listing.monthlyDiscountBps / 100} />
                </div>
              </ActionForm>
            </Card>

            <Card className="flex flex-col gap-4">
              <div>
                <h2 className="text-xl font-bold">Seasonal rates</h2>
                <p className="text-ink-muted">Set a different nightly rate for busy or quiet times. A seasonal rate replaces the base and weekend rate on those nights.</p>
              </div>
              {listing.seasonalRates.length ? (
                <ul className="flex flex-col divide-y divide-line">
                  {listing.seasonalRates.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <span><strong>{s.name}</strong> · {fmt.format(s.startDate)} – {fmt.format(addDays(s.endDate, -1))} nights · {formatCents(s.nightlyRateCents)}/night</span>
                      <form action={deleteSeason.bind(null, listing.id, s.id)}><button type="submit" className={buttonClass("ghost", "text-danger")}>Remove</button></form>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-ink-muted">No seasonal rates yet.</p>
              )}
              <ActionForm action={addSeason.bind(null, listing.id)} submitLabel="Add season" resetOnSuccess>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                  <Field label="Name" id="name" placeholder="Summer" maxLength={60} />
                  <Field label="First night" id="start" type="date" />
                  <Field label="Last night" id="end" type="date" />
                  <Field label="Rate ($ per night)" id="rate" inputMode="decimal" placeholder="250" />
                </div>
              </ActionForm>
            </Card>
          </>
        )}
      </div>
    </PortalShell>
  );
}
