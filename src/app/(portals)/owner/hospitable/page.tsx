import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { connection } from "next/server";
import { requirePortal } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { HospitableError, canUseHospitable, hospitableOverview } from "@/lib/hospitable";
import { importPropertyAction, linkPropertyAction, syncListingAction, unlinkListingAction } from "@/app/actions/hospitable";
import { PortalShell } from "@/components/layout/PortalShell";
import { ownerNav } from "@/components/layout/portal-nav";
import { Card } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";

export const metadata: Metadata = { title: "Hospitable" };

const when = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });

export default function Page({ searchParams }: PageProps<"/owner/hospitable">) {
  return (
    <Suspense fallback={<div className="h-screen" aria-hidden="true" />}>
      <HospitablePage searchParams={searchParams} />
    </Suspense>
  );
}

const str = (v: unknown) => (typeof v === "string" ? v.slice(0, 300) : undefined);

async function HospitablePage({ searchParams }: { searchParams: PageProps<"/owner/hospitable">["searchParams"] }) {
  await connection();
  const user = await requirePortal("owner", "/owner/hospitable");
  const sp = await searchParams;
  const allowed = canUseHospitable(user);
  let rows: Awaited<ReturnType<typeof hospitableOverview>> = [];
  let loadError = "";
  if (allowed) {
    try {
      rows = await hospitableOverview(user.id);
    } catch (e) {
      loadError = e instanceof HospitableError ? e.message : "Couldn't reach Hospitable right now. Please try again in a minute.";
      if (!(e instanceof HospitableError)) console.error("hospitable overview failed", e);
    }
  }
  const unlinked = allowed ? await db.listing.findMany({ where: { ownerId: user.id, hospitablePropertyId: null }, select: { id: true, title: true }, orderBy: { title: "asc" } }) : [];

  return (
    <PortalShell portal="Owner" user={user} nav={ownerNav("/owner/hospitable")}>
      <div className="flex flex-col gap-6 pt-6 sm:pt-10">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Hospitable</h1>
          <p className="max-w-3xl text-ink-muted">
            Bring your Hospitable properties into Keyvaga. Import creates a draft listing with the details and photos; link connects a listing you already made.
            Linked listings use your Hospitable nightly prices and availability (synced daily, hourly when guests are looking, and right before every booking),
            and Keyvaga bookings block those nights in Hospitable so your other channels close.
          </p>
        </div>
        {str(sp.error) ? <p role="alert" className="rounded-control border border-danger px-4 py-3 font-medium text-danger">{str(sp.error)}</p> : null}
        {str(sp.saved) ? <p role="status" className="rounded-control bg-soft px-4 py-3 font-medium text-on-soft">{str(sp.saved)}</p> : null}

        {!allowed ? (
          <Card className="flex flex-col gap-2">
            <h2 className="text-xl font-bold">Coming soon</h2>
            <p className="text-ink-muted">A direct Hospitable connection for all hosts is on the way. Today you can sync Hospitable calendars with iCal links from your listing&apos;s calendar page.</p>
            <ButtonLink href="/owner/calendar" variant="secondary" className="self-start">Go to calendar sync</ButtonLink>
          </Card>
        ) : loadError ? (
          <Card><p role="alert">{loadError}</p></Card>
        ) : rows.length === 0 ? (
          <Card><p>No properties found in your Hospitable account.</p></Card>
        ) : (
          <ul className="flex flex-col gap-4">
            {rows.map((p) => (
              <li key={p.id}>
                <Card className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-col gap-1">
                    <p className="text-lg font-bold">{p.name}</p>
                    <p className="text-ink-muted">{[p.city, p.state].filter(Boolean).join(", ")}</p>
                    {p.listing ? (
                      <p className={`text-sm ${p.listing.hospitableSyncError ? "text-danger" : "text-ink-muted"}`}>
                        Linked to <Link href={`/owner/listings/${p.listing.id}`} className="font-semibold text-brand underline underline-offset-4">{p.listing.title}</Link>
                        {p.listing.hospitableSyncError ? ` · ${p.listing.hospitableSyncError}` : p.listing.hospitableSyncedAt ? ` · synced ${when.format(p.listing.hospitableSyncedAt)}` : ""}
                      </p>
                    ) : null}
                  </div>
                  {p.listing ? (
                    <div className="flex flex-wrap gap-2">
                      <form action={syncListingAction.bind(null, p.listing.id)}><Button type="submit" variant="secondary">Sync now</Button></form>
                      <form action={unlinkListingAction.bind(null, p.listing.id)}><Button type="submit" variant="ghost">Unlink</Button></form>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                      <form action={importPropertyAction.bind(null, p.id)}><Button type="submit">Import as new listing</Button></form>
                      {unlinked.length ? (
                        <form action={linkPropertyAction.bind(null, p.id)} className="flex items-end gap-2">
                          <div className="flex flex-col gap-1">
                            <label htmlFor={`link-${p.id}`} className="text-sm font-semibold">or link to</label>
                            <select id={`link-${p.id}`} name="listingId" className={`${inputClass} appearance-auto`} defaultValue="">
                              <option value="" disabled>Choose a listing…</option>
                              {unlinked.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
                            </select>
                          </div>
                          <Button type="submit" variant="secondary">Link</Button>
                        </form>
                      ) : null}
                    </div>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PortalShell>
  );
}
