import { Suspense } from "react";
import type { Metadata } from "next";
import { StaySearchForm } from "@/components/search/StaySearchForm";
import { ListingCard } from "@/components/listings/ListingCard";
import { searchListings } from "@/lib/listings";

export const metadata: Metadata = { title: "Search stays" };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parse(sp: Record<string, string | string[] | undefined>) {
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() : undefined);
  const where = one("where")?.slice(0, 80) || undefined;
  const checkIn = one("checkIn") && ISO_DATE.test(one("checkIn")!) ? one("checkIn") : undefined;
  const checkOut = one("checkOut") && ISO_DATE.test(one("checkOut")!) ? one("checkOut") : undefined;
  const g = Number.parseInt(one("guests") ?? "", 10);
  const guests = Number.isFinite(g) && g > 0 && g <= 30 ? g : undefined;
  return { where, checkIn, checkOut, guests };
}

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <div className="flex flex-col gap-8 pt-6 sm:pt-10">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Find a stay</h1>
      <Suspense fallback={<StaySearchForm />}>
        <SearchBody searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function SearchBody({ searchParams }: { searchParams: PageProps<"/search">["searchParams"] }) {
  const params = parse(await searchParams);
  const results = await searchListings(params);
  const datesInvalid = params.checkIn && params.checkOut && params.checkOut <= params.checkIn;
  return (
    <>
      <StaySearchForm
        defaults={{ where: params.where, checkIn: params.checkIn, checkOut: params.checkOut, guests: params.guests?.toString() }}
      />
      {datesInvalid ? (
        <p role="alert" className="font-medium text-danger">Check-out must be after check-in. Showing all dates.</p>
      ) : null}
      <section aria-labelledby="results-title" className="flex flex-col gap-6">
        <h2 id="results-title" className="text-xl font-bold" aria-live="polite">
          {results.length === 1 ? "1 stay" : `${results.length} stays`}
          {params.where ? ` matching “${params.where}”` : ""}
        </h2>
        {results.length === 0 ? (
          <p className="text-ink-muted">No stays match yet. Try another destination or different dates.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {results.map((l, i) => (
              <li key={l.id}><ListingCard listing={l} index={i} /></li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
