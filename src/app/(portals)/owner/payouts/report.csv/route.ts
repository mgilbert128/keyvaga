import { getCurrentUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";

const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
const dollars = (c: number) => (c / 100).toFixed(2);
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

/**
 * The owner's earnings for one year as CSV, for their accountant: one row per booking (and per paid extra),
 * with rent, cleaning, Keyvaga's host fee, owner-filed lodging tax passed through, and the payout.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !user.roles.includes("OWNER")) return new Response("Not allowed", { status: 403 });
  const yearParam = Number(new URL(request.url).searchParams.get("year"));
  const year = Number.isInteger(yearParam) && yearParam >= 2020 && yearParam <= 2100 ? yearParam : new Date().getUTCFullYear();
  const from = new Date(Date.UTC(year, 0, 1));
  const to = new Date(Date.UTC(year + 1, 0, 1));

  const bookings = await db.booking.findMany({
    where: {
      listing: { ownerId: user.id },
      checkIn: { gte: from, lt: to },
      OR: [{ status: { in: ["CONFIRMED", "COMPLETED"] } }, { status: "CANCELLED", payoutDueCents: { gt: 0 } }],
    },
    orderBy: { checkIn: "asc" },
    include: {
      listing: { select: { title: true } },
      guest: { select: { name: true } },
      paymentRequests: { where: { status: "PAID" } },
    },
  });

  const header = ["Type", "Booking", "Listing", "Guest", "Check in", "Check out", "Nights", "Status", "Rent (USD)", "Cleaning (USD)", "Pet fee (USD)", "Keyvaga host fee (USD)", "Lodging tax for you to remit (USD)", "Your payout (USD)", "Payout status", "Description"];
  const rows: (string | number)[][] = [];
  for (const b of bookings) {
    const nights = Math.round((b.checkOut.getTime() - b.checkIn.getTime()) / 86_400_000);
    const cancelled = b.status === "CANCELLED";
    rows.push([
      "Booking", b.id.slice(-8).toUpperCase(), b.listing.title, b.guest.name, day(b.checkIn), day(b.checkOut), nights,
      cancelled ? "Cancelled (partial payout)" : b.checkOut <= new Date() ? "Completed" : "Upcoming",
      cancelled ? "" : dollars(b.nightlyCents), cancelled ? "" : dollars(b.cleaningCents), cancelled ? "" : dollars(b.petFeeCents), cancelled ? "" : dollars(b.hostFeeCents), cancelled ? "" : dollars(b.ownerTaxCents),
      dollars(cancelled ? b.payoutDueCents : b.hostPayoutCents),
      b.payoutStatus === "PAID" ? "Paid" : b.payoutStatus === "PENDING" ? "Scheduled" : "None",
      "",
    ]);
    for (const r of b.paymentRequests) {
      rows.push([
        "Extra", b.id.slice(-8).toUpperCase(), b.listing.title, b.guest.name, day(b.checkIn), day(b.checkOut), "", "Paid",
        dollars(r.amountCents), "", "", dollars(r.hostFeeCents), dollars(r.ownerTaxCents), dollars(r.ownerPayoutCents),
        r.paidOutAt ? "Paid" : "Scheduled", r.description,
      ]);
    }
  }
  const total = (i: number) => dollars(rows.reduce((t, r) => t + Math.round(Number(r[i] || 0) * 100), 0));
  rows.push(["Total", "", "", "", "", "", "", "", total(8), total(9), total(10), total(11), total(12), total(13), "", ""]);

  return new Response([header, ...rows].map((l) => l.map(cell).join(",")).join("\r\n") + "\r\n", {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="keyvaga-earnings-${year}.csv"`, "cache-control": "no-store" },
  });
}
