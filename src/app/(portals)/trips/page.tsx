import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { connection } from "next/server";
import { requirePortal } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { PortalShell } from "@/components/layout/PortalShell";
import { guestNav } from "@/components/layout/portal-nav";
import { ButtonLink } from "@/components/ui/Button";
import { BookingStatusChip } from "@/components/booking/BookingStatus";
import { todayIn } from "@/lib/dates";
import { tintAt } from "@/lib/tint";

export const metadata: Metadata = { title: "Your trips" };
const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export default function Page() {
  return (
    <Suspense fallback={<div className="h-screen" aria-hidden="true" />}>
      <Trips />
    </Suspense>
  );
}

async function Trips() {
  await connection();
  const user = await requirePortal("guest", "/trips");
  const today = todayIn();
  const bookings = await db.booking.findMany({
    where: { guestId: user.id, OR: [{ status: { in: ["CONFIRMED", "CANCELLED"] } }, { status: "PENDING_PAYMENT", holdExpiresAt: { gt: new Date() } }], NOT: { cancelledBy: "system" } },
    orderBy: { checkIn: "asc" },
    include: { listing: { select: { title: true, city: true, region: true, photos: { orderBy: { position: "asc" }, take: 1, select: { url: true } } } } },
  });
  const upcoming = bookings.filter((b) => b.status !== "CANCELLED" && b.checkOut > today);
  const past = bookings.filter((b) => b.status !== "CANCELLED" && b.checkOut <= today).reverse();
  const cancelled = bookings.filter((b) => b.status === "CANCELLED");

  const section = (title: string, items: typeof bookings) =>
    items.length ? (
      <section className="flex flex-col gap-4">
        <h2 className="text-2xl font-bold">{title}</h2>
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {items.map((b, i) => (
            <li key={b.id} className="relative flex gap-4 rounded-card border border-line bg-surface p-4">
              {b.listing.photos[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.listing.photos[0].url} alt="" className="h-24 w-32 shrink-0 rounded-xl object-cover" />
              ) : (
                <div className={`h-24 w-32 shrink-0 rounded-xl ${tintAt(i)}`} aria-hidden="true" />
              )}
              <div className="flex flex-col gap-1">
                <h3 className="text-lg font-bold">
                  <Link href={b.status === "PENDING_PAYMENT" ? `/book/${b.id}` : `/trips/${b.id}`} className="after:absolute after:inset-0 after:rounded-card">{b.listing.title}</Link>
                </h3>
                <p className="text-sm text-ink-muted">{fmt.format(b.checkIn)} – {fmt.format(b.checkOut)} · {b.guests} guest{b.guests === 1 ? "" : "s"}</p>
                <div><BookingStatusChip status={b.status} checkIn={b.checkIn} checkOut={b.checkOut} today={today} /></div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    ) : null;

  return (
    <PortalShell user={user} nav={guestNav("/trips")}>
      <div className="flex flex-col gap-10 pt-6 sm:pt-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Your trips</h1>
        {bookings.length === 0 ? (
          <div className="flex flex-col items-start gap-4 rounded-card border border-dashed border-line-strong bg-surface p-8">
            <p className="text-lg font-semibold">No trips yet.</p>
            <ButtonLink href="/search">Find a stay</ButtonLink>
          </div>
        ) : null}
        {section("Upcoming", upcoming)}
        {section("Past trips", past)}
        {section("Cancelled", cancelled)}
      </div>
    </PortalShell>
  );
}
