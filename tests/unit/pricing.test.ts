import { describe, expect, it } from "vitest";
import { quoteStay, rateForNight } from "@/lib/pricing";
import { parseISODate } from "@/lib/dates";

const d = (s: string) => parseISODate(s)!;
const base = { nightlyRateCents: 20_000, cleaningFeeCents: 10_000, minNights: 1 };

describe("nightly rates", () => {
  it("uses the weekend rate on Friday and Saturday nights only", () => {
    const l = { ...base, weekendRateCents: 25_000 };
    expect(rateForNight(l, d("2026-11-13")).rateCents).toBe(25_000); // Friday
    expect(rateForNight(l, d("2026-11-14")).rateCents).toBe(25_000); // Saturday
    expect(rateForNight(l, d("2026-11-15")).rateCents).toBe(20_000); // Sunday
    expect(rateForNight(base, d("2026-11-13")).rateCents).toBe(20_000); // no weekend rate set
  });
  it("lets a season override everything, end date exclusive", () => {
    const l = { ...base, weekendRateCents: 25_000, seasons: [{ name: "Holidays", startDate: d("2026-12-20"), endDate: d("2027-01-02"), nightlyRateCents: 40_000 }] };
    expect(rateForNight(l, d("2026-12-25"))).toEqual({ rateCents: 40_000, source: "season" });
    expect(rateForNight(l, d("2027-01-01")).rateCents).toBe(40_000);
    expect(rateForNight(l, d("2027-01-02"))).toEqual({ rateCents: 25_000, source: "weekend" }); // Saturday after the season
  });
});

describe("quoteStay with weekends, seasons and discounts", () => {
  it("adds up mixed nights (Thu–Sun: base, weekend, weekend)", () => {
    const q = quoteStay({ ...base, weekendRateCents: 25_000 }, d("2026-11-12"), d("2026-11-15"));
    expect(q).toMatchObject({ ok: true, nights: 3, nightsCents: 70_000, discountCents: 0, totalCents: 80_000 });
  });
  it("applies the weekly discount to nights only", () => {
    const q = quoteStay({ ...base, weeklyDiscountBps: 1000 }, d("2026-11-16"), d("2026-11-23")); // 7 nights
    expect(q).toMatchObject({ ok: true, nightsCents: 140_000, discountCents: 14_000, totalCents: 136_000, discountLabel: "Weekly discount (10%)" });
  });
  it("uses the bigger of weekly/monthly, never both", () => {
    const l = { ...base, weeklyDiscountBps: 1000, monthlyDiscountBps: 2500 };
    const q = quoteStay(l, d("2026-11-01"), d("2026-11-29")); // 28 nights
    expect(q.ok && q.discountCents).toBe(Math.round(28 * 20_000 * 0.25));
    expect(q.ok && q.discountLabel).toBe("Monthly discount (25%)");
    const q6 = quoteStay(l, d("2026-11-01"), d("2026-11-07")); // 6 nights: none
    expect(q6.ok && q6.discountCents).toBe(0);
  });
});

describe("custom prices for specific nights", () => {
  const l = {
    ...base,
    weekendRateCents: 25_000,
    seasons: [{ name: "Summer", startDate: d("2027-06-01"), endDate: d("2027-09-01"), nightlyRateCents: 30_000 }],
    dateRates: [d("2027-07-02"), d("2027-07-03"), d("2027-07-04")].map((date) => ({ date, rateCents: 45_000 })),
  };
  it("wins over seasonal, weekend and base rates", () => {
    expect(rateForNight(l, d("2027-07-03"))).toEqual({ rateCents: 45_000, source: "custom" }); // Saturday in summer
    expect(rateForNight(l, d("2027-07-05"))).toEqual({ rateCents: 30_000, source: "season" });
  });
  it("prices a holiday weekend correctly", () => {
    // Thu 1 Jul (season) + Fri/Sat/Sun custom
    const q = quoteStay(l, d("2027-07-01"), d("2027-07-05"));
    expect(q).toMatchObject({ ok: true, nights: 4, nightsCents: 30_000 + 3 * 45_000, totalCents: 30_000 + 3 * 45_000 + 10_000 });
  });
});
