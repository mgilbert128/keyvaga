import Link from "next/link";
import { formatCents } from "@/lib/money";
import { tintAt, tintFor } from "@/lib/tint";
import type { ListingCardData } from "@/lib/listings";

export function ListingCard({ listing, index }: { listing: ListingCardData; index?: number }) {
  return (
    <article className="group relative flex flex-col gap-4 rounded-card border border-line bg-surface p-6 sm:p-8">
      <div className={`aspect-[16/9] w-full rounded-xl ${index === undefined ? tintFor(listing.slug) : tintAt(index)}`} role="img" aria-label={`Photo placeholder for ${listing.title}`} />
      <div>
        <h3 className="text-2xl font-bold tracking-tight">
          {/* Stretched link: the whole card is clickable, but there is one real link for assistive tech. */}
          <Link href={`/stays/${listing.slug}`} className="after:absolute after:inset-0 after:rounded-card focus-visible:outline-none group-has-[:focus-visible]:outline">
            {listing.title}
          </Link>
        </h3>
        <p className="text-ink-muted">
          {listing.city}, {listing.region} · Sleeps {listing.maxGuests}
        </p>
      </div>
      <p className="text-2xl font-semibold">
        {formatCents(listing.nightlyRateCents)} <span className="text-lg font-medium">/ night</span>
      </p>
    </article>
  );
}
