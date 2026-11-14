import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { connection } from "next/server";
import { requirePortal } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { providerStats } from "@/lib/providers";
import { categoryLabel, responseTimeLabel } from "@/lib/services";
import { PortalShell } from "@/components/layout/PortalShell";
import { ownerNav } from "@/components/layout/portal-nav";
import { Card, Chip } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { Stars } from "@/components/services/Stars";

export const metadata: Metadata = { title: "Provider" };

export default function Page({ params }: PageProps<"/owner/services/[slug]">) {
  return (
    <Suspense fallback={<div className="h-screen" aria-hidden="true" />}>
      <Provider params={params} />
    </Suspense>
  );
}

async function Provider({ params }: { params: PageProps<"/owner/services/[slug]">["params"] }) {
  const { slug } = await params;
  await connection();
  const user = await requirePortal("owner", `/owner/services/${slug}`);
  const p = await db.providerProfile.findFirst({ where: { slug, status: "APPROVED" }, include: { photos: { orderBy: { position: "asc" } } } });
  if (!p) notFound();
  const stats = (await providerStats([p.id])).get(p.id)!;
  const reviews = await db.jobReview.findMany({ where: { subject: "PROVIDER", job: { acceptedQuote: { providerId: p.id } } }, orderBy: { createdAt: "desc" }, take: 20, include: { reviewer: { select: { name: true } }, job: { select: { title: true } } } });
  const response = responseTimeLabel(stats.responseHours);

  return (
    <PortalShell portal="Owner" user={user} nav={ownerNav("/owner/services")}>
      <div className="flex flex-col gap-6 pt-6 sm:pt-10">
        <Link href="/owner/services" className="inline-flex min-h-11 items-center self-start text-brand underline underline-offset-4">← All pros</Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{p.businessName}</h1>
            <p className="text-ink-muted"><Stars rating={stats.rating} count={stats.reviewCount} />{response ? ` · ${response}` : ""} · {stats.jobsDone} job{stats.jobsDone === 1 ? "" : "s"} on Keyvaga</p>
            <ul className="flex flex-wrap gap-2">{p.categories.map((c) => <li key={c}><Chip>{categoryLabel(c)}</Chip></li>)}</ul>
          </div>
          <ButtonLink href={`/owner/jobs/new?provider=${p.id}`}>Request a quote</ButtonLink>
        </div>
        {p.photos.length ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Work photos">
            {p.photos.map((ph, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <li key={ph.id}><img src={ph.url} alt={`${p.businessName} work photo ${i + 1}`} className="aspect-square w-full rounded-xl object-cover" loading="lazy" /></li>
            ))}
          </ul>
        ) : null}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card className="flex flex-col gap-2">
            <h2 className="text-xl font-bold">About</h2>
            <p className="whitespace-pre-line text-ink-muted">{p.bio}</p>
            <p className="text-sm"><strong>Serves:</strong> {p.serviceAreaText || `all of ${p.region}`} ({p.region})</p>
            {p.availabilityNote ? <p className="text-sm"><strong>Availability:</strong> {p.availabilityNote}</p> : null}
          </Card>
          <Card className="flex flex-col gap-2">
            <h2 className="text-xl font-bold">Pricing guidance</h2>
            <p className="whitespace-pre-line text-ink-muted">{p.pricingGuidance || "Request a quote for a price."}</p>
          </Card>
        </div>
        <Card className="flex flex-col gap-3">
          <h2 className="text-xl font-bold">Reviews from owners</h2>
          {reviews.length === 0 ? <p className="text-ink-muted">No reviews yet.</p> : (
            <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {reviews.map((r) => (
                <li key={r.id} className="flex flex-col gap-1">
                  <p className="font-semibold">{r.reviewer.name.split(" ")[0]} <span className="font-normal text-ink-muted">· {r.job.title}</span></p>
                  <p className="text-brand" aria-label={`${r.rating} out of 5 stars`}>{"★".repeat(r.rating)}<span className="text-line-strong">{"★".repeat(5 - r.rating)}</span></p>
                  <p className="whitespace-pre-line text-ink-muted">{r.body}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </PortalShell>
  );
}
