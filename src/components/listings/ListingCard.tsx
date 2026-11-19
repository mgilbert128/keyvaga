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
          {listing.complex ? `${listing.complex.name} · ` : ""}{listing.city}, {listing.region} · Sleeps {listing.maxGuests} · {listing.bedrooms} bd
        </p>
        {listing.rating ? (
          <p className="mt-1 text-sm font-semibold" aria-label={`Rated ${listing.rating.average} out of 5 from ${listing.rating.count} review${listing.rating.count === 1 ? "" : "s"}`}>
            <span aria-hidden="true" className="text-brand">★</span> {listing.rating.average.toFixed(1)} <span className="font-normal text-ink-muted">({listing.rating.count})</span>
          </p>
        ) : null}
        {listing.verified ? (
          <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-soft px-2.5 py-0.5 text-xs font-semibold text-on-soft" title="Keyvaga checked this host's ownership documents">
            <span aria-hidden="true">✓</span> Verified host
          </p>
        ) : null}
      </div>
      {listing.price.kind === "stay" ? (
        <div className="mt-auto">
          <p className="text-xl font-semibold sm:text-2xl">
            {formatCents(listing.price.totalCents)}{" "}
            <span className="text-base font-medium sm:text-lg">for {listing.price.nights} {listing.price.nights === 1 ? "night" : "nights"}</span>
          </p>
          <p className="text-sm text-ink-muted">
            {formatCents(listing.price.nightlyCents)} avg / night · includes cleaning and fees, before taxes
          </p>
        </div>
      ) : (
        <div className="mt-auto">
          <p className="text-xl font-semibold sm:text-2xl">
            <span className="text-base font-medium sm:text-lg">Typically </span>
            {formatCents(listing.price.nightlyCents)} <span className="text-base font-medium sm:text-lg">/ night</span>
          </p>
          {listing.price.minNights ? (
            <p className="text-sm text-ink-muted">{listing.price.minNights}-night minimum stay</p>
          ) : null}
        </div>
      )}
    </article>
  );
}
