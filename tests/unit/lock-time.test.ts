import { describe, expect, it } from "vitest";
import { jobWindow, localTimeToUtc, randomCode, stayWindow } from "@/lib/locks/time";

const day = (s: string) => new Date(`${s}T00:00:00Z`);

describe("door code times", () => {
  it("converts local check-in time to UTC, including daylight saving", () => {
    expect(localTimeToUtc(day("2027-07-03"), "16:00", "America/Chicago").toISOString()).toBe("2027-07-03T21:00:00.000Z"); // CDT -5
    expect(localTimeToUtc(day("2027-01-15"), "16:00", "America/Chicago").toISOString()).toBe("2027-01-15T22:00:00.000Z"); // CST -6
    expect(localTimeToUtc(day("2027-07-03"), "10:00", "America/Phoenix").toISOString()).toBe("2027-07-03T17:00:00.000Z");
    expect(localTimeToUtc(day("2027-03-14"), "16:00", "America/New_York").toISOString()).toBe("2027-03-14T20:00:00.000Z"); // DST starts that morning
    expect(localTimeToUtc(day("2027-12-01"), "15:00", "Pacific/Honolulu").toISOString()).toBe("2027-12-02T01:00:00.000Z");
  });

  it("stay window runs check-in time to checkout time", () => {
    const w = stayWindow({ checkIn: day("2027-07-03"), checkOut: day("2027-07-06") }, { checkInTime: "16:00", checkOutTime: "10:00", timeZone: "America/Los_Angeles" });
    expect(w.startsAt.toISOString()).toBe("2027-07-03T23:00:00.000Z");
    expect(w.endsAt.toISOString()).toBe("2027-07-06T17:00:00.000Z");
  });

  it("job window is 7 AM to 9 PM local", () => {
    const w = jobWindow(day("2027-07-06"), "America/Chicago");
    expect(w.startsAt.toISOString()).toBe("2027-07-06T12:00:00.000Z");
    expect(w.endsAt.toISOString()).toBe("2027-07-07T02:00:00.000Z");
  });

  it("random codes are 6 digits and skip easy guesses", () => {
    for (let i = 0; i < 50; i++) expect(randomCode()).toMatch(/^[1-9]\d{5}$/);
    const fixed = [1 / 9, 0.5]; // 200000 (fine)
    expect(randomCode(() => fixed.shift()!)).toBe("200000");
    // 111111 and 123456 are rejected
    const bad = [11111 / 900000, 23456 / 900000, 0.5];
    expect(randomCode(() => bad.shift()!)).toBe("550000");
  });
});
