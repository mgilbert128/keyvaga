/** "What you'd keep" estimates for owners. Uses the same fee rates as real bookings. */
import { GUEST_FEE_BPS, HOST_FEE_BPS } from "./booking-money";

export const HOST_FEE_PERCENT = HOST_FEE_BPS / 100; // 5
export const GUEST_FEE_PERCENT = GUEST_FEE_BPS / 100; // 5

export type EarningsInput = {
  nightlyRateCents: number;
  nightsPerMonth: number;
  avgStayNights: number;
  cleaningFeeCents: number;
  /** The host fee on the owner's current platform, for comparison (percent, e.g. 15). */
  otherPlatformFeePercent?: number | null;
};

export type EarningsEstimate = {
  staysPerMonth: number;
  grossMonthCents: number;
  keyvagaFeeMonthCents: number;
  keepMonthCents: number;
  keepYearCents: number;
  /** What a guest pays for one average stay, all-in. */
  guestPaysPerStayCents: number;
  /** Extra kept per year vs. the other platform's host fee (null if not compared). */
  extraVsOtherYearCents: number | null;
};

export function estimateEarnings(i: EarningsInput): EarningsEstimate {
  const nights = Math.max(0, Math.min(31, i.nightsPerMonth));
  const stayLen = Math.max(1, i.avgStayNights);
  const staysPerMonth = nights === 0 ? 0 : nights / stayLen;
  const grossMonthCents = Math.round(nights * i.nightlyRateCents + staysPerMonth * i.cleaningFeeCents);
  const keyvagaFeeMonthCents = Math.round((grossMonthCents * HOST_FEE_BPS) / 10_000);
  const keepMonthCents = grossMonthCents - keyvagaFeeMonthCents;
  const perStaySubtotal = stayLen * i.nightlyRateCents + i.cleaningFeeCents;
  const guestPaysPerStayCents = perStaySubtotal + Math.round((perStaySubtotal * GUEST_FEE_BPS) / 10_000);
  const other = i.otherPlatformFeePercent;
  const extraVsOtherYearCents =
    other === null || other === undefined || !Number.isFinite(other) ? null : Math.round(grossMonthCents * 12 * ((Math.min(Math.max(other, 0), 100) - HOST_FEE_PERCENT) / 100));
  return { staysPerMonth, grossMonthCents, keyvagaFeeMonthCents, keepMonthCents, keepYearCents: keepMonthCents * 12, guestPaysPerStayCents, extraVsOtherYearCents };
}
