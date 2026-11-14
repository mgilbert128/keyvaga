import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { categoryLabel, responseTimeLabel } from "@/lib/services";
import type { ProviderStats } from "@/lib/providers";
import { Stars } from "./Stars";

type P = { id: string; slug: string; businessName: string; categories: string[]; serviceAreaText: string; region: string; availabilityNote: string; photos: { url: string }[] };

export function ProviderCard({ p, stats, requestHref }: { p: P; stats: ProviderStats; requestHref: string }) {
  const initials = p.businessName.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
  const response = responseTimeLabel(stats.responseHours);
  return (
    <article className="relative flex h-full flex-col gap-4 rounded-card border border-line bg-surface p-6">
      <div className="flex items-start gap-4">
        {p.photos[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.photos[0].url} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover" />
        ) : (
          <span aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-soft text-lg font-bold text-on-soft">{initials}</span>
        )}
        <div className="min-w-0">
          <h3 className="text-xl font-bold leading-tight">
            <Link href={`/owner/services/${p.slug}`} className="hover:underline">{p.businessName}</Link>
          </h3>
          <p className="text-sm text-ink-muted">{p.categories.map(categoryLabel).join(" · ")}</p>
        </div>
      </div>
      <p className="text-sm text-ink-muted">
        <Stars rating={stats.rating} count={stats.reviewCount || undefined} />
        {response ? ` · ${response}` : ""}
        {p.availabilityNote ? ` · ${p.availabilityNote}` : ""}
      </p>
      <p className="text-sm text-ink-muted">Serves {p.serviceAreaText || `all of ${p.region}`}</p>
      <div className="mt-auto flex flex-wrap gap-2">
        <ButtonLink href={requestHref} variant="secondary">Request quote</ButtonLink>
        <ButtonLink href={`/owner/services/${p.slug}`} variant="ghost">View profile</ButtonLink>
      </div>
    </article>
  );
}
