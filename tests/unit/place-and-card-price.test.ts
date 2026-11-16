import { describe, expect, it } from "vitest";
import { destinationTerms, formatRegion, formatTown } from "@/lib/place";
import { lowestRateCents } from "@/lib/pricing";

describe("formatTown / formatRegion", () => {
  it("tidies lowercase and capitals", () => {
    expect(formatTown("gulf shores")).toBe("Gulf Shores");
    expect(formatTown("  ROCKY   MOUNT ")).toBe("Rocky Mount");
    expect(formatTown("lake of the ozarks")).toBe("Lake of the Ozarks");
    expect(formatTown("st. george")).toBe("St. George");
    expect(formatTown("winston-salem")).toBe("Winston-Salem");
  });
  it("keeps deliberate mixed case", () => {
    expect(formatTown("McAllen")).toBe("McAllen");
    expect(formatTown("DeFuniak springs")).toBe("DeFuniak Springs");
  });
  it("capitalizes state codes and tidies full names", () => {
    expect(formatRegion("al")).toBe("AL");
    expect(formatRegion("missouri")).toBe("Missouri");
    expect(formatRegion("")).toBe("");
  });
});

describe("lowestRateCents", () => {
  const d = (s: string) => new Date(`${s}T00:00:00Z`);
  const base = { nightlyRateCents: 45000, cleaningFeeCents: 0, minNights: 1 };
  it("finds an off-season rate below the base rate", () => {
    const seasons = [{ name: "Winter", startDate: d("2026-11-01"), endDate: d("2027-03-01"), nightlyRateCents: 14000 }];
    expect(lowestRateCents({ ...base, seasons }, d("2026-11-16"))).toBe(14000);
  });
  it("uses custom per-date prices", () => {
    expect(lowestRateCents({ ...base, dateRates: [{ date: d("2026-12-05"), rateCents: 12500 }] }, d("2026-11-16"))).toBe(12500);
  });
  it("ignores seasons outside the window and falls back to base", () => {
    const seasons = [{ name: "Old", startDate: d("2025-01-01"), endDate: d("2025-03-01"), nightlyRateCents: 9000 }];
    expect(lowestRateCents({ ...base, seasons }, d("2026-11-16"))).toBe(45000);
  });
});

describe("destinationTerms", () => {
  it("splits town and state, with or without a comma or full state name", () => {
    const gs = [{ kind: "word", text: "gulf" }, { kind: "word", text: "shores" }, { kind: "state", code: "AL", name: "Alabama" }];
    expect(destinationTerms("gulf shores, al")).toEqual(gs);
    expect(destinationTerms("Gulf Shores AL")).toEqual(gs);
    expect(destinationTerms("gulf shores alabama")).toEqual(gs);
  });
  it("handles multi-word states, filler words and a lone short word", () => {
    expect(destinationTerms("new york")).toEqual([{ kind: "state", code: "NY", name: "New York" }]);
    expect(destinationTerms("lake of the ozarks")).toEqual([{ kind: "word", text: "lake" }, { kind: "word", text: "ozarks" }]);
    expect(destinationTerms("al")).toEqual([{ kind: "word", text: "al" }]);
  });
});
