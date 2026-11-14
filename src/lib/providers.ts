import "server-only";
import { db } from "@/lib/db";
import { slugify } from "@/lib/slug";
import { averageResponseHours, providerServes } from "@/lib/services";

/** The provider's profile, creating an empty draft the first time. */
export async function getOrCreateProfile(user: { id: string; name: string }) {
  const existing = await db.providerProfile.findUnique({ where: { userId: user.id }, include: { photos: { orderBy: { position: "asc" } } } });
  if (existing) return existing;
  return db.providerProfile.create({
    data: { userId: user.id, businessName: user.name, slug: `${slugify(user.name)}-${crypto.randomUUID().slice(0, 6)}` },
    include: { photos: { orderBy: { position: "asc" } } },
  });
}

export type ProviderStats = { rating: number | null; reviewCount: number; responseHours: number | null; jobsDone: number };

/** Rating (owner reviews), response time (job posted → quote) and completed jobs for each provider. */
export async function providerStats(providerIds: string[]): Promise<Map<string, ProviderStats>> {
  const out = new Map<string, ProviderStats>();
  if (!providerIds.length) return out;
  const [quotes, paidJobs, reviews] = await Promise.all([
    db.quote.findMany({ where: { providerId: { in: providerIds } }, select: { providerId: true, createdAt: true, job: { select: { createdAt: true } } }, take: 2000, orderBy: { createdAt: "desc" } }),
    db.job.findMany({ where: { status: "PAID", acceptedQuote: { providerId: { in: providerIds } } }, select: { id: true, acceptedQuote: { select: { providerId: true } } } }),
    db.jobReview.findMany({ where: { subject: "PROVIDER", job: { acceptedQuote: { providerId: { in: providerIds } } } }, select: { rating: true, job: { select: { acceptedQuote: { select: { providerId: true } } } } } }),
  ]);
  for (const id of providerIds) {
    const r = reviews.filter((x) => x.job.acceptedQuote?.providerId === id);
    out.set(id, {
      rating: r.length ? r.reduce((s, x) => s + x.rating, 0) / r.length : null,
      reviewCount: r.length,
      responseHours: averageResponseHours(quotes.filter((q) => q.providerId === id).map((q) => ({ jobCreatedAt: q.job.createdAt, quotedAt: q.createdAt }))),
      jobsDone: paidJobs.filter((j) => j.acceptedQuote?.providerId === id).length,
    });
  }
  return out;
}

/** Approved providers who serve a category at a property's location (owner directory search). */
export async function findProviders(f: { category?: string; city?: string; region?: string; text?: string }) {
  const rows = await db.providerProfile.findMany({
    where: {
      status: "APPROVED",
      ...(f.category ? { categories: { has: f.category } } : {}),
      AND: [
        // Providers in that state, plus multi-state providers (no single state) who are matched by town below.
        ...(f.region ? [{ OR: [{ region: { equals: f.region, mode: "insensitive" as const } }, { region: "" }] }] : []),
        ...(f.text ? [{ OR: [{ businessName: { contains: f.text, mode: "insensitive" as const } }, { serviceAreaText: { contains: f.text, mode: "insensitive" as const } }] }] : []),
      ],
    },
    include: { photos: { orderBy: { position: "asc" }, take: 1 } },
    orderBy: { approvedAt: "asc" },
    take: 60,
  });
  const filtered = f.city && f.region
    ? rows.filter((p) => (f.category ? providerServes(p, { category: f.category, city: f.city!, region: f.region! }) : providerServes({ ...p, categories: [...p.categories, "_any"] }, { category: "_any", city: f.city!, region: f.region! })))
    : rows;
  const stats = await providerStats(filtered.map((p) => p.id));
  return filtered
    .map((p) => ({ profile: p, stats: stats.get(p.id)! }))
    .sort((a, b) => (b.stats.rating ?? 0) - (a.stats.rating ?? 0) || b.stats.jobsDone - a.stats.jobsDone);
}
