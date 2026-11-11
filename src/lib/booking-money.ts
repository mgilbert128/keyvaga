/**
 * Keyvaga booking money rules. All amounts are integer cents (USD).
 * Pure functions: easy to test, and the same math runs at quote, checkout and cancellation.
 */
import { addDays, nightsBetween } from "./dates";

/** Fee rates in basis points (1% = 100). 10% total, split evenly. */
export const GUEST_FEE_BPS = 500; // 5% added to the guest's price ("service fee")
export const HOST_FEE_BPS = 500; // 5% taken from the owner's payout

/** Payment plan: deposit at booking, balance this many days before check-in. */
export const DEPOSIT_BPS = 3000; // 30%
export const BALANCE_DAYS_BEFORE = 30;

/** Minutes a reservation holds the dates while the guest pays. */
export const HOLD_MINUTES = 15;

const pct = (amount: number, bps: number) => Math.round((amount * bps) / 10_000);

export type BookingAmounts = {
  /** Nights + cleaning: the owner's price for the stay. */
  subtotalCents: number;
  guestFeeCents: number;
  /** What the guest pays in total. */
  guestTotalCents: number;
  hostFeeCents: number;
  /** What the owner receives if the stay goes ahead. */
  hostPayoutCents: number;
  /** Keyvaga's gross revenue before Stripe costs. */
  platformCents: number;
};

export function bookingAmounts(subtotalCents: number): BookingAmounts {
  const guestFeeCents = pct(subtotalCents, GUEST_FEE_BPS);
  const hostFeeCents = pct(subtotalCents, HOST_FEE_BPS);
  return {
    subtotalCents,
    guestFeeCents,
    guestTotalCents: subtotalCents + guestFeeCents,
    hostFeeCents,
    hostPayoutCents: subtotalCents - hostFeeCents,
    platformCents: guestFeeCents + hostFeeCents,
  };
}

export type PaymentSchedule =
  | { kind: "full"; dueNowCents: number }
  | { kind: "split"; dueNowCents: number; balanceCents: number; balanceDueDate: Date };

/**
 * 30% now and the rest 30 days before check-in. If check-in is 30 days away or less,
 * the balance date has already passed, so the guest pays everything now.
 */
export function paymentSchedule(guestTotalCents: number, checkIn: Date, today: Date): PaymentSchedule {
  if (nightsBetween(today, checkIn) <= BALANCE_DAYS_BEFORE) return { kind: "full", dueNowCents: guestTotalCents };
  const dueNowCents = pct(guestTotalCents, DEPOSIT_BPS);
  return { kind: "split", dueNowCents, balanceCents: guestTotalCents - dueNowCents, balanceDueDate: addDays(checkIn, -BALANCE_DAYS_BEFORE) };
}

// ---------- Cancellation ----------

export const CANCELLATION_POLICIES = ["FLEXIBLE", "MODERATE", "STRICT"] as const;
export type CancellationPolicy = (typeof CANCELLATION_POLICIES)[number];

/** Refund tiers: at least `daysBefore` days before check-in → `refundBps` of the total. */
const TIERS: Record<CancellationPolicy, { daysBefore: number; refundBps: number }[]> = {
  FLEXIBLE: [{ daysBefore: 7, refundBps: 10_000 }],
  MODERATE: [
    { daysBefore: 30, refundBps: 10_000 },
    { daysBefore: 14, refundBps: 5_000 },
  ],
  STRICT: [{ daysBefore: 30, refundBps: 5_000 }],
};

export const POLICY_INFO: Record<CancellationPolicy, { label: string; summary: string }> = {
  FLEXIBLE: { label: "Flexible", summary: "Full refund if cancelled at least 7 days before check-in. No refund after that." },
  MODERATE: {
    label: "Moderate",
    summary: "Full refund if cancelled at least 30 days before check-in, 50% refund at least 14 days before. No refund after that.",
  },
  STRICT: { label: "Strict", summary: "50% refund if cancelled at least 30 days before check-in. No refund after that." },
};

/** Share of the total the guest gets back (basis points) for cancelling `daysBefore` days ahead. */
export function refundShareBps(policy: CancellationPolicy, daysBefore: number): number {
  for (const t of TIERS[policy]) if (daysBefore >= t.daysBefore) return t.refundBps;
  return 0;
}

export type CancellationOutcome = {
  /** Total the guest may keep paid under the policy. */
  retainedCents: number;
  /** Money to send back to the guest now. */
  refundCents: number;
  /** Any scheduled balance charge is cancelled; we never charge more because of a cancellation. */
  cancelBalance: boolean;
  /** What the owner still receives from the retained money (after their 5%). */
  hostPayoutCents: number;
};

/**
 * Works out a cancellation.
 * - Guest cancels: the policy decides how much of the total Keyvaga may keep. If the guest has paid more
 *   than that, the difference is refunded. If they've paid less (balance not charged yet), nothing more is charged.
 * - Owner cancels: the guest always gets everything back and the owner receives nothing.
 * The owner's payout is their share of whatever is kept, minus the host fee, in proportion.
 */
export function cancellationOutcome(args: {
  by: "guest" | "owner";
  policy: CancellationPolicy;
  amounts: BookingAmounts;
  paidCents: number;
  checkIn: Date;
  today: Date;
}): CancellationOutcome {
  const { amounts, paidCents } = args;
  const shareBps = args.by === "owner" ? 10_000 : refundShareBps(args.policy, nightsBetween(args.today, args.checkIn));
  const allowedToKeep = amounts.guestTotalCents - pct(amounts.guestTotalCents, shareBps);
  const retainedCents = Math.min(paidCents, allowedToKeep);
  const refundCents = paidCents - retainedCents;
  // Owner's share of the retained money: the subtotal portion of it, minus the host fee.
  const subtotalPart = amounts.guestTotalCents === 0 ? 0 : Math.round((retainedCents * amounts.subtotalCents) / amounts.guestTotalCents);
  const hostPayoutCents = subtotalPart - pct(subtotalPart, HOST_FEE_BPS);
  return { retainedCents, refundCents, cancelBalance: true, hostPayoutCents };
}

/**
 * Split an owner payout across the guest's charges, never more than each charge,
 * so each transfer can be tied to the charge that funded it.
 */
export function splitPayoutAcrossCharges(payoutCents: number, charges: { id: string; amountCents: number }[]): { id: string; amountCents: number }[] {
  const total = charges.reduce((s, c) => s + c.amountCents, 0);
  if (payoutCents <= 0 || total <= 0) return [];
  let remaining = Math.min(payoutCents, total);
  const out: { id: string; amountCents: number }[] = [];
  charges.forEach((c, i) => {
    const last = i === charges.length - 1;
    const share = last ? remaining : Math.min(c.amountCents, Math.round((payoutCents * c.amountCents) / total), remaining);
    if (share > 0) out.push({ id: c.id, amountCents: share });
    remaining -= share;
  });
  return out;
}
