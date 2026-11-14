/**
 * Service marketplace rules (Phase 5). Pure functions: no database, easy to test.
 */

export const SERVICE_CATEGORIES = [
  { key: "cleaning", label: "Cleaners", noun: "Cleaning" },
  { key: "handyman", label: "Handymen", noun: "Handyman work" },
  { key: "plumbing", label: "Plumbers", noun: "Plumbing" },
  { key: "electrical", label: "Electricians", noun: "Electrical work" },
  { key: "landscaping", label: "Landscaping", noun: "Landscaping" },
  { key: "pool_spa", label: "Pool & hot tub", noun: "Pool / hot tub service" },
  { key: "linen", label: "Linen service", noun: "Linen service" },
  { key: "pest", label: "Pest control", noun: "Pest control" },
  { key: "photography", label: "Photographers", noun: "Photography" },
] as const;

export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number]["key"];

export function isServiceCategory(k: string): k is ServiceCategory {
  return SERVICE_CATEGORIES.some((c) => c.key === k);
}

export function categoryLabel(k: string): string {
  return SERVICE_CATEGORIES.find((c) => c.key === k)?.label ?? k;
}

export function categoryNoun(k: string): string {
  return SERVICE_CATEGORIES.find((c) => c.key === k)?.noun ?? k;
}

// ---------- Fees (open decision in the spec; same 10% split as bookings for now) ----------

export const JOB_OWNER_FEE_BPS = 500; // 5% added to what the owner pays
export const JOB_PROVIDER_FEE_BPS = 500; // 5% taken from the provider's payout
/** Days after the provider marks a job complete before payment is released automatically. */
export const AUTO_RELEASE_DAYS = 3;

const pct = (a: number, bps: number) => Math.round((a * bps) / 10_000);

export function jobAmounts(quoteCents: number) {
  const ownerFeeCents = pct(quoteCents, JOB_OWNER_FEE_BPS);
  const providerFeeCents = pct(quoteCents, JOB_PROVIDER_FEE_BPS);
  return {
    quoteCents,
    ownerFeeCents,
    ownerTotalCents: quoteCents + ownerFeeCents,
    providerFeeCents,
    providerPayoutCents: quoteCents - providerFeeCents,
    platformCents: ownerFeeCents + providerFeeCents,
  };
}

// ---------- Service areas and matching ----------

/** "Lake Geneva, Williams Bay;  Delavan" → ["lake geneva", "williams bay", "delavan"] */
export function parseServiceAreas(text: string): string[] {
  return [...new Set(text.split(/[,;\n]+/).map((s) => s.trim().toLowerCase().replace(/\s+/g, " ")).filter(Boolean))].slice(0, 40);
}

export type ProviderMatchInput = { status: string; categories: string[]; serviceAreas: string[]; region: string };
export type JobMatchInput = { category: string; city: string; region: string };

/**
 * Does this provider serve this job? Approved, offers the category, and either lists the property's
 * city in their service area, or covers the whole state/region (no cities listed, same region).
 */
export function providerServes(p: ProviderMatchInput, j: JobMatchInput): boolean {
  if (p.status !== "APPROVED") return false;
  if (!p.categories.includes(j.category)) return false;
  // No state and no towns: serves anywhere. Only possible for Keyvaga's own sample/demo provider;
  // real providers must choose a state before submitting their profile.
  if (!p.region.trim() && p.serviceAreas.length === 0) return true;
  const city = j.city.trim().toLowerCase();
  const sameRegion = p.region.trim().toLowerCase() === j.region.trim().toLowerCase();
  if (p.serviceAreas.length === 0) return sameRegion;
  return p.serviceAreas.includes(city) && (p.region ? sameRegion : true);
}

// ---------- Job lifecycle ----------

export type JobStatus = "OPEN" | "ASSIGNED" | "COMPLETED" | "PAID" | "DISPUTED" | "CANCELLED";

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  OPEN: "Getting quotes",
  ASSIGNED: "Scheduled",
  COMPLETED: "Done · payment pending",
  PAID: "Paid",
  DISPUTED: "Problem reported",
  CANCELLED: "Cancelled",
};

export type JobAction = "accept_quote" | "mark_complete" | "release" | "auto_release" | "report_problem" | "cancel" | "resolve_pay" | "resolve_refund";

const TRANSITIONS: Record<JobAction, { from: JobStatus[]; to: JobStatus }> = {
  accept_quote: { from: ["OPEN"], to: "ASSIGNED" },
  mark_complete: { from: ["ASSIGNED"], to: "COMPLETED" },
  release: { from: ["COMPLETED"], to: "PAID" },
  auto_release: { from: ["COMPLETED"], to: "PAID" },
  report_problem: { from: ["COMPLETED"], to: "DISPUTED" },
  cancel: { from: ["OPEN", "ASSIGNED"], to: "CANCELLED" },
  resolve_pay: { from: ["DISPUTED"], to: "PAID" },
  resolve_refund: { from: ["DISPUTED"], to: "CANCELLED" },
};

export function nextJobStatus(action: JobAction, current: JobStatus): JobStatus | null {
  const t = TRANSITIONS[action];
  return t.from.includes(current) ? t.to : null;
}

/** Average response time in hours from job creation to the provider's quote. Null if no quotes yet. */
export function averageResponseHours(pairs: { jobCreatedAt: Date; quotedAt: Date }[]): number | null {
  const valid = pairs.map((p) => (p.quotedAt.getTime() - p.jobCreatedAt.getTime()) / 3_600_000).filter((h) => h >= 0);
  if (!valid.length) return null;
  return valid.reduce((s, h) => s + h, 0) / valid.length;
}

export function responseTimeLabel(hours: number | null): string | null {
  if (hours === null) return null;
  if (hours < 1) return "Responds within an hour";
  if (hours < 24) return `Responds within ${Math.ceil(hours)} hrs`;
  const days = Math.ceil(hours / 24);
  return `Responds within ${days} day${days === 1 ? "" : "s"}`;
}
