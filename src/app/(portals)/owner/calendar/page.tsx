import { Suspense } from "react";
import { CalendarSync } from "@/components/calendar/CalendarSync";
import { ensureIcalToken } from "@/lib/calendar-sync";
import { siteUrl } from "@/lib/site";
import Link from "next/link";
import type { Metadata } from "next";
import { connection } from "next/server";
import { requirePortal } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { ownerListingsWithSelection } from "@/lib/owner-pages";
import { addDateDiscount, blockDates, removeDateDiscount, resetDatePrice, setDatePrice, unblockDates } from "@/app/actions/calendar";
import { CalendarSelector, type CalendarCell } from "@/components/owner/CalendarSelector";
import { PortalShell } from "@/components/layout/PortalShell";
import { ownerNav } from "@/components/layout/portal-nav";
import { Card } from "@/components/ui/Card";
import { buttonClass } from "@/components/ui/Button";
import { ListingPicker } from "@/components/owner/ListingPicker";
import { addDays, monthGrid, todayIn, toISODate } from "@/lib/dates";
import { discountForNight, pctLabel, rateForNight } from "@/lib/pricing";
import { formatCents } from "@/lib/money";

export const metadata: Metadata = { title: "Calendar" };
const monthFmt = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const dayFmt = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
const shortFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export default function Page({ searchParams }: PageProps<"/owner/calendar">) {
  return (
    <Suspense fallback={<div className="h-screen" aria-hidden="true" />}>
      <Calendar searchParams={searchParams} />
    </Suspense>
  );
}

async function Calendar({ searchParams }: { searchParams: PageProps<"/owner/calendar">["searchParams"] }) {
  const sp = await searchParams;
  await connection();
  const user = await requirePortal("owner", "/owner/calendar");
  const { listings, current } = await ownerListingsWithSelection(user.id, typeof sp.listing === "string" ? sp.listing : undefined);
  const today = todayIn();
  const m = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : toISODate(today).slice(0, 7);
  const [year, month] = m.split("-").map(Number) as [number, number];
  const first = new Date(Date.UTC(year, month - 1, 1));
  const next = new Date(Date.UTC(year, month, 1));
  const prevMonth = toISODate(new Date(Date.UTC(year, month - 2, 1))).slice(0, 7);
  const nextMonth = toISODate(next).slice(0, 7);

  if (!current) {
    return (
      <PortalShell portal="Owner" user={user} nav={ownerNav("/owner/calendar")}>
        <div className="pt-10"><h1 className="text-3xl font-bold">Calendar</h1><p className="mt-4 text-ink-muted">Add a listing first. <Link href="/owner/listings/new" className="text-brand underline">Add a listing</Link></p></div>
      </PortalShell>
    );
  }

  const listing = await db.listing.findUniqueOrThrow({ where: { id: current.id }, include: { seasonalRates: true, dateRates: { where: { date: { gte: first, lt: next } } }, dateDiscounts: { where: { endDate: { gt: today } }, orderBy: { startDate: "asc" } } } });
  const [bookings, blocks] = await Promise.all([
    db.booking.findMany({
      where: { listingId: listing.id, checkIn: { lt: next }, checkOut: { gt: first }, OR: [{ status: "CONFIRMED" }, { status: "PENDING_PAYMENT", holdExpiresAt: { gt: new Date() } }, { status: "REQUESTED", holdExpiresAt: { gt: new Date() } }] },
      include: { guest: { select: { name: true } } },
    }),
    db.calendarBlock.findMany({ where: { listingId: listing.id, endDate: { gt: today } }, orderBy: { startDate: "asc" } }),
  ]);
  const [feeds, icalToken] = await Promise.all([
    db.calendarFeed.findMany({ where: { listingId: listing.id }, orderBy: { createdAt: "asc" } }),
    ensureIcalToken(listing.id),
  ]);
  const nightInfo = (d: Date) => {
    const booking = bookings.find((b) => d >= b.checkIn && d < b.checkOut);
    if (booking) return { kind: "booked" as const, label: booking.status === "CONFIRMED" ? booking.guest.name.split(" ")[0]! : "On hold", href: booking.status === "CONFIRMED" ? `/owner/bookings/${booking.id}` : null, start: +d === +booking.checkIn };
    const block = blocks.find((b) => d >= b.startDate && d < b.endDate);
    if (block) return { kind: "blocked" as const, label: block.note ?? "Blocked", href: null, start: +d === +block.startDate };
    const rate = rateForNight({ ...listing, seasons: listing.seasonalRates, dateRates: listing.dateRates }, d);
    const disc = discountForNight({ discounts: listing.dateDiscounts }, d);
    const cents = disc ? rate.rateCents - Math.round((rate.rateCents * disc.percentBps) / 10_000) : rate.rateCents;
    return { kind: "open" as const, label: formatCents(cents), href: null, start: false, custom: rate.source === "custom", discountPct: disc ? Math.round(disc.percentBps / 100) : 0 };
  };
  const q = (extra: Record<string, string>) => `/owner/calendar?${new URLSearchParams({ listing: listing.id, month: m, ...extra })}`;

  return (
    <PortalShell portal="Owner" user={user} nav={ownerNav("/owner/calendar")}>
      <div className="flex flex-col gap-6 pt-6 sm:pt-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Calendar</h1>
        <ListingPicker listings={listings} current={listing.id} action="/owner/calendar" extra={{ month: m }} />

        <Card className="flex flex-col gap-4 p-4 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <Link href={q({ month: prevMonth })} className={buttonClass("ghost")} aria-label="Previous month">←</Link>
            <h2 className="text-xl font-bold">{listing.title} · {monthFmt.format(first)}</h2>
            <Link href={q({ month: nextMonth })} className={buttonClass("ghost")} aria-label="Next month">→</Link>
          </div>
          <CalendarSelector
            caption={`${listing.title} availability for ${monthFmt.format(first)}`}
            weeks={monthGrid(year, month - 1).map((week) =>
              week.map((d): CalendarCell | null => {
                if (!d) return null;
                const info = nightInfo(d);
                const past = d < today;
                return {
                  iso: toISODate(d),
                  day: d.getUTCDate(),
                  kind: info.kind,
                  label: info.label,
                  href: info.href,
                  past,
                  custom: "custom" in info ? Boolean(info.custom) : false,
                  discountPct: "discountPct" in info ? info.discountPct : 0,
                  a11y: `${dayFmt.format(d)}: ${info.kind === "booked" ? `booked by ${info.label}` : info.kind === "blocked" ? `blocked (${info.label})` : past ? "past" : `available at ${info.label}${"custom" in info && info.custom ? ", custom price" : ""}${"discountPct" in info && info.discountPct ? `, ${info.discountPct}% off` : ""}`}`,
                };
              }),
            )}
            setPrice={setDatePrice.bind(null, listing.id)}
            block={blockDates.bind(null, listing.id)}
            resetPrice={resetDatePrice.bind(null, listing.id)}
            addDiscount={addDateDiscount.bind(null, listing.id)}
          />
        </Card>

        <div className="grid grid-cols-1 gap-6">
          <Card className="flex flex-col gap-3" id="discounts">
            <h2 className="text-xl font-bold">Discounts</h2>
            <p className="text-sm text-ink-muted">To add one, select dates on the calendar and open the Discount tab. Guests see the discount on your listing and the savings at checkout.</p>
            {listing.dateDiscounts.length === 0 ? (
              <p className="text-ink-muted">No discounts yet.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {listing.dateDiscounts.map((dd) => (
                  <li key={dd.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span><strong>{pctLabel(dd.percentBps)} off</strong> · {dd.name} · {shortFmt.format(dd.startDate)} – {shortFmt.format(addDays(dd.endDate, -1))}</span>
                    <form action={removeDateDiscount.bind(null, listing.id, dd.id)}><button type="submit" className={buttonClass("ghost", "text-danger")}>Remove</button></form>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="flex flex-col gap-3">
            <h2 className="text-xl font-bold">Upcoming blocks</h2>
            {blocks.length === 0 ? (
              <p className="text-ink-muted">No blocked dates.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {blocks.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>{shortFmt.format(b.startDate)} – {shortFmt.format(addDays(b.endDate, -1))}{b.feedId ? ` · booked or blocked on ${b.note ?? "another site"} (synced)` : b.note ? ` · ${b.note}` : ""}</span>
                    {b.source === "OWNER" ? (
                      <form action={unblockDates.bind(null, listing.id, b.id)}><button type="submit" className={buttonClass("ghost", "text-danger")}>Unblock</button></form>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <CalendarSync listingId={listing.id} exportUrl={`${siteUrl()}/ical/${icalToken}.ics`} feeds={feeds} />
        </div>
      </div>
    </PortalShell>
  );
}
