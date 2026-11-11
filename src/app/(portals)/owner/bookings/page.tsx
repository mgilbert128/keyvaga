import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { connection } from "next/server";
import { requirePortal } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { PortalShell } from "@/components/layout/PortalShell";
import { ownerNav } from "@/components/layout/portal-nav";
import { BookingStatusChip } from "@/components/booking/BookingStatus";
import { formatCents } from "@/lib/money";
import { todayIn } from "@/lib/dates";

export const metadata: Metadata = { title: "Bookings" };
const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export default function Page() {
  return (
    <Suspense fallback={<div className="h-screen" aria-hidden="true" />}>
      <Bookings />
    </Suspense>
  );
}

async function Bookings() {
  await connection();
  const user = await requirePortal("owner", "/owner/bookings");
  const today = todayIn();
  const bookings = await db.booking.findMany({
    where: { listing: { ownerId: user.id }, status: { in: ["CONFIRMED", "CANCELLED"] }, NOT: { cancelledBy: "system" } },
    orderBy: { checkIn: "asc" },
    include: { listing: { select: { title: true } }, guest: { select: { name: true } } },
  });
  const upcoming = bookings.filter((b) => b.status === "CONFIRMED" && b.checkOut > today);
  const other = bookings.filter((b) => !(b.status === "CONFIRMED" && b.checkOut > today)).reverse();

  const table = (title: string, rows: typeof bookings) => (
    <section className="flex flex-col gap-3">
      <h2 className="text-2xl font-bold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-ink-muted">None yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((b) => (
            <li key={b.id} className="relative flex flex-col gap-2 rounded-card border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-bold">
                  <Link href={`/owner/bookings/${b.id}`} className="after:absolute after:inset-0 after:rounded-card">{b.listing.title} · {b.guest.name}</Link>
                </h3>
                <p className="text-sm text-ink-muted">{fmt.format(b.checkIn)} – {fmt.format(b.checkOut)} · {b.guests} guest{b.guests === 1 ? "" : "s"} · your payout {formatCents(b.status === "CANCELLED" ? b.payoutDueCents : b.hostPayoutCents)}</p>
              </div>
              <BookingStatusChip status={b.status} checkIn={b.checkIn} checkOut={b.checkOut} today={today} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <PortalShell portal="Owner" user={user} nav={ownerNav("/owner/bookings")}>
      <div className="flex flex-col gap-10 pt-6 sm:pt-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Bookings</h1>
        {table("Upcoming", upcoming)}
        {table("Past and cancelled", other)}
      </div>
    </PortalShell>
  );
}
