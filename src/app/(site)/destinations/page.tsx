import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { listDestinations } from "@/lib/destinations";

export const metadata: Metadata = { title: "Destinations", description: "Browse vacation rentals on Keyvaga by destination." };

export default function Page() {
  return (
    <div className="flex flex-col gap-6 pt-6 sm:pt-10">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Destinations</h1>
      <p className="text-ink-muted">Every town with stays on Keyvaga.</p>
      <Suspense fallback={<div className="h-40" aria-hidden="true" />}>
        <DestinationList />
      </Suspense>
    </div>
  );
}

async function DestinationList() {
  const list = await listDestinations();
  if (!list.length) return <p className="text-ink-muted">New destinations are on their way.</p>;
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((d) => (
        <li key={d.slug}>
          <Link href={`/destinations/${d.slug}`} className="flex min-h-11 items-center justify-between rounded-card border border-line bg-surface px-5 py-4 font-semibold hover:border-brand">
            <span>{d.label}</span>
            <span className="text-sm font-normal text-ink-muted">{d.count} {d.count === 1 ? "stay" : "stays"}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
