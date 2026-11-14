import { describe, expect, it } from "vitest";
import { isDue, renderMessage, sendDate, unknownPlaceholders, SUGGESTED_TEMPLATES, PLACEHOLDERS } from "@/lib/auto-messages";
import { parseISODate } from "@/lib/dates";

const d = (s: string) => parseISODate(s)!;
const b = { status: "CONFIRMED", checkIn: d("2027-07-03"), checkOut: d("2027-07-06"), confirmedAt: new Date("2027-05-01T15:30:00Z") };

describe("send dates", () => {
  it("works out the day for each trigger", () => {
    expect(sendDate("BOOKING_CONFIRMED", 0, b)?.toISOString().slice(0, 10)).toBe("2027-05-01");
    expect(sendDate("BEFORE_CHECKIN", 7, b)?.toISOString().slice(0, 10)).toBe("2027-06-26");
    expect(sendDate("CHECKIN_DAY", 0, b)?.toISOString().slice(0, 10)).toBe("2027-07-03");
    expect(sendDate("BEFORE_CHECKOUT", 1, b)?.toISOString().slice(0, 10)).toBe("2027-07-05");
    expect(sendDate("AFTER_CHECKOUT", 1, b)?.toISOString().slice(0, 10)).toBe("2027-07-07");
  });
});

describe("when messages are due", () => {
  it("waits until the send day", () => {
    expect(isDue("BEFORE_CHECKIN", 7, b, d("2027-06-25"))).toBe(false);
    expect(isDue("BEFORE_CHECKIN", 7, b, d("2027-06-26"))).toBe(true);
  });
  it("catches up for late bookings instead of skipping", () => {
    const late = { ...b, confirmedAt: new Date("2027-07-01T12:00:00Z") };
    expect(isDue("BEFORE_CHECKIN", 7, late, d("2027-07-01"))).toBe(true);
  });
  it("stops pre-arrival messages once the stay is over, and after-checkout after a week", () => {
    expect(isDue("BEFORE_CHECKIN", 7, b, d("2027-07-06"))).toBe(false);
    expect(isDue("BEFORE_CHECKOUT", 1, b, d("2027-07-06"))).toBe(true);
    expect(isDue("AFTER_CHECKOUT", 1, b, d("2027-07-07"))).toBe(true);
    expect(isDue("AFTER_CHECKOUT", 1, b, d("2027-07-15"))).toBe(false);
  });
  it("never sends for cancelled bookings", () => {
    expect(isDue("CHECKIN_DAY", 0, { ...b, status: "CANCELLED" }, d("2027-07-03"))).toBe(false);
  });
});

describe("placeholders", () => {
  const vars = Object.fromEntries(PLACEHOLDERS.map((p) => [p.key, `<${p.key}>`])) as Record<(typeof PLACEHOLDERS)[number]["key"], string>;
  it("fills known placeholders and leaves unknown ones visible", () => {
    expect(renderMessage("Hi {guest_first_name}, see {listing_title}. {oops}", { ...vars, guest_first_name: "Ana", listing_title: "Lake House" })).toBe("Hi Ana, see Lake House. {oops}");
    expect(unknownPlaceholders("Hi {guest_first_name} {wifi_password} {oops} {oops}")).toEqual(["wifi_password", "oops"]);
  });
  it("suggested templates only use known placeholders", () => {
    for (const t of SUGGESTED_TEMPLATES) expect(unknownPlaceholders(t.body)).toEqual([]);
  });
});
