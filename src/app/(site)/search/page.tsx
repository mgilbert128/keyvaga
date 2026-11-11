import { Suspense } from "react";
import type { Metadata } from "next";
import { StaySearchForm } from "@/components/search/StaySearchForm";
import { SearchFilters } from "@/components/search/SearchFilters";
import { ListingCard } from "@/components/listings/ListingCard";
import { searchListings } from "@/lib/listings";
import { parseSearchParams } from "@/lib/search-params";

export const metadata: Metadata = { title: "Search stays" };

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <div className="flex flex-col gap-6 pt-6 sm:pt-10">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Find a stay</h1>
      <Suspense fallback={<StaySearchForm />}>
        <SearchBody searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function SearchBody({ searchParams }: { searchParams: PageProps<"/search">["searchParams"] }) {
  const f = parseSearchParams(await searchParams);
  const datesInvalid = Boolean(f.checkIn && f.checkOut && f.checkOut <= f.checkIn);
  const results = await searchListings(f);
  const activeCount =
    (f.minPriceCents !== undefined ? 1 : 0) + (f.maxPriceCents !== undefined ? 1 : 0) + (f.bedrooms ? 1 : 0) +
    (f.types?.length ?? 0) + (f.amenities?.length ?? 0) + (f.sort && f.sort !== "recommended" ? 1 : 0);

  // Carry dates and guests through to the stay page so its price breakdown is ready.
  const carry = new URLSearchParams(
    Object.entries({ checkIn: f.raw.checkIn, checkOut: f.raw.checkOut, guests: f.raw.guests }).filter((e): e is [string, string] => Boolean(e[1])),
  ).toString();

  return (
    <>
      <StaySearchForm defaults={{ where: f.raw.where, checkIn: f.raw.checkIn, checkOut: f.raw.checkOut, guests: f.raw.guests }} />
      <SearchFilters raw={f.raw} types={f.types ?? []} amenities={f.amenities ?? []} activeCount={activeCount} />
      {datesInvalid ? (
        <p role="alert" className="font-medium text-danger">Check-out must be after check-in. Showing all dates.</p>
      ) : null}
      <section aria-labelledby="results-title" className="flex flex-col gap-6">
        <h2 id="results-title" className="text-xl font-bold" aria-live="polite">
          {results.length === 1 ? "1 stay" : `${results.length} stays`}
          {f.where ? ` matching “${f.where}”` : ""}
        </h2>
        {results.length === 0 ? (
          <p className="text-ink-muted">No stays match. Try another destination, different dates or fewer filters.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {results.map((l, i) => (
              <li key={l.id}><ListingCard listing={l} index={i} query={carry} /></li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
