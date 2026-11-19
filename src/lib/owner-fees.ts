import "server-only";
import { db } from "@/lib/db";
import { todayIn } from "@/lib/dates";

/** Smart lock subscription: per lock assigned to a listing, per month. Covers Seam's per-device charge. */
export const LOCK_FEE_CENTS = 400;

const periodOf = (d: Date) => d.toISOString().slice(0, 7);

/**
 * Daily: makes sure this month's lock fee exists for every owner with locks assigned to a listing.
 * Billed once per month at the count on the first day it runs; a lock added later that month starts next month.
 */
export async function accrueLockFees(today = todayIn()) {
  const period = periodOf(today);
  const counts = await db.lock.groupBy({ by: ["ownerId"], where: { listingId: { not: null } }, _count: { _all: true } });
  let created = 0;
  for (const c of counts) {
    const quantity = c._count._all;
    const r = await db.ownerFee.createMany({
      data: [{ ownerId: c.ownerId, kind: "LOCKS", period, quantity, amountCents: quantity * LOCK_FEE_CENTS }],
      skipDuplicates: true,
    });
    created += r.count;
  }
  return { period, created };
}

/**
 * Takes owed fees out of a payout (oldest first, whole fees only). Returns how much to keep back
 * and the fee ids to mark collected once the transfer succeeds.
 */
export async function feesToDeduct(ownerId: string, payoutCents: number): Promise<{ deductCents: number; feeIds: string[] }> {
  const owed = await db.ownerFee.findMany({ where: { ownerId, status: "OWED" }, orderBy: { period: "asc" } });
  let deductCents = 0;
  const feeIds: string[] = [];
  for (const f of owed) {
    if (deductCents + f.amountCents > payoutCents) break;
    deductCents += f.amountCents;
    feeIds.push(f.id);
  }
  return { deductCents, feeIds };
}

export async function markFeesCollected(feeIds: string[], bookingId: string) {
  if (!feeIds.length) return;
  await db.ownerFee.updateMany({ where: { id: { in: feeIds }, status: "OWED" }, data: { status: "COLLECTED", collectedFromBookingId: bookingId, collectedAt: new Date() } });
}
