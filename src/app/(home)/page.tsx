import { Suspense } from "react";
import Link from "next/link";
import { HeroSearch } from "@/components/home/HeroSearch";
import { HomeLogoLink } from "@/components/brand/Logo";
import { UserMenu, UserMenuFallback, photoLink } from "@/components/layout/UserMenu";
import { ListingCard } from "@/components/listings/ListingCard";
import { ButtonLink } from "@/components/ui/Button";
import { Card, Chip } from "@/components/ui/Card";
import { getFeaturedListings } from "@/lib/listings";
import { FeesSection } from "@/components/marketing/FeesSection";
import { HeroCarousel, type Slide } from "@/components/home/HeroCarousel";
import { curatedHero, getHeroSlides } from "@/lib/hero";

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
    <div className="flex flex-col gap-14 sm:gap-20">
      {curatedHero() ? (
        <Hero slides={[{ type: "photo", ...curatedHero()! }]} />
      ) : (
        <Suspense fallback={<Hero slides={SCENES.slice(0, 1)} />}>
          <HeroWithPhotos />
        </Suspense>
      )}

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-14 px-4 sm:gap-16 sm:px-8">
      <section aria-labelledby="intro-title" className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_2fr] md:gap-12">
        <p id="intro-title" className="flex items-center gap-4 self-start pt-2 text-sm font-semibold uppercase tracking-[0.14em] text-evergreen">
          <span aria-hidden="true" className="h-px w-12 bg-evergreen" />
          Your key to every getaway
        </p>
        <p className="text-2xl font-semibold leading-snug tracking-tight sm:text-[32px] sm:leading-[1.25]">
          <span className="text-ink">Keyvaga connects travelers with owners of coastal homes, lake houses, mountain cabins and city stays.</span>{" "}
          <span className="text-ink-muted">Book direct with lower fees, check in with ease, and find trusted local help for every stay.</span>
        </p>
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

      <FeesSection />

      <section aria-labelledby="featured-title" className="flex flex-col gap-6">
        <h2 id="featured-title" className="text-2xl font-bold tracking-tight sm:text-3xl">
          Featured stays
        </h2>
        <Suspense fallback={<FeaturedSkeleton />}>
          <FeaturedStays />
        </Suspense>
      </section>
      </div>
    </div>
  );
}

/** Illustrated scenes shown only if there are no photos at all. */
const SCENES: Slide[] = [
  { type: "scene", kind: "coast", title: "Coastal escapes", place: "Beach houses and seaside condos", href: "/search" },
  { type: "scene", kind: "lake", title: "Lakefront getaways", place: "Docks, decks and sunsets", href: "/search" },
  { type: "scene", kind: "mountain", title: "Mountain retreats", place: "Cabins and chalets", href: "/search" },
  { type: "scene", kind: "city", title: "City stays", place: "Lofts and apartments downtown", href: "/search" },
];

async function HeroWithPhotos() {
  const photos = await getHeroSlides(1);
  return <Hero slides={photos.length >= 1 ? photos.map((p) => ({ type: "photo" as const, ...p })) : SCENES.slice(0, 1)} />;
}

function Hero({ slides }: { slides: Slide[] }) {
  return (
    <HeroCarousel
      slides={slides}
      logo={<HomeLogoLink />}
      nav={
        <>
          <Link href="/search" className={photoLink.replace("inline-flex", "hidden md:inline-flex")}>Stays</Link>
          <Link href="/list-your-property" className={photoLink.replace("inline-flex", "hidden md:inline-flex")}>List your property</Link>
          <Suspense fallback={<UserMenuFallback />}>
            <UserMenu onPhoto />
          </Suspense>
        </>
      }
    >
      <div className="relative z-10 flex flex-1 flex-col justify-between gap-10 px-5 pb-4 pt-10 sm:px-10 sm:pt-16">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <h1 id="hero-title" className="max-w-4xl font-brand text-4xl font-bold leading-[1.02] tracking-tight text-white drop-shadow-sm sm:text-6xl lg:text-[64px]">
            Your key to the ultimate getaway.
          </h1>
          <div className="flex max-w-xs flex-col gap-4 text-white lg:pt-3">
            <p className="text-base leading-relaxed text-white/90 drop-shadow-sm">Coastal homes, lakefront cabins, mountain retreats and city stays, booked directly with their owners.</p>
            <Link href="/list-your-property" className="inline-flex min-h-11 items-center gap-2 self-start font-semibold text-white underline decoration-coral decoration-2 underline-offset-[6px] md:hidden">List your property →</Link>
          </div>
        </div>
        <div className="max-w-5xl">
          <HeroSearch />
        </div>
      </div>
    </HeroCarousel>
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
