import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { requirePortal } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { PortalShell } from "@/components/layout/PortalShell";
import { ownerNav } from "@/components/layout/portal-nav";
import { ButtonLink } from "@/components/ui/Button";
import { StatusChip } from "@/components/owner/StatusChip";
import { formatCents } from "@/lib/money";
import { tintAt } from "@/lib/tint";

export const metadata: Metadata = { title: "Your listings" };

export default function Page() {
  return (
    <Suspense fallback={<div className="h-screen" aria-hidden="true" />}>
      <Listings />
    </Suspense>
  );
}

async function Listings() {
  const user = await requirePortal("owner", "/owner/listings");
  const listings = await db.listing.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "desc" },
    include: { photos: { orderBy: { position: "asc" }, take: 1 } },
  });

  return (
    <PortalShell portal="Owner" user={user} nav={ownerNav("/owner/listings")}>
      <div className="flex flex-col gap-6 pt-6 sm:pt-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Your listings</h1>
          <ButtonLink href="/owner/listings/new">Add a listing</ButtonLink>
        </div>

        {listings.length === 0 ? (
          <div className="rounded-card border border-dashed border-line-strong bg-surface p-8 text-center">
            <h2 className="text-xl font-bold">No listings yet</h2>
            <p className="mt-2 text-ink-muted">Add your first property. You can save it as a draft and finish it later.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {listings.map((l, i) => (
              <li key={l.id} className="relative flex flex-col gap-4 rounded-card border border-line bg-surface p-4 sm:flex-row sm:items-center sm:p-5">
                {l.photos[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.photos[0].url} alt="" className="aspect-[4/3] w-full rounded-xl object-cover sm:w-40" />
                ) : (
                  <div className={`aspect-[4/3] w-full rounded-xl sm:w-40 ${tintAt(i)}`} aria-hidden="true" />
                )}
                <div className="flex flex-1 flex-col gap-1">
                  <h2 className="text-xl font-bold">
                    <Link href={`/owner/listings/${l.id}`} className="after:absolute after:inset-0 after:rounded-card">
                      {l.title}
                    </Link>
                  </h2>
                  <p className="text-ink-muted">
                    {[l.city, l.region].filter(Boolean).join(", ") || "Location not set"} ·{" "}
                    {l.nightlyRateCents > 0 ? `${formatCents(l.nightlyRateCents)} / night` : "Price not set"}
                  </p>
                  {l.status === "DRAFT" && l.reviewNote ? (
                    <p className="text-sm font-medium text-on-warn-soft">Changes requested: {l.reviewNote}</p>
                  ) : null}
                </div>
                <StatusChip status={l.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </PortalShell>
  );
}
