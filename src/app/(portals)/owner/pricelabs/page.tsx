import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { connection } from "next/server";
import { requirePortal } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { PriceLabsError, priceLabsOverview } from "@/lib/pricelabs";
import { connectPriceLabsAction, disconnectPriceLabsAction, linkPriceLabsAction, syncPriceLabsAction, unlinkPriceLabsAction } from "@/app/actions/pricelabs";
import { PortalShell } from "@/components/layout/PortalShell";
import { ownerNav } from "@/components/layout/portal-nav";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";

export const metadata: Metadata = { title: "PriceLabs" };

const when = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });
const str = (v: unknown) => (typeof v === "string" ? v.slice(0, 300) : undefined);

export default function Page({ searchParams }: PageProps<"/owner/pricelabs">) {
  return (
    <Suspense fallback={<div className="h-screen" aria-hidden="true" />}>
      <PriceLabsPage searchParams={searchParams} />
    </Suspense>
  );
}

async function PriceLabsPage({ searchParams }: { searchParams: PageProps<"/owner/pricelabs">["searchParams"] }) {
  await connection();
  const user = await requirePortal("owner", "/owner/pricelabs");
  const sp = await searchParams;
  let overview: Awaited<ReturnType<typeof priceLabsOverview>> = null;
  let loadError = "";
  try {
    overview = await priceLabsOverview(user.id);
  } catch (e) {
    loadError = e instanceof PriceLabsError ? e.message : "Couldn't reach PriceLabs right now. Please try again in a minute.";
    if (!(e instanceof PriceLabsError)) console.error("pricelabs overview failed", e instanceof Error ? e.message : e);
  }
  const connected = Boolean(overview) || Boolean(loadError);
  const linkable = connected
    ? await db.listing.findMany({ where: { ownerId: user.id, deletedAt: null, pricelabsListingId: null, hospitablePropertyId: null }, select: { id: true, title: true }, orderBy: { title: "asc" } })
    : [];

  return (
    <PortalShell portal="Owner" user={user} nav={ownerNav("/owner/pricing")}>
      <div className="flex flex-col gap-6 pt-6 sm:pt-10">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">PriceLabs</h1>
          <p className="max-w-3xl text-ink-muted">
            Connect your PriceLabs account and your PriceLabs nightly prices will update on Keyvaga automatically, for the next 12 months.
            Linked listings use PriceLabs prices in place of the prices set on Keyvaga. Your availability still comes from your calendar sync.
          </p>
        </div>
        {str(sp.error) ? <p role="alert" className="rounded-control border border-danger px-4 py-3 font-medium text-danger">{str(sp.error)}</p> : null}
        {str(sp.saved) ? <p role="status" className="rounded-control bg-soft px-4 py-3 font-medium text-on-soft">{str(sp.saved)}</p> : null}

        {!connected ? (
          <Card className="flex flex-col gap-4">
            <h2 className="text-xl font-bold">Connect PriceLabs</h2>
            <ol className="flex list-decimal flex-col gap-1 pl-5">
              <li>Log in to PriceLabs and open <strong>Account Settings</strong>.</li>
              <li>Click <strong>API Details</strong>, then <strong>Get PriceLabs API Key</strong>.</li>
              <li>Click <strong>Copy API Key</strong> and paste it below.</li>
            </ol>
            <p className="text-sm text-ink-muted">
              PriceLabs charges $1 per listing per month for API syncing, billed by PriceLabs. Make sure each listing is syncing in PriceLabs.
              Your key is stored encrypted and is never shown again. You can disconnect any time.
            </p>
            <form action={connectPriceLabsAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex flex-1 flex-col gap-1">
                <label htmlFor="apiKey" className="font-semibold">PriceLabs API key</label>
                <input id="apiKey" name="apiKey" type="password" autoComplete="off" required maxLength={300} className={inputClass} />
              </div>
              <Button type="submit">Connect</Button>
            </form>
          </Card>
        ) : (
          <>
            <Card className="flex flex-wrap items-center justify-between gap-4">
              <p>
                <strong>Connected</strong>
                {overview ? <span className="text-ink-muted"> · key ending in {overview.conn.keyLast4}</span> : null}
              </p>
              <form action={disconnectPriceLabsAction}><Button type="submit" variant="ghost">Disconnect</Button></form>
            </Card>
            {loadError ? (
              <Card><p role="alert">{loadError}</p></Card>
            ) : !overview?.listings.length ? (
              <Card><p>No listings found in your PriceLabs account. Add your listings in PriceLabs, turn on sync, then come back.</p></Card>
            ) : (
              <ul className="flex flex-col gap-4">
                {overview.listings.map((p) => (
                  <li key={`${p.pms}|${p.id}`}>
                    <Card className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex flex-col gap-1">
                        <p className="text-lg font-bold">{p.name}</p>
                        <p className="text-sm capitalize text-ink-muted">{p.pms}</p>
                        {p.listing ? (
                          <p className={`text-sm ${p.listing.pricelabsSyncError ? "text-danger" : "text-ink-muted"}`}>
                            Linked to <Link href={`/owner/listings/${p.listing.id}`} className="font-semibold text-brand underline underline-offset-4">{p.listing.title}</Link>
                            {p.listing.pricelabsSyncError ? ` · ${p.listing.pricelabsSyncError}` : p.listing.pricelabsSyncedAt ? ` · prices updated ${when.format(p.listing.pricelabsSyncedAt)}` : ""}
                          </p>
                        ) : null}
                      </div>
                      {p.listing ? (
                        <div className="flex flex-wrap gap-2">
                          <form action={syncPriceLabsAction.bind(null, p.listing.id)}><Button type="submit" variant="secondary">Update prices now</Button></form>
                          <form action={unlinkPriceLabsAction.bind(null, p.listing.id)}><Button type="submit" variant="ghost">Unlink</Button></form>
                        </div>
                      ) : linkable.length ? (
                        <form action={linkPriceLabsAction.bind(null, p.id, p.pms)} className="flex items-end gap-2">
                          <div className="flex flex-col gap-1">
                            <label htmlFor={`link-${p.pms}-${p.id}`} className="text-sm font-semibold">Use these prices for</label>
                            <select id={`link-${p.pms}-${p.id}`} name="listingId" className={`${inputClass} appearance-auto`} defaultValue="">
                              <option value="" disabled>Choose a listing…</option>
                              {linkable.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
                            </select>
                          </div>
                          <Button type="submit" variant="secondary">Link</Button>
                        </form>
                      ) : (
                        <p className="text-sm text-ink-muted">All your Keyvaga listings are already linked.</p>
                      )}
                    </Card>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-sm text-ink-muted">
              Listings that sync with Hospitable aren&apos;t shown in the list above: if you use PriceLabs through Hospitable, those prices already come in through Hospitable.
            </p>
          </>
        )}
      </div>
    </PortalShell>
  );
}
