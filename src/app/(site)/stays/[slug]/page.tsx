import { Suspense } from "react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { tintFor } from "@/lib/tint";
import { Card, Chip } from "@/components/ui/Card";

export default function StayPage({ params }: PageProps<"/stays/[slug]">) {
  return (
    <Suspense fallback={<div className="mt-10 h-96 animate-pulse rounded-card bg-surface" aria-hidden="true" />}>
      <Stay params={params} />
    </Suspense>
  );
}

async function Stay({ params }: { params: PageProps<"/stays/[slug]">["params"] }) {
  const { slug } = await params;
  const listing = await db.listing.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: { owner: { select: { name: true } } },
  });
  if (!listing) notFound();

  return (
    <article className="flex flex-col gap-8 pt-6 sm:pt-10">
      <div className={`aspect-[21/9] w-full rounded-card ${tintFor(listing.slug)}`} role="img" aria-label={`Photo placeholder for ${listing.title}`} />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-4">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{listing.title}</h1>
          <p className="text-lg text-ink-muted">
            {listing.city}, {listing.region} · Sleeps {listing.maxGuests} · {listing.bedrooms} bedrooms ·{" "}
            {listing.bathrooms.toString()} baths
          </p>
          <p className="text-lg">{listing.summary}</p>
          {listing.description ? <p className="text-ink-muted">{listing.description}</p> : null}
          <p className="text-ink-muted">Hosted by {listing.owner.name}</p>
        </div>
        <Card className="flex h-fit flex-col gap-4">
          <p className="text-2xl font-semibold">
            {formatCents(listing.nightlyRateCents)} <span className="text-lg font-medium">/ night</span>
          </p>
          {listing.cleaningFeeCents > 0 ? (
            <p className="text-ink-muted">Cleaning fee {formatCents(listing.cleaningFeeCents)}</p>
          ) : null}
          {listing.instantBook ? <Chip className="self-start">Instant book</Chip> : null}
          <p className="text-sm text-ink-muted">Date selection and checkout are being built next.</p>
        </Card>
      </div>
    </article>
  );
}
