import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { requirePortal } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { decideExternalRating } from "@/app/actions/external-ratings";
import { PortalShell } from "@/components/layout/PortalShell";
import { adminNav } from "@/components/layout/portal-nav";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";
import { PLATFORMS, isPlatform } from "@/lib/external-ratings";

export const metadata: Metadata = { title: "Verify ratings" };
const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago" });

export default function Page() {
  return (
    <Suspense fallback={<div className="h-screen" aria-hidden="true" />}>
      <Ratings />
    </Suspense>
  );
}

async function Ratings() {
  await connection();
  const user = await requirePortal("admin", "/admin/ratings");
  const [pending, recent] = await Promise.all([
    db.externalRating.findMany({ where: { status: "PENDING" }, orderBy: { updatedAt: "asc" }, include: { listing: { select: { title: true, slug: true, city: true, region: true, photos: { take: 1, orderBy: { position: "asc" }, select: { url: true } }, owner: { select: { name: true } } } } } }),
    db.externalRating.findMany({ where: { status: { not: "PENDING" } }, orderBy: { updatedAt: "desc" }, take: 20, include: { listing: { select: { title: true } } } }),
  ]);
  const label = (p: string) => (isPlatform(p) ? PLATFORMS[p].label : p);
  return (
    <PortalShell portal="Admin" user={user} nav={adminNav("/admin/ratings")}>
      <div className="flex flex-col gap-6 pt-6 sm:pt-10">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Verify ratings</h1>
          <p className="text-ink-muted">Open each link and check three things: it&apos;s the same property (photos and town match), the rating matches, and the review count matches. Then approve or reject.</p>
        </div>
        {pending.length === 0 ? <Card><p className="text-ink-muted">Nothing waiting.</p></Card> : (
          <ul className="flex flex-col gap-4">
            {pending.map((r) => (
              <li key={r.id}>
                <Card className="flex flex-col gap-4 sm:flex-row">
                  {r.listing.photos[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.listing.photos[0].url} alt="" className="h-32 w-full rounded-xl object-cover sm:w-48" />
                  ) : null}
                  <div className="flex flex-1 flex-col gap-2">
                    <p className="text-lg font-semibold">{r.listing.title}</p>
                    <p className="text-sm text-ink-muted">{r.listing.city}, {r.listing.region} · owner {r.listing.owner.name} · <a href={`/stays/${r.listing.slug}`} target="_blank" className="underline underline-offset-4">Keyvaga listing</a></p>
                    <p><strong>{label(r.platform)}:</strong> {r.rating} · {r.reviewCount.toLocaleString()} reviews · <a href={r.url} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-brand underline underline-offset-4">Open their {label(r.platform)} page</a></p>
                    <form action={decideExternalRating.bind(null, r.id)} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                      <label className="flex flex-1 flex-col gap-1 text-sm">
                        <span className="font-semibold">Note to owner if rejecting (optional)</span>
                        <input name="note" className={inputClass} placeholder="e.g. The review count on Airbnb is 180, not 230." />
                      </label>
                      <div className="flex gap-2">
                        <Button type="submit" name="decision" value="approve">Approve</Button>
                        <Button type="submit" name="decision" value="reject" variant="secondary">Reject</Button>
                      </div>
                    </form>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
        {recent.length ? (
          <Card className="flex flex-col gap-2">
            <h2 className="text-xl font-bold">Recently decided</h2>
            <ul className="flex flex-col divide-y divide-line text-sm">
              {recent.map((r) => (
                <li key={r.id} className="flex justify-between gap-4 py-2">
                  <span>{r.listing.title} · {label(r.platform)} {r.rating} ({r.reviewCount})</span>
                  <span className="text-ink-muted">{r.status === "APPROVED" ? "Approved" : "Rejected"} {fmt.format(r.updatedAt)}</span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    </PortalShell>
  );
}
