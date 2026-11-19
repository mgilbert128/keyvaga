import "server-only";
import { db } from "@/lib/db";
import { buildTaxReport } from "@/lib/tax-calc";

/** "2026-12" → [Dec 1, Jan 1) in UTC dates (booking dates are stored as plain dates). */
export function monthRange(month: string): { start: Date; end: Date; label: string } | null {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const start = new Date(Date.UTC(y, mo, 1));
  const end = new Date(Date.UTC(y, mo + 1, 1));
  return { start, end, label: new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(start) };
}

/** Tax collected for stays checking in during the month (see buildTaxReport for cancellations). */
export async function taxReportFor(month: string) {
  const range = monthRange(month);
  if (!range) return null;
  const bookings = await db.booking.findMany({
    where: { checkIn: { gte: range.start, lt: range.end }, taxCents: { gt: 0 }, status: { in: ["CONFIRMED", "COMPLETED", "CANCELLED"] } },
    select: { status: true, nightlyCents: true, cleaningCents: true, petFeeCents: true, taxCents: true, taxRetainedCents: true, taxLines: true },
  });
  return { ...range, rows: buildTaxReport(bookings) };
}
