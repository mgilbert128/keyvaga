/**
 * Stay dates are calendar days with no time zone ("2026-11-14").
 * Internally we use UTC midnight Dates so arithmetic never shifts a day.
 * Ranges are [start, end): the end day is the checkout morning and is free for the next guest.
 */
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseISODate(s: string | null | undefined): Date | null {
  if (!s || !ISO_DATE.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || toISODate(d) !== s ? null : d;
}

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

export function nightsBetween(checkIn: Date, checkOut: Date): number {
  return Math.round((checkOut.getTime() - checkIn.getTime()) / 86_400_000);
}

export type DateRange = { start: Date; end: Date };

/** Every night covered by the given [start, end) ranges, as ISO strings. */
export function unavailableNights(ranges: DateRange[]): Set<string> {
  const out = new Set<string>();
  for (const { start, end } of ranges) {
    for (let d = start; d < end; d = addDays(d, 1)) out.add(toISODate(d));
  }
  return out;
}

/** True if any night in [checkIn, checkOut) is unavailable. */
export function rangeHasConflict(checkIn: Date, checkOut: Date, nights: Set<string>): boolean {
  for (let d = checkIn; d < checkOut; d = addDays(d, 1)) if (nights.has(toISODate(d))) return true;
  return false;
}

/** Today's date in a given time zone, as UTC midnight. */
export function todayIn(timeZone = "America/Chicago", now = new Date()): Date {
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return new Date(`${iso}T00:00:00Z`);
}

/** Weeks (Sunday first) for a month; null pads days outside the month. */
export function monthGrid(year: number, monthIndex: number): (Date | null)[][] {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const cells: (Date | null)[] = Array(first.getUTCDay()).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(Date.UTC(year, monthIndex, d)));
  while (cells.length % 7) cells.push(null);
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
