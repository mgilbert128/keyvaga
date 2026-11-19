import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { listingCardsWhere } from "@/lib/listings";
import { destinationSlug } from "@/lib/destinations";
import { amenityLabel } from "@/lib/amenities";
import { stateCode } from "@/lib/place";
import { ListingCard } from "@/components/listings/ListingCard";

export async function generateMetadata({ params }: PageProps<"/complexes/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const c = await db.complex.findUnique({ where: { slug }, select: { name: true, city: true, region: true } });
  if (!c) return { title: "Building not found" };
  return { title: `${c.name}, ${c.city} vacation rentals`, description: `Every Keyvaga vacation rental at ${c.name} in ${c.city}, ${c.region}, booked directly with local hosts.` };
}

export default function Page({ params }: PageProps<"/complexes/[slug]">) {
  return (
    <Suspense fallback={<div className="h-screen" aria-hidden="true" />}>
      <ComplexPage params={params} />
    </Suspense>
  );
}

async function ComplexPage({ params }: { params: PageProps<"/complexes/[slug]">["params"] }) {
  const { slug } = await params;
  await connection();
  const c = await db.complex.findUnique({ where: { slug }, select: { id: true, name: true, city: true, region: true, description: true, listings: { where: { status: "PUBLISHED" }, select: { amenities: true } } } });
  if (!c || c.listings.length === 0) notFound();
  const stays = await listingCardsWhere({ complexId: c.id });
  // Amenities every unit lists are almost always the building's (pool, elevator, beach access…).
  const shared = c.listings.map((l) => l.amenities).reduce((acc, a) => acc.filter((x) => a.includes(x)));
  const label = `${c.city}, ${stateCode(c.region) ?? c.region}`;
  return (
    <div className="flex flex-col gap-8 pt-6 sm:pt-10">
      <div className="flex flex-col gap-2">
        <Link href={`/destinations/${destinationSlug(c.city, c.region)}`} className="inline-flex min-h-11 items-center self-start text-brand underline underline-offset-4">← All stays in {c.city}</Link>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{c.name}</h1>
        <p className="text-ink-muted">{label} · {stays.length} {stays.length === 1 ? "unit" : "units"} on Keyvaga</p>
        {c.description ? <p className="max-w-3xl whitespace-pre-line">{c.description}</p> : null}
      </div>
      {shared.length ? (
        <section aria-labelledby="shared-title" className="flex flex-col gap-3">
          <h2 id="shared-title" className="text-xl font-bold">At every unit here</h2>
          <ul className="flex flex-wrap gap-2">
            {shared.map((a) => <li key={a} className="rounded-full bg-soft px-3 py-1 text-sm font-medium text-on-soft">{amenityLabel(a)}</li>)}
          </ul>
        </section>
      ) : null}
      <section aria-labelledby="units-title" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="units-title" className="text-xl font-bold">Units at {c.name}</h2>
          <Link href={`/search?complex=${c.slug}`} className="font-semibold text-brand underline underline-offset-4">Check dates and prices</Link>
        </div>
        <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {stays.map((l, i) => <li key={l.id}><ListingCard listing={l} index={i} /></li>)}
        </ul>
      </section>
    </div>
  );
}
