import { Suspense } from "react";
import Link from "next/link";
import { HeroSearch } from "@/components/home/HeroSearch";
import { HomeLogoLink } from "@/components/brand/Logo";
import { UserMenu, UserMenuFallback, photoLink } from "@/components/layout/UserMenu";
import { ListingCard } from "@/components/listings/ListingCard";
import { ButtonLink } from "@/components/ui/Button";
import { Card, Chip } from "@/components/ui/Card";
import { getFeaturedListings } from "@/lib/listings";
import { listDestinations } from "@/lib/destinations";
import { JsonLd } from "@/components/seo/JsonLd";
import { FeesSection, OwnerValueSection } from "@/components/marketing/FeesSection";
import { HeroCarousel, type Slide } from "@/components/home/HeroCarousel";
import { curatedHero, curatedHeroes, getHeroSlides } from "@/lib/hero";

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
        <Hero slides={curatedHeroes(2).map((p) => ({ type: "photo" as const, ...p }))} />
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
        <div className="flex max-w-3xl flex-col gap-4 sm:gap-5">
          <p className="text-2xl font-semibold leading-snug tracking-tight text-ink sm:text-[30px] sm:leading-[1.3]">
            Keyvaga connects travelers with owners of coastal homes, lake houses, mountain cabins, and city stays.
          </p>
          <p className="text-lg leading-relaxed text-ink-muted sm:text-xl">
            Book direct with lower fees, easy check-in, and trusted local help.
          </p>
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

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Keyvaga",
          legalName: "Keyvaga LLC",
          url: "https://www.keyvaga.com",
          logo: "https://www.keyvaga.com/brand/keyvaga-icon-a-pin.png",
          contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: "support@keyvaga.com" },
        }}
      />
      <Suspense fallback={null}>
        <Destinations />
      </Suspense>

      <FeesSection />

      <OwnerValueSection />

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
      logo={<HomeLogoLink logoClassName="h-9 w-auto sm:h-11" />}
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
        <div className="flex max-w-3xl flex-col gap-5">
          <h1 id="hero-title" className="max-w-4xl font-brand text-4xl font-bold leading-[1.02] tracking-tight text-white drop-shadow-sm sm:text-6xl lg:text-[64px]">
            Your key to the ultimate getaway.
          </h1>
          <div className="flex max-w-xl flex-col gap-4 text-white">
            <p className="text-lg leading-relaxed text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.45)] sm:text-xl">Coastal homes, lakefront cabins, mountain retreats and city stays, booked directly with their owners.</p>
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

async function Destinations() {
  const list = (await listDestinations()).slice(0, 8);
  if (list.length < 2) return null; // one town isn't worth a section yet
  return (
    <section aria-labelledby="destinations-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="destinations-title" className="text-2xl font-bold tracking-tight sm:text-3xl">Explore destinations</h2>
        <Link href="/destinations" className="font-semibold text-brand underline underline-offset-4">All destinations</Link>
      </div>
      <ul className="flex flex-wrap gap-3">
        {list.map((d) => (
          <li key={d.slug}>
            <Link href={`/destinations/${d.slug}`} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-5 font-semibold hover:border-brand">
              {d.label} <span className="text-sm font-normal text-ink-muted">{d.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
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
