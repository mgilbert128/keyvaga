import { describe, expect, it } from "vitest";
import { averageResponseHours, jobAmounts, nextJobStatus, parseServiceAreas, providerServes, responseTimeLabel } from "@/lib/services";

describe("job fees: 5% owner + 5% provider", () => {
  it("splits a $200 cleaning", () => {
    expect(jobAmounts(20_000)).toEqual({ quoteCents: 20_000, ownerFeeCents: 1_000, ownerTotalCents: 21_000, providerFeeCents: 1_000, providerPayoutCents: 19_000, platformCents: 2_000 });
  });
  it("rounds to cents and balances", () => {
    const a = jobAmounts(12_345);
    expect(a.ownerTotalCents - a.providerPayoutCents).toBe(a.platformCents);
  });
});

describe("service areas and matching", () => {
  it("parses a typed list of towns", () => {
    expect(parseServiceAreas("Lake Geneva, Williams Bay;  delavan\nLake  Geneva")).toEqual(["lake geneva", "williams bay", "delavan"]);
  });
  const p = { status: "APPROVED", categories: ["cleaning", "linen"], serviceAreas: ["lake geneva", "williams bay"], region: "WI" };
  it("matches category + listed city + region", () => {
    expect(providerServes(p, { category: "cleaning", city: "Lake Geneva", region: "WI" })).toBe(true);
    expect(providerServes(p, { category: "plumbing", city: "Lake Geneva", region: "WI" })).toBe(false);
    expect(providerServes(p, { category: "cleaning", city: "Madison", region: "WI" })).toBe(false);
    expect(providerServes(p, { category: "cleaning", city: "Lake Geneva", region: "IL" })).toBe(false);
  });
  it("treats no cities as the whole region, and requires approval", () => {
    expect(providerServes({ ...p, serviceAreas: [] }, { category: "cleaning", city: "Madison", region: "wi" })).toBe(true);
    expect(providerServes({ ...p, status: "PENDING_REVIEW" }, { category: "cleaning", city: "Lake Geneva", region: "WI" })).toBe(false);
  });
});

describe("job lifecycle", () => {
  it("follows the allowed steps only", () => {
    expect(nextJobStatus("accept_quote", "OPEN")).toBe("ASSIGNED");
    expect(nextJobStatus("accept_quote", "ASSIGNED")).toBeNull();
    expect(nextJobStatus("mark_complete", "ASSIGNED")).toBe("COMPLETED");
    expect(nextJobStatus("release", "COMPLETED")).toBe("PAID");
    expect(nextJobStatus("release", "ASSIGNED")).toBeNull();
    expect(nextJobStatus("report_problem", "COMPLETED")).toBe("DISPUTED");
    expect(nextJobStatus("cancel", "COMPLETED")).toBeNull();
    expect(nextJobStatus("resolve_refund", "DISPUTED")).toBe("CANCELLED");
  });
});

describe("response time", () => {
  it("averages and labels", () => {
    const t = new Date("2026-11-01T10:00:00Z");
    expect(averageResponseHours([{ jobCreatedAt: t, quotedAt: new Date("2026-11-01T12:00:00Z") }, { jobCreatedAt: t, quotedAt: new Date("2026-11-01T11:00:00Z") }])).toBe(1.5);
    expect(responseTimeLabel(1.5)).toBe("Responds within 2 hrs");
    expect(responseTimeLabel(0.3)).toBe("Responds within an hour");
    expect(responseTimeLabel(30)).toBe("Responds within 2 days");
    expect(responseTimeLabel(null)).toBeNull();
  });
});
