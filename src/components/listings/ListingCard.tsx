import Link from "next/link";
import { formatCents } from "@/lib/money";
import { tintAt, tintFor } from "@/lib/tint";
import type { ListingCardData } from "@/lib/listings";

export function ListingCard({ listing, index, query }: { listing: ListingCardData; index?: number; query?: string }) {
  const tint = index === undefined ? tintFor(listing.slug) : tintAt(index);
  return (
    <article className="group relative flex h-full flex-col gap-4 rounded-card border border-line bg-surface p-4 sm:p-6">
      {listing.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={listing.coverUrl} alt={listing.coverAlt} className="aspect-[16/10] w-full rounded-xl object-cover" loading="lazy" />
      ) : (
        <div className={`aspect-[16/10] w-full rounded-xl ${tint}`} role="img" aria-label={`No photo yet for ${listing.title}`} />
      )}
      <div>
        <h3 className="text-xl font-bold tracking-tight sm:text-2xl">
          <Link href={`/stays/${listing.slug}${query ? `?${query}` : ""}`} className="after:absolute after:inset-0 after:rounded-card">
            {listing.title}
          </Link>
        </h3>
        <p className="text-ink-muted">
          {listing.city}, {listing.region} · Sleeps {listing.maxGuests} · {listing.bedrooms} bd
        </p>
      </div>
      <p className="mt-auto text-xl font-semibold sm:text-2xl">
        {formatCents(listing.nightlyRateCents)} <span className="text-base font-medium sm:text-lg">/ night</span>
      </p>
    </article>
  );
}
