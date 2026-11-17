import { describe, expect, it } from "vitest";
import { estimateEarnings } from "@/lib/earnings";

describe("what you'd keep", () => {
  it("estimates a month and a year with a 5% host fee", () => {
    // 15 nights at $200, 3-night stays (5 stays) with $100 cleaning → $3,500 gross
    const e = estimateEarnings({ nightlyRateCents: 20_000, nightsPerMonth: 15, avgStayNights: 3, cleaningFeeCents: 10_000 });
    expect(e.staysPerMonth).toBe(5);
    expect(e.rentMonthCents).toBe(300_000);
    expect(e.cleaningMonthCents).toBe(50_000);
    expect(e.grossMonthCents).toBe(350_000);
    expect(e.keyvagaFeeMonthCents).toBe(17_500);
    expect(e.keepMonthCents).toBe(332_500);
    expect(e.keepYearCents).toBe(3_990_000);
    expect(e.guestPaysPerStayCents).toBe(73_500); // ($600 + $100) + 5%
    expect(e.extraVsOtherYearCents).toBeNull();
  });
  it("compares with another platform's host fee", () => {
    const e = estimateEarnings({ nightlyRateCents: 20_000, nightsPerMonth: 15, avgStayNights: 3, cleaningFeeCents: 10_000, otherPlatformFeePercent: 15 });
    expect(e.extraVsOtherYearCents).toBe(420_000); // 10% of $42,000 a year
  });
  it("handles empty and silly inputs safely", () => {
    expect(estimateEarnings({ nightlyRateCents: 20_000, nightsPerMonth: 0, avgStayNights: 0, cleaningFeeCents: 10_000 }).keepMonthCents).toBe(0);
    expect(estimateEarnings({ nightlyRateCents: 10_000, nightsPerMonth: 99, avgStayNights: 2, cleaningFeeCents: 0 }).grossMonthCents).toBe(310_000);
  });
});
