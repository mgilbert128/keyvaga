import { describe, expect, it } from "vitest";
import { buildTaxReport, computeTaxes, formatRate, parseRatePercent, ratesForPlace, type TaxRateInput } from "@/lib/tax-calc";
import { bookingAmounts, cancellationOutcome } from "@/lib/booking-money";
import { parseISODate } from "@/lib/dates";

const rates: TaxRateInput[] = [
  { name: "Alabama state lodging tax", ratePpm: 50_000, filedBy: "KEYVAGA", state: "AL", city: "" },
  { name: "Gulf Shores lodging tax", ratePpm: 60_000, filedBy: "OWNER", state: "AL", city: "Gulf Shores" },
  { name: "Orange Beach lodging tax", ratePpm: 70_000, filedBy: "OWNER", state: "AL", city: "Orange Beach" },
  { name: "Missouri tax", ratePpm: 42_250, filedBy: "KEYVAGA", state: "MO", city: "" },
];

describe("ratesForPlace", () => {
  it("matches state-wide and same-town rates, by state code or name", () => {
    expect(ratesForPlace(rates, { city: "Gulf Shores", region: "AL" }).map((r) => r.name)).toEqual(["Alabama state lodging tax", "Gulf Shores lodging tax"]);
    expect(ratesForPlace(rates, { city: "gulf shores", region: "Alabama" })).toHaveLength(2);
    expect(ratesForPlace(rates, { city: "Mobile", region: "AL" }).map((r) => r.name)).toEqual(["Alabama state lodging tax"]);
    expect(ratesForPlace(rates, { city: "Austin", region: "TX" })).toEqual([]);
    expect(ratesForPlace(rates, { city: "Somewhere", region: "Narnia" })).toEqual([]);
  });
});

describe("computeTaxes", () => {
  it("taxes the subtotal per rate and splits by who files", () => {
    const t = computeTaxes(100_000, ratesForPlace(rates, { city: "Gulf Shores", region: "AL" }));
    expect(t.lines.map((l) => l.cents)).toEqual([5_000, 6_000]);
    expect(t).toMatchObject({ taxCents: 11_000, keyvagaTaxCents: 5_000, ownerTaxCents: 6_000 });
  });
  it("rounds each line to whole cents", () => {
    expect(computeTaxes(33_333, [rates[3]!]).taxCents).toBe(1_408); // 4.225% of $333.33
  });
  it("no rates, no tax", () => {
    expect(computeTaxes(100_000, []).taxCents).toBe(0);
  });
});

describe("taxes in booking money", () => {
  const a = bookingAmounts(100_000, { keyvagaTaxCents: 5_000, ownerTaxCents: 6_000 });
  it("guest pays taxes on top; fees ignore taxes; owner gets owner-filed tax", () => {
    expect(a).toMatchObject({ guestFeeCents: 5_000, hostFeeCents: 5_000, taxCents: 11_000, guestTotalCents: 116_000, hostPayoutCents: 101_000, platformCents: 10_000 });
    // Everything the guest pays is accounted for: owner + Keyvaga fees + Keyvaga-filed tax.
    expect(a.hostPayoutCents + a.platformCents + a.keyvagaTaxCents).toBe(a.guestTotalCents);
  });
  it("owner cancels: everything refunded, including taxes", () => {
    const o = cancellationOutcome({ by: "owner", policy: "STRICT", amounts: a, paidCents: 116_000, checkIn: parseISODate("2027-06-10")!, today: parseISODate("2027-06-01")! });
    expect(o).toMatchObject({ refundCents: 116_000, hostPayoutCents: 0, taxRetainedCents: 0 });
  });
  it("partial refund keeps taxes in proportion", () => {
    const o = cancellationOutcome({ by: "guest", policy: "STRICT", amounts: a, paidCents: 116_000, checkIn: parseISODate("2027-06-10")!, today: parseISODate("2027-06-01")! });
    expect(o.retainedCents + o.refundCents).toBe(116_000);
    expect(o.taxRetainedCents).toBe(Math.round((o.retainedCents * 11_000) / 116_000));
  });
});

describe("rate input", () => {
  it("parses and formats percents", () => {
    expect(parseRatePercent("4.5")).toBe(45_000);
    expect(parseRatePercent("4.225%")).toBe(42_250);
    expect(parseRatePercent("40")).toBeNull();
    expect(parseRatePercent("abc")).toBeNull();
    expect(formatRate(45_000)).toBe("4.5%");
    expect(formatRate(42_250)).toBe("4.225%");
    expect(formatRate(100_000)).toBe("10%");
  });
});

describe("buildTaxReport", () => {
  const lines = [
    { name: "AL state", ratePpm: 50_000, filedBy: "KEYVAGA", state: "AL", city: "", cents: 5_000 },
    { name: "Gulf Shores", ratePpm: 60_000, filedBy: "OWNER", state: "AL", city: "Gulf Shores", cents: 6_000 },
  ];
  it("adds up confirmed stays and only the kept part of cancelled ones", () => {
    const rows = buildTaxReport([
      { status: "CONFIRMED", nightlyCents: 90_000, cleaningCents: 10_000, taxCents: 11_000, taxRetainedCents: null, taxLines: lines },
      { status: "CANCELLED", nightlyCents: 90_000, cleaningCents: 10_000, taxCents: 11_000, taxRetainedCents: 5_500, taxLines: lines },
      { status: "CANCELLED", nightlyCents: 90_000, cleaningCents: 10_000, taxCents: 11_000, taxRetainedCents: 0, taxLines: lines },
      { status: "PENDING_PAYMENT", nightlyCents: 90_000, cleaningCents: 10_000, taxCents: 11_000, taxRetainedCents: null, taxLines: lines },
    ]);
    expect(rows).toEqual([
      { name: "AL state", filedBy: "KEYVAGA", state: "AL", city: "", ratePpm: 50_000, stays: 2, taxableCents: 150_000, taxCents: 7_500 },
      { name: "Gulf Shores", filedBy: "OWNER", state: "AL", city: "Gulf Shores", ratePpm: 60_000, stays: 2, taxableCents: 150_000, taxCents: 9_000 },
    ]);
  });
});
