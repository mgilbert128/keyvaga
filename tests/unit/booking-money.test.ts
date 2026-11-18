import { describe, expect, it } from "vitest";
import { bookingAmounts, cancellationOutcome, paymentSchedule, refundShareBps, splitPayoutAcrossCharges, paymentRequestAmounts } from "@/lib/booking-money";
import { parseISODate } from "@/lib/dates";

const d = (s: string) => parseISODate(s)!;

describe("fees: 5% guest + 5% host", () => {
  it("matches the $1,000 example", () => {
    expect(bookingAmounts(100_000)).toEqual({
      subtotalCents: 100_000, guestFeeCents: 5_000, taxCents: 0, keyvagaTaxCents: 0, ownerTaxCents: 0, guestTotalCents: 105_000,
      hostFeeCents: 5_000, hostPayoutCents: 95_000, platformCents: 10_000,
    });
  });
  it("rounds to whole cents and always balances", () => {
    const a = bookingAmounts(71_050); // $710.50
    expect(a.guestFeeCents).toBe(3_553);
    expect(a.guestTotalCents).toBe(74_603);
    expect(a.hostPayoutCents + a.hostFeeCents).toBe(a.subtotalCents);
    expect(a.guestTotalCents - a.hostPayoutCents).toBe(a.platformCents);
  });
});

describe("payment schedule: 30% now, rest 30 days before", () => {
  it("splits when check-in is more than 30 days away", () => {
    const s = paymentSchedule(105_000, d("2027-03-01"), d("2026-11-11"));
    expect(s).toMatchObject({ kind: "split", dueNowCents: 31_500, balanceCents: 73_500 });
    expect(s.kind === "split" && s.balanceDueDate.toISOString().slice(0, 10)).toBe("2027-01-30");
  });
  it("charges in full when check-in is 30 days away or less", () => {
    expect(paymentSchedule(105_000, d("2026-12-11"), d("2026-11-11"))).toEqual({ kind: "full", dueNowCents: 105_000 });
    expect(paymentSchedule(105_000, d("2026-11-12"), d("2026-11-11"))).toEqual({ kind: "full", dueNowCents: 105_000 });
  });
  it("splits at 31 days, with the balance due tomorrow", () => {
    const s = paymentSchedule(1_001, d("2026-12-12"), d("2026-11-11"));
    expect(s.kind).toBe("split");
    if (s.kind === "split") {
      expect(s.dueNowCents + s.balanceCents).toBe(1_001);
      expect(s.balanceDueDate.toISOString().slice(0, 10)).toBe("2026-11-12");
    }
  });
});

describe("cancellation policies", () => {
  it.each([
    ["FLEXIBLE", 7, 10_000], ["FLEXIBLE", 6, 0],
    ["MODERATE", 30, 10_000], ["MODERATE", 29, 5_000], ["MODERATE", 14, 5_000], ["MODERATE", 13, 0],
    ["STRICT", 30, 5_000], ["STRICT", 29, 0],
  ] as const)("%s at %i days → %i bps", (policy, days, bps) => {
    expect(refundShareBps(policy, days)).toBe(bps);
  });

  const amounts = bookingAmounts(100_000); // guest total $1,050, owner $950
  const checkIn = d("2027-03-01");

  it("moderate, 60 days out, only deposit paid: full refund of the deposit, balance cancelled", () => {
    const o = cancellationOutcome({ by: "guest", policy: "MODERATE", amounts, paidCents: 31_500, checkIn, today: d("2026-12-31") });
    expect(o).toEqual({ retainedCents: 0, refundCents: 31_500, cancelBalance: true, hostPayoutCents: 0, taxRetainedCents: 0 });
  });
  it("moderate, 20 days out, fully paid: half back; owner gets their share of the half kept", () => {
    const o = cancellationOutcome({ by: "guest", policy: "MODERATE", amounts, paidCents: 105_000, checkIn, today: d("2027-02-09") });
    expect(o.refundCents).toBe(52_500);
    expect(o.retainedCents).toBe(52_500);
    expect(o.hostPayoutCents).toBe(47_500); // half of $950
  });
  it("strict, 40 days out, only deposit paid: keeps the deposit but never charges more", () => {
    const o = cancellationOutcome({ by: "guest", policy: "STRICT", amounts, paidCents: 31_500, checkIn, today: d("2027-01-20") });
    expect(o.refundCents).toBe(0);
    expect(o.retainedCents).toBe(31_500);
    expect(o.hostPayoutCents).toBe(28_500); // 30% of $950
  });
  it("flexible, 3 days out, fully paid: no refund, owner paid in full", () => {
    const o = cancellationOutcome({ by: "guest", policy: "FLEXIBLE", amounts, paidCents: 105_000, checkIn, today: d("2027-02-26") });
    expect(o).toMatchObject({ refundCents: 0, retainedCents: 105_000, hostPayoutCents: 95_000 });
  });
  it("owner cancels: guest gets everything back, owner nothing", () => {
    const o = cancellationOutcome({ by: "owner", policy: "STRICT", amounts, paidCents: 105_000, checkIn, today: d("2027-02-26") });
    expect(o).toMatchObject({ refundCents: 105_000, retainedCents: 0, hostPayoutCents: 0 });
  });
});

describe("splitting a payout across charges", () => {
  it("splits proportionally and never exceeds a charge", () => {
    expect(splitPayoutAcrossCharges(95_000, [{ id: "dep", amountCents: 31_500 }, { id: "bal", amountCents: 73_500 }])).toEqual([
      { id: "dep", amountCents: 28_500 }, { id: "bal", amountCents: 66_500 },
    ]);
    expect(splitPayoutAcrossCharges(28_500, [{ id: "dep", amountCents: 31_500 }])).toEqual([{ id: "dep", amountCents: 28_500 }]);
    expect(splitPayoutAcrossCharges(0, [{ id: "dep", amountCents: 31_500 }])).toEqual([]);
    const parts = splitPayoutAcrossCharges(1_001, [{ id: "a", amountCents: 333 }, { id: "b", amountCents: 777 }]);
    expect(parts.reduce((s, p) => s + p.amountCents, 0)).toBe(1_001);
  });
});

describe("payment requests: host fee only, at least $1", () => {
  it("guest pays exactly the amount; owner pays 5%", () => {
    expect(paymentRequestAmounts(10_000)).toMatchObject({ totalCents: 10_000, hostFeeCents: 500, ownerPayoutCents: 9_500 });
  });
  it("small requests pay the $1 minimum fee", () => {
    expect(paymentRequestAmounts(1_000)).toMatchObject({ totalCents: 1_000, hostFeeCents: 100, ownerPayoutCents: 900 });
  });
  it("the fee always covers card processing (2.9% + 30c)", () => {
    for (const amount of [500, 1_000, 1_500, 2_500, 10_000, 500_000]) {
      expect(paymentRequestAmounts(amount).hostFeeCents).toBeGreaterThanOrEqual(Math.round(amount * 0.029) + 30);
    }
  });
  it("adds tax on top; owner-filed tax goes to the owner", () => {
    expect(paymentRequestAmounts(10_000, { keyvagaTaxCents: 400, ownerTaxCents: 300 })).toMatchObject({ totalCents: 10_700, taxCents: 700, ownerPayoutCents: 9_800 });
  });
});
