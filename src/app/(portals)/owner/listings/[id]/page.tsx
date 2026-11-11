import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { requirePortal } from "@/lib/auth/dal";
import { getOwnedListing } from "@/lib/owner-listings";
import { PortalShell } from "@/components/layout/PortalShell";
import { ownerNav } from "@/components/layout/portal-nav";
import { StatusChip } from "@/components/owner/StatusChip";
import { StatusActions } from "@/components/owner/StatusActions";
import { ListingEditForm } from "@/components/owner/ListingEditForm";
import { PhotoManager } from "@/components/owner/PhotoManager";
import { centsToDollarsInput } from "@/lib/pricing";
import type { OwnerAction } from "@/lib/listing-policy";

export const metadata: Metadata = { title: "Edit listing" };

export default function Page({ params, searchParams }: PageProps<"/owner/listings/[id]">) {
  return (
    <Suspense fallback={<div className="h-screen" aria-hidden="true" />}>
      <EditListing params={params} searchParams={searchParams} />
    </Suspense>
  );
}

const ACTIONS_BY_STATUS: Record<string, OwnerAction[]> = {
  DRAFT: [],
  PENDING_REVIEW: ["withdraw"],
  PUBLISHED: ["pause"],
  PAUSED: ["unpause"],
};

async function EditListing({ params, searchParams }: Pick<PageProps<"/owner/listings/[id]">, "params" | "searchParams">) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requirePortal("owner", `/owner/listings/${id}`);
  const listing = await getOwnedListing(user, id);

  return (
    <PortalShell portal="Owner" user={user} nav={ownerNav("/owner/listings")}>
      <div className="flex flex-col gap-6 pt-6 sm:pt-10">
        <Link href="/owner/listings" className="inline-flex min-h-11 items-center self-start text-brand underline underline-offset-4">
          ← All listings
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{listing.title}</h1>
              <StatusChip status={listing.status} />
            </div>
            {listing.status === "PUBLISHED" ? (
              <Link href={`/stays/${listing.slug}`} className="text-brand underline underline-offset-4">View public page</Link>
            ) : null}
          </div>
          <StatusActions id={listing.id} actions={ACTIONS_BY_STATUS[listing.status] ?? []} />
        </div>

        {sp.created ? (
          <p role="status" className="rounded-control bg-soft px-4 py-3 font-medium text-on-soft">
            Draft created. Fill in the details below and add photos, then submit it for review.
          </p>
        ) : null}
        {listing.status === "PENDING_REVIEW" ? (
          <p className="rounded-control bg-warn-soft px-4 py-3 text-on-warn-soft">
            This listing is waiting for review. You can still make changes.
          </p>
        ) : null}
        {listing.status === "DRAFT" && listing.reviewNote ? (
          <div role="note" className="rounded-control border border-warn-soft bg-warn-soft px-4 py-3 text-on-warn-soft">
            <p className="font-semibold">Changes requested by Keyvaga</p>
            <p>{listing.reviewNote}</p>
          </div>
        ) : null}

        <PhotoManager listingId={listing.id} photos={listing.photos.map((p) => ({ id: p.id, url: p.url, alt: p.alt }))} />

        <ListingEditForm
          listing={{
            id: listing.id,
            status: listing.status,
            title: listing.title,
            summary: listing.summary,
            description: listing.description,
            propertyType: listing.propertyType,
            addressLine1: listing.addressLine1,
            addressLine2: listing.addressLine2,
            city: listing.city,
            region: listing.region,
            postalCode: listing.postalCode,
            bedrooms: listing.bedrooms,
            bathrooms: listing.bathrooms.toString(),
            maxGuests: listing.maxGuests,
            nightlyRate: listing.nightlyRateCents ? centsToDollarsInput(listing.nightlyRateCents) : "",
            cleaningFee: listing.cleaningFeeCents ? centsToDollarsInput(listing.cleaningFeeCents) : "",
            minNights: listing.minNights,
            checkInTime: listing.checkInTime,
            checkOutTime: listing.checkOutTime,
            houseRules: listing.houseRules,
            amenities: listing.amenities,
          }}
        />
      </div>
    </PortalShell>
  );
}
