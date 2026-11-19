import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { findDestination } from "@/lib/destinations";
import { listingCardsWhere } from "@/lib/listings";
import { regionVariants } from "@/lib/place";
import { ListingCard } from "@/components/listings/ListingCard";
import { StaySearchForm } from "@/components/search/StaySearchForm";

export async function generateMetadata({ params }: PageProps<"/destinations/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const town = slug.replace(/-[a-z]{2}$/, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const content = await db.destinationContent.findUnique({ where: { slug }, select: { intro: true } });
  const description = content?.intro.split(/\n+/)[0]?.slice(0, 160) || `Book vacation rentals in ${town} directly from local hosts on Keyvaga.`;
  return { title: `Vacation rentals in ${town}`, description, alternates: { canonical: `/destinations/${slug}` } };
}

export default function Page({ params }: PageProps<"/destinations/[slug]">) {
  return (
    <Suspense fallback={<div className="h-screen" aria-hidden="true" />}>
      <DestinationPage params={params} />
    </Suspense>
  );
}

async function DestinationPage({ params }: { params: PageProps<"/destinations/[slug]">["params"] }) {
  const { slug } = await params;
  await connection();
  const d = await findDestination(slug);
  if (!d) notFound();
  const place = { city: { equals: d.city, mode: "insensitive" as const }, region: { in: regionVariants(d.region), mode: "insensitive" as const } };
  const [stays, complexes, content] = await Promise.all([
    listingCardsWhere(place),
    db.complex.findMany({
      where: { ...place, listings: { some: { status: "PUBLISHED" } } },
      select: { name: true, slug: true, _count: { select: { listings: { where: { status: "PUBLISHED" } } } } },
      orderBy: { name: "asc" },
    }),
    db.destinationContent.findUnique({ where: { slug }, select: { intro: true } }),
  ]);
  return (
    <div className="flex flex-col gap-8 pt-6 sm:pt-10">
      <div className="flex flex-col gap-2">
        <Link href="/destinations" className="inline-flex min-h-11 items-center self-start text-brand underline underline-offset-4">← All destinations</Link>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Vacation rentals in {d.label}</h1>
        <p className="text-ink-muted">{stays.length} {stays.length === 1 ? "stay" : "stays"} from local hosts. Add your dates to see prices for your trip.</p>
      </div>
      {content?.intro ? (
        <div className="flex max-w-3xl flex-col gap-3 text-lg leading-relaxed">
          {content.intro.split(/\n\s*\n/).map((para, i) => <p key={i}>{para.trim()}</p>)}
        </div>
      ) : null}
      <StaySearchForm defaults={{ where: d.label }} />
      {complexes.length ? (
        <section aria-labelledby="complexes-title" className="flex flex-col gap-3">
          <h2 id="complexes-title" className="text-xl font-bold">Condo buildings and resorts</h2>
          <ul className="flex flex-wrap gap-2">
            {complexes.map((c) => (
              <li key={c.slug}>
                <Link href={`/complexes/${c.slug}`} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 font-semibold hover:border-brand">
                  {c.name} <span className="text-sm font-normal text-ink-muted">{c._count.listings}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section aria-labelledby="stays-title" className="flex flex-col gap-4">
        <h2 id="stays-title" className="text-xl font-bold">Stays in {d.city}</h2>
        <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {stays.map((l, i) => <li key={l.id}><ListingCard listing={l} index={i} /></li>)}
        </ul>
      </section>
    </div>
  );
}
