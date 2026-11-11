import type { ListingStatus } from "@/generated/prisma/enums";

/** Who may do what to a listing. Pure functions so they are easy to test. */

export type Actor = { id: string; roles: readonly string[] };

export function canEditListing(actor: Actor, listing: { ownerId: string }): boolean {
  return actor.roles.includes("OWNER") && listing.ownerId === actor.id;
}

export function canReviewListings(actor: Actor): boolean {
  return actor.roles.includes("ADMIN");
}

export type OwnerAction = "submit" | "pause" | "unpause" | "withdraw";
export type AdminAction = "approve" | "reject";

const OWNER_TRANSITIONS: Record<OwnerAction, { from: ListingStatus[]; to: ListingStatus }> = {
  submit: { from: ["DRAFT"], to: "PENDING_REVIEW" },
  withdraw: { from: ["PENDING_REVIEW"], to: "DRAFT" },
  pause: { from: ["PUBLISHED"], to: "PAUSED" },
  unpause: { from: ["PAUSED"], to: "PUBLISHED" },
};

const ADMIN_TRANSITIONS: Record<AdminAction, { from: ListingStatus[]; to: ListingStatus }> = {
  approve: { from: ["PENDING_REVIEW"], to: "PUBLISHED" },
  reject: { from: ["PENDING_REVIEW"], to: "DRAFT" },
};

export function nextStatus(action: OwnerAction | AdminAction, current: ListingStatus): ListingStatus | null {
  const t = (OWNER_TRANSITIONS as Record<string, { from: ListingStatus[]; to: ListingStatus }>)[action] ??
    (ADMIN_TRANSITIONS as Record<string, { from: ListingStatus[]; to: ListingStatus }>)[action];
  return t && t.from.includes(current) ? t.to : null;
}

export type ReadinessInput = {
  title: string;
  summary: string;
  city: string;
  region: string;
  addressLine1: string;
  nightlyRateCents: number;
  photoCount: number;
};

export const MIN_PHOTOS_TO_SUBMIT = 1;

/** What still has to be filled in before a listing can be submitted for review. */
export function missingForSubmit(l: ReadinessInput): string[] {
  const missing: string[] = [];
  if (!l.title.trim()) missing.push("a title");
  if (!l.summary.trim()) missing.push("a short summary");
  if (!l.addressLine1.trim() || !l.city.trim() || !l.region.trim()) missing.push("the address");
  if (l.nightlyRateCents <= 0) missing.push("a nightly rate");
  if (l.photoCount < MIN_PHOTOS_TO_SUBMIT) missing.push("at least one photo");
  return missing;
}

export const STATUS_LABEL: Record<ListingStatus, string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "In review",
  PUBLISHED: "Live",
  PAUSED: "Paused",
};
