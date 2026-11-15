import { describe, expect, it } from "vitest";
import { buildIcs, detectProvider, mergeRanges, normalizeFeedUrl, parseIcs } from "@/lib/ical";

const day = (s: string) => new Date(`${s}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);

const AIRBNB = `BEGIN:VCALENDAR\r
PRODID;X-RICAL-TZSOURCE=TZINFO:-//Airbnb Inc//Hosting Calendar 1.0//EN\r
CALSCALE:GREGORIAN\r
VERSION:2.0\r
BEGIN:VEVENT\r
DTEND;VALUE=DATE:20270706\r
DTSTART;VALUE=DATE:20270703\r
UID:1418fb94e984-0f6a2c6bfa2b0a1c8c3e1c6e7e3c8c9d@airbnb.com\r
DESCRIPTION:Reservation URL: https://www.airbnb.com/hosting/reservations/details/HMABCDEF\\nPhone \r
 Number (Last 4 Digits): 1234\r
SUMMARY:Reserved\r
END:VEVENT\r
BEGIN:VEVENT\r
DTEND;VALUE=DATE:20270801\r
DTSTART;VALUE=DATE:20270728\r
UID:aaa@airbnb.com\r
SUMMARY:Airbnb (Not available)\r
END:VEVENT\r
END:VCALENDAR\r
`;

describe("iCal", () => {
  it("reads Airbnb-style all-day events with folded lines", () => {
    const ev = parseIcs(AIRBNB);
    expect(ev.map((e) => [iso(e.start), iso(e.end), e.summary])).toEqual([
      ["2027-07-03", "2027-07-06", "Reserved"],
      ["2027-07-28", "2027-08-01", "Airbnb (Not available)"],
    ]);
  });

  it("handles date-times (UTC converted to the listing's day), TZID, missing DTEND and cancelled events", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT", "UID:a", "DTSTART:20270910T030000Z", "DTEND:20270912T160000Z", "END:VEVENT", // 3 AM UTC = Sep 9 evening Central
      "BEGIN:VEVENT", "UID:b", "DTSTART;TZID=America/New_York:20271001T150000", "DTEND;TZID=America/New_York:20271003T110000", "END:VEVENT",
      "BEGIN:VEVENT", "UID:c", "DTSTART;VALUE=DATE:20271101", "END:VEVENT",
      "BEGIN:VEVENT", "UID:d", "DTSTART;VALUE=DATE:20271201", "DTEND;VALUE=DATE:20271205", "STATUS:CANCELLED", "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    expect(parseIcs(ics, "America/Chicago").map((e) => [e.uid, iso(e.start), iso(e.end)])).toEqual([
      ["a", "2027-09-09", "2027-09-12"],
      ["b", "2027-10-01", "2027-10-03"],
      ["c", "2027-11-01", "2027-11-02"],
    ]);
  });

  it("merges overlapping and back-to-back ranges", () => {
    const m = mergeRanges([
      { start: day("2027-07-05"), end: day("2027-07-08") },
      { start: day("2027-07-01"), end: day("2027-07-05") },
      { start: day("2027-07-20"), end: day("2027-07-22") },
    ]);
    expect(m.map((r) => [iso(r.start), iso(r.end)])).toEqual([["2027-07-01", "2027-07-08"], ["2027-07-20", "2027-07-22"]]);
  });

  it("builds a feed other platforms can read back, folded at 75 characters", () => {
    const ics = buildIcs("Keyvaga: Lakeside Cabin", [{ uid: "booking-1@keyvaga.com", start: day("2027-07-03"), end: day("2027-07-06"), summary: "Keyvaga booking" }], new Date("2027-01-01T00:00:00Z"));
    expect(ics).toContain("DTSTART;VALUE=DATE:20270703\r\nDTEND;VALUE=DATE:20270706");
    expect(ics.split("\r\n").every((l) => l.length <= 75)).toBe(true);
    expect(parseIcs(ics).map((e) => [iso(e.start), iso(e.end)])).toEqual([["2027-07-03", "2027-07-06"]]);
  });

  it("recognizes platforms and checks links", () => {
    expect(detectProvider("https://www.airbnb.com/calendar/ical/123.ics?s=abc").name).toBe("Airbnb");
    expect(detectProvider("http://www.vrbo.com/icalendar/abc.ics").name).toBe("Vrbo");
    expect(detectProvider("https://admin.booking.com/hotel/hoteladmin/ical.html?t=x").name).toBe("Booking.com");
    expect(detectProvider("https://my.hospitable.com/ical/xyz.ics").name).toBe("Hospitable");
    expect(detectProvider("https://app.ownerrez.com/feeds/ical/abc").name).toBe("OwnerRez");
    expect(detectProvider("https://example.org/cal.ics").name).toBe("Other calendar");
    expect(normalizeFeedUrl("webcal://www.airbnb.com/calendar/ical/1.ics")).toEqual({ url: "https://www.airbnb.com/calendar/ical/1.ics" });
    expect(normalizeFeedUrl("http://localhost:3000/x")).toHaveProperty("error");
    expect(normalizeFeedUrl("https://169.254.169.254/latest")).toHaveProperty("error");
    expect(normalizeFeedUrl("not a link")).toHaveProperty("error");
  });
});
