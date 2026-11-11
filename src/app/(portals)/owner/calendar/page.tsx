import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { connection } from "next/server";
import { requirePortal } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { ownerListingsWithSelection } from "@/lib/owner-pages";
import { blockDates, unblockDates } from "@/app/actions/calendar";
import { PortalShell } from "@/components/layout/PortalShell";
import { ownerNav } from "@/components/layout/portal-nav";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { buttonClass } from "@/components/ui/Button";
import { ActionForm } from "@/components/owner/ActionForm";
import { ListingPicker } from "@/components/owner/ListingPicker";
import { addDays, monthGrid, todayIn, toISODate } from "@/lib/dates";
import { rateForNight } from "@/lib/pricing";
import { formatCents } from "@/lib/money";

export const metadata: Metadata = { title: "Calendar" };
const monthFmt = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const dayFmt = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
const shortFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const WEEKDAYS = [["Sun", "Sunday"], ["Mon", "Monday"], ["Tue", "Tuesday"], ["Wed", "Wednesday"], ["Thu", "Thursday"], ["Fri", "Friday"], ["Sat", "Saturday"]] as const;

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

  const listing = await db.listing.findUniqueOrThrow({ where: { id: current.id }, include: { seasonalRates: true } });
  const [bookings, blocks] = await Promise.all([
    db.booking.findMany({
      where: { listingId: listing.id, checkIn: { lt: next }, checkOut: { gt: first }, OR: [{ status: "CONFIRMED" }, { status: "PENDING_PAYMENT", holdExpiresAt: { gt: new Date() } }] },
      include: { guest: { select: { name: true } } },
    }),
    db.calendarBlock.findMany({ where: { listingId: listing.id, endDate: { gt: today } }, orderBy: { startDate: "asc" } }),
  ]);
  const nightInfo = (d: Date) => {
    const booking = bookings.find((b) => d >= b.checkIn && d < b.checkOut);
    if (booking) return { kind: "booked" as const, label: booking.status === "CONFIRMED" ? booking.guest.name.split(" ")[0]! : "On hold", href: booking.status === "CONFIRMED" ? `/owner/bookings/${booking.id}` : null, start: +d === +booking.checkIn };
    const block = blocks.find((b) => d >= b.startDate && d < b.endDate);
    if (block) return { kind: "blocked" as const, label: block.note ?? "Blocked", href: null, start: +d === +block.startDate };
    return { kind: "open" as const, label: formatCents(rateForNight({ ...listing, seasons: listing.seasonalRates }, d).rateCents), href: null, start: false };
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
          <table className="w-full table-fixed border-collapse">
            <caption className="sr-only">{listing.title} availability for {monthFmt.format(first)}</caption>
            <thead>
              <tr>{WEEKDAYS.map(([s, l]) => <th key={s} scope="col" className="pb-2 text-xs font-semibold text-ink-muted sm:text-sm"><abbr title={l} className="no-underline">{s}</abbr></th>)}</tr>
            </thead>
            <tbody>
              {monthGrid(year, month - 1).map((week, wi) => (
                <tr key={wi}>
                  {week.map((d, di) => {
                    if (!d) return <td key={di} />;
                    const info = nightInfo(d);
                    const past = d < today;
                    const cls =
                      info.kind === "booked" ? "bg-brand text-on-brand" : info.kind === "blocked" ? "bg-line text-ink" : past ? "bg-surface text-ink-muted/60" : "bg-surface";
                    const content = (
                      <span className="flex h-full flex-col gap-0.5 overflow-hidden">
                        <span className="text-xs font-semibold sm:text-sm">{d.getUTCDate()}</span>
                        <span className="truncate text-[11px] sm:text-xs">{info.kind === "open" && past ? "" : info.label}</span>
                      </span>
                    );
                    return (
                      <td key={di} className="p-0.5 align-top">
                        <div className={`h-16 rounded-lg border border-line p-1.5 sm:h-20 ${cls}`} aria-label={`${dayFmt.format(d)}: ${info.kind === "booked" ? `booked by ${info.label}` : info.kind === "blocked" ? `blocked (${info.label})` : past ? "past" : `available at ${info.label}`}`}>
                          {info.href ? <Link href={info.href} className="block h-full">{content}</Link> : content}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-muted" aria-label="Calendar key">
            <li className="flex items-center gap-2"><span className="inline-block h-4 w-4 rounded border border-line bg-surface" aria-hidden="true" /> Open (nightly price)</li>
            <li className="flex items-center gap-2"><span className="inline-block h-4 w-4 rounded bg-brand" aria-hidden="true" /> Booked</li>
            <li className="flex items-center gap-2"><span className="inline-block h-4 w-4 rounded bg-line" aria-hidden="true" /> Blocked</li>
          </ul>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="flex flex-col gap-4">
            <div>
              <h2 className="text-xl font-bold">Block dates</h2>
              <p className="text-ink-muted">For your own stays, maintenance or anything else. Guests can&apos;t book blocked nights.</p>
            </div>
            <ActionForm action={blockDates.bind(null, listing.id)} submitLabel="Block these nights" resetOnSuccess>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="First night" id="start" type="date" min={toISODate(today)} required />
                <Field label="Last night" id="end" type="date" min={toISODate(today)} required />
              </div>
              <Field label="Note (only you see this)" id="note" maxLength={120} placeholder="e.g. Family visit, deck repair" />
            </ActionForm>
          </Card>
          <Card className="flex flex-col gap-3">
            <h2 className="text-xl font-bold">Upcoming blocks</h2>
            {blocks.length === 0 ? (
              <p className="text-ink-muted">No blocked dates.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {blocks.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>{shortFmt.format(b.startDate)} – {shortFmt.format(addDays(b.endDate, -1))}{b.note ? ` · ${b.note}` : ""}{b.source !== "OWNER" ? ` · from ${b.source.toLowerCase()}` : ""}</span>
                    {b.source === "OWNER" ? (
                      <form action={unblockDates.bind(null, listing.id, b.id)}><button type="submit" className={buttonClass("ghost", "text-danger")}>Unblock</button></form>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </PortalShell>
  );
}
