import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { requirePortal } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { PortalShell } from "@/components/layout/PortalShell";
import { guestNav } from "@/components/layout/portal-nav";
import { ListingCard } from "@/components/listings/ListingCard";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Saved stays" };

export default function Page() {
  return (
    <Suspense fallback={<div className="h-screen" aria-hidden="true" />}>
      <Saved />
    </Suspense>
  );
}

async function Saved() {
  await connection();
  const user = await requirePortal("guest", "/saved");
  const saved = await db.savedListing.findMany({
    where: { userId: user.id, listing: { status: "PUBLISHED" } },
    orderBy: { createdAt: "desc" },
    include: { listing: { select: { id: true, slug: true, title: true, city: true, region: true, maxGuests: true, bedrooms: true, nightlyRateCents: true, photos: { orderBy: { position: "asc" }, take: 1, select: { url: true, alt: true } } } } },
  });
  return (
    <PortalShell user={user} nav={guestNav("/saved")}>
      <div className="flex flex-col gap-6 pt-6 sm:pt-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Saved stays</h1>
        {saved.length === 0 ? (
          <div className="flex flex-col items-start gap-4 rounded-card border border-dashed border-line-strong bg-surface p-8">
            <p>Tap <strong>♡ Save</strong> on any stay to keep it here.</p>
            <ButtonLink href="/search">Find a stay</ButtonLink>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {saved.map(({ listing: { photos, ...l } }, i) => (
              <li key={l.id}><ListingCard listing={{ ...l, coverUrl: photos[0]?.url ?? null, coverAlt: photos[0]?.alt || l.title }} index={i} /></li>
            ))}
          </ul>
        )}
      </div>
    </PortalShell>
  );
}
