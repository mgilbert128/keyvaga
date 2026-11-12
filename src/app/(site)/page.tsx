import { Suspense } from "react";
import { StaySearchForm } from "@/components/search/StaySearchForm";
import { ListingCard } from "@/components/listings/ListingCard";
import { ButtonLink } from "@/components/ui/Button";
import { Card, Chip } from "@/components/ui/Card";
import { getFeaturedListings } from "@/lib/listings";

const portals = [
  {
    chip: "Guests",
    title: "Trips, messages, check-in",
    body: "Manage bookings, payments and guidebooks.",
    cta: "Guest portal",
    href: "/trips",
  },
  {
    chip: "Owners",
    title: "List and run your rentals",
    body: "Calendar, pricing, bookings and payouts.",
    cta: "Owner portal",
    href: "/owner",
  },
  {
    chip: "Services",
    title: "Offer your services",
    body: "Cleaners, handymen and local pros: get jobs from Keyvaga hosts.",
    cta: "Join as a provider",
    href: "/signup?intent=PROVIDER",
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col gap-14 pt-8 sm:gap-16 sm:pt-16">
      <section aria-labelledby="hero-title" className="flex flex-col gap-8">
        <div className="flex max-w-3xl flex-col gap-5">
          <h1 id="hero-title" className="text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
            Your key to the ultimate vacation getaway
          </h1>
          <p className="text-lg text-ink-muted sm:text-xl">
            Book a stay, list your place, and find trusted local help, all with Keyvaga.
          </p>
        </div>
        <StaySearchForm />
      </section>

      <section aria-labelledby="portals-title" className="flex flex-col gap-6">
        <h2 id="portals-title" className="text-2xl font-bold tracking-tight sm:text-3xl">
          Three portals, one account
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {portals.map((p) => (
            <Card key={p.chip} className="flex flex-col items-start gap-4">
              <Chip>{p.chip}</Chip>
              <div className="flex flex-col gap-2">
                <h3 className="text-xl font-bold tracking-tight sm:text-2xl">{p.title}</h3>
                <p className="text-ink-muted">{p.body}</p>
              </div>
              <ButtonLink href={p.href} variant="secondary" className="mt-auto">
                {p.cta}
              </ButtonLink>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="featured-title" className="flex flex-col gap-6">
        <h2 id="featured-title" className="text-2xl font-bold tracking-tight sm:text-3xl">
          Featured stays
        </h2>
        <Suspense fallback={<FeaturedSkeleton />}>
          <FeaturedStays />
        </Suspense>
      </section>
    </div>
  );
}

async function FeaturedStays() {
  const listings = await getFeaturedListings();
  if (listings.length === 0) {
    return <p className="text-ink-muted">New stays are on their way. Check back soon.</p>;
  }
  return (
    <ul className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {listings.map((l, i) => (
        <li key={l.id} className="flex">
          <div className="w-full"><ListingCard listing={l} index={i} /></div>
        </li>
      ))}
    </ul>
  );
}

function FeaturedSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-80 animate-pulse rounded-card border border-line bg-surface" />
      ))}
    </div>
  );
}
