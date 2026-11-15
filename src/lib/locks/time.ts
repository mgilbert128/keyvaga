/**
 * Time helpers for door codes. Codes switch on at the listing's local check-in time and off at
 * its local checkout time, so we convert "2026-07-03 at 16:00 in America/Chicago" to a UTC instant.
 */

export const US_TIME_ZONES = [
  { id: "America/New_York", label: "Eastern" },
  { id: "America/Chicago", label: "Central" },
  { id: "America/Denver", label: "Mountain" },
  { id: "America/Phoenix", label: "Arizona (no daylight saving)" },
  { id: "America/Los_Angeles", label: "Pacific" },
  { id: "America/Anchorage", label: "Alaska" },
  { id: "Pacific/Honolulu", label: "Hawaii" },
  { id: "America/Puerto_Rico", label: "Puerto Rico / USVI" },
] as const;

export function isTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Offset (ms) of `tz` from UTC at the given instant. */
function offsetAt(instant: Date, tz: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year!, +parts.month! - 1, +parts.day!, +parts.hour!, +parts.minute!, +parts.second!);
  return asUtc - instant.getTime();
}

/** `day` is a calendar date (stored as UTC midnight); `hhmm` like "16:00". Returns the UTC instant of that local time. */
export function localTimeToUtc(day: Date, hhmm: string, tz: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const naive = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), h || 0, m || 0);
  // Two passes handle the hour around daylight-saving changes.
  let guess = naive - offsetAt(new Date(naive), tz);
  guess = naive - offsetAt(new Date(guess), tz);
  return new Date(guess);
}

/** Guest code window: check-in day at check-in time → checkout day at checkout time (listing's local time). */
export function stayWindow(b: { checkIn: Date; checkOut: Date }, l: { checkInTime: string; checkOutTime: string; timeZone: string }) {
  return { startsAt: localTimeToUtc(b.checkIn, l.checkInTime, l.timeZone), endsAt: localTimeToUtc(b.checkOut, l.checkOutTime, l.timeZone) };
}

/** Service code window: the scheduled day, 7 AM to 9 PM local. */
export function jobWindow(day: Date, tz: string) {
  return { startsAt: localTimeToUtc(day, "07:00", tz), endsAt: localTimeToUtc(day, "21:00", tz) };
}

/** A random 6-digit code that avoids easy guesses (repeats, runs). */
export function randomCode(rand: () => number = Math.random): string {
  for (;;) {
    const c = String(Math.floor(rand() * 900000) + 100000);
    if (/^(\d)\1+$/.test(c) || "0123456789".includes(c) || "9876543210".includes(c)) continue;
    return c;
  }
}
