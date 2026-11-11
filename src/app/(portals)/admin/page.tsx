import { Suspense } from "react";
import type { Metadata } from "next";
import { requirePortal } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { PortalShell } from "@/components/layout/PortalShell";
import { adminNav } from "@/components/layout/portal-nav";
import { Button } from "@/components/ui/Button";
import { TextAreaField } from "@/components/ui/Select";
import { reviewListing } from "@/app/actions/listings";
import { formatCents } from "@/lib/money";
import { amenityLabel } from "@/lib/amenities";
import { propertyTypeLabel } from "@/lib/property-types";

export const metadata: Metadata = { title: "Listing reviews" };

export default function Page() {
  return (
    <Suspense fallback={<div className="h-screen" aria-hidden="true" />}>
      <Reviews />
    </Suspense>
  );
}

async function Reviews() {
  const user = await requirePortal("admin", "/admin");
  const pending = await db.listing.findMany({
    where: { status: "PENDING_REVIEW" },
    orderBy: { submittedAt: "asc" },
    include: { owner: { select: { name: true, email: true } }, photos: { orderBy: { position: "asc" } } },
  });

  return (
    <PortalShell portal="Admin" user={user} nav={adminNav("/admin")}>
      <div className="flex flex-col gap-6 pt-6 sm:pt-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Listing reviews</h1>
        <p className="text-ink-muted">
          {pending.length === 0 ? "Nothing waiting for review." : `${pending.length} listing${pending.length === 1 ? "" : "s"} waiting for review, oldest first.`}
        </p>

        <ul className="flex flex-col gap-6">
          {pending.map((l) => (
            <li key={l.id} className="flex flex-col gap-5 rounded-card border border-line bg-surface p-6 sm:p-8">
              <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-bold">{l.title}</h2>
                <p className="text-ink-muted">
                  {propertyTypeLabel(l.propertyType)} · {l.bedrooms} bd · {l.bathrooms.toString()} ba · sleeps {l.maxGuests} ·{" "}
                  {formatCents(l.nightlyRateCents)}/night{l.cleaningFeeCents ? ` + ${formatCents(l.cleaningFeeCents)} cleaning` : ""} · min {l.minNights} night{l.minNights === 1 ? "" : "s"}
                </p>
                <p className="text-ink-muted">
                  {[l.addressLine1, l.addressLine2, l.city, l.region, l.postalCode].filter(Boolean).join(", ")}
                </p>
                <p className="text-sm text-ink-muted">Owner: {l.owner.name} ({l.owner.email}) · submitted {l.submittedAt?.toLocaleDateString("en-US") ?? "—"}</p>
              </div>
              {l.photos.length ? (
                <ul className="flex gap-2 overflow-x-auto pb-1" aria-label="Photos">
                  {l.photos.map((p) => (
                    <li key={p.id} className="shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt={p.alt} className="h-28 w-40 rounded-lg object-cover" loading="lazy" />
                    </li>
                  ))}
                </ul>
              ) : null}
              {l.summary ? <p className="font-medium">{l.summary}</p> : null}
              {l.description ? <p className="whitespace-pre-line text-ink-muted">{l.description}</p> : null}
              {l.amenities.length ? <p className="text-sm text-ink-muted">Amenities: {l.amenities.map(amenityLabel).join(", ")}</p> : null}
              {l.houseRules ? <p className="whitespace-pre-line text-sm text-ink-muted">House rules: {l.houseRules}</p> : null}

              <div className="flex flex-col gap-4 border-t border-line pt-5 lg:flex-row lg:items-end">
                <form action={reviewListing.bind(null, l.id, "approve")}>
                  <Button type="submit">Approve and publish</Button>
                </form>
                <form action={reviewListing.bind(null, l.id, "reject")} className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <TextAreaField label="Note to owner" id={`note-${l.id}`} name="note" rows={2} placeholder="What should they change?" />
                  </div>
                  <Button type="submit" variant="secondary">Request changes</Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </PortalShell>
  );
}
