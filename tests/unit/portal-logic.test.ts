import { describe, expect, it } from "vitest";
import { accessReleaseDate, canReview, isAccessReleased } from "@/lib/checkin";
import { overlapNights } from "@/lib/owner-stats";
import { parseISODate } from "@/lib/dates";

const d = (s: string) => parseISODate(s)!;

describe("check-in details release", () => {
  const base = { status: "CONFIRMED", checkIn: d("2026-12-10"), checkOut: d("2026-12-14"), releaseDays: 3 };
  it("releases N days before check-in, and only for confirmed stays that aren't over", () => {
    expect(accessReleaseDate(base.checkIn, 3).toISOString().slice(0, 10)).toBe("2026-12-07");
    expect(isAccessReleased({ ...base, today: d("2026-12-06") })).toBe(false);
    expect(isAccessReleased({ ...base, today: d("2026-12-07") })).toBe(true);
    expect(isAccessReleased({ ...base, today: d("2026-12-13") })).toBe(true);
    expect(isAccessReleased({ ...base, today: d("2026-12-14") })).toBe(false);
    expect(isAccessReleased({ ...base, status: "CANCELLED", today: d("2026-12-09") })).toBe(false);
    expect(isAccessReleased({ ...base, releaseDays: 0, today: d("2026-12-09") })).toBe(false);
    expect(isAccessReleased({ ...base, releaseDays: 0, today: d("2026-12-10") })).toBe(true);
  });
});

describe("reviews", () => {
  it("allows one review after checkout, within 60 days, for completed stays", () => {
    const b = { status: "CONFIRMED", checkOut: d("2026-11-01"), hasReview: false };
    expect(canReview({ ...b, today: d("2026-10-31") })).toBe(false);
    expect(canReview({ ...b, today: d("2026-11-01") })).toBe(true);
    expect(canReview({ ...b, today: d("2026-12-31") })).toBe(true);
    expect(canReview({ ...b, today: d("2027-01-01") })).toBe(false);
    expect(canReview({ ...b, hasReview: true, today: d("2026-11-05") })).toBe(false);
    expect(canReview({ ...b, status: "CANCELLED", today: d("2026-11-05") })).toBe(false);
  });
});

describe("owner stats", () => {
  it("counts only the nights inside the month", () => {
    const nov = [d("2026-11-01"), d("2026-12-01")] as const;
    expect(overlapNights(d("2026-11-28"), d("2026-12-03"), ...nov)).toBe(3);
    expect(overlapNights(d("2026-10-30"), d("2026-11-02"), ...nov)).toBe(1);
    expect(overlapNights(d("2026-12-01"), d("2026-12-05"), ...nov)).toBe(0);
  });
});
