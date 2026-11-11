import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { connection } from "next/server";
import { requirePortal } from "@/lib/auth/dal";
import { ownerOverview } from "@/lib/owner-stats";
import { PortalShell } from "@/components/layout/PortalShell";
import { ownerNav } from "@/components/layout/portal-nav";
import { Card, Chip } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { formatCents } from "@/lib/money";
import { todayIn } from "@/lib/dates";

export const metadata: Metadata = { title: "Owner overview" };
const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export default function Page() {
  return (
    <Suspense fallback={<div className="h-screen" aria-hidden="true" />}>
      <Overview />
    </Suspense>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="flex flex-col gap-1">
      <p className="text-ink-muted">{label}</p>
      <p className="text-3xl font-bold tracking-tight sm:text-4xl">{value}</p>
      {hint ? <p className="text-sm text-ink-muted">{hint}</p> : null}
    </Card>
  );
}

async function Overview() {
  await connection();
  const user = await requirePortal("owner", "/owner");
  const o = await ownerOverview(user.id);
  const today = todayIn();

  return (
    <PortalShell portal="Owner" user={user} nav={ownerNav("/owner")}>
      <div className="flex flex-col gap-6 pt-6 sm:pt-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Welcome back, {user.name.split(" ")[0]}</h1>
        </div>

        {!o.hasListings ? (
          <Card className="flex flex-col items-start gap-4">
            <p className="text-lg font-semibold">Add your first property to start taking bookings.</p>
            <ButtonLink href="/owner/listings/new">Add a listing</ButtonLink>
          </Card>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="This month" value={formatCents(o.earningsCents)} hint="Your share of nights this month" />
          <Stat label="Occupancy" value={o.occupancy === null ? "—" : `${o.occupancy}%`} hint="Booked nights this month" />
          <Stat label="Upcoming stays" value={String(o.upcomingCount)} />
          <Stat label="Next payout" value={o.nextPayout ? formatCents(o.nextPayout.cents) : "—"} hint={o.nextPayout ? `After check-in ${fmt.format(o.nextPayout.date)}` : "None scheduled"} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xl font-bold sm:text-2xl">Upcoming bookings</h2>
              <Link href="/owner/bookings" className="text-brand underline underline-offset-4">All</Link>
            </div>
            {o.upcoming.length === 0 ? (
              <p className="text-ink-muted">No upcoming bookings yet.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {o.upcoming.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 py-3">
                    <Link href={`/owner/bookings/${b.id}`} className="hover:underline">{b.listing.title} · {fmt.format(b.checkIn)}–{fmt.format(b.checkOut)} · {b.guest.name.split(" ")[0]}</Link>
                    <Chip>{b.checkIn <= today ? "Staying now" : "Confirmed"}</Chip>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="flex flex-col gap-3">
            <h2 className="text-xl font-bold sm:text-2xl">Needs attention</h2>
            {o.attention.length === 0 ? (
              <p className="text-ink-muted">All caught up. ✓</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {o.attention.map((a) => (
                  <li key={a.key} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <span>{a.text}</span>
                    <ButtonLink href={a.href} variant="secondary">{a.action}</ButtonLink>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold sm:text-2xl">Availability</h2>
            <p className="text-ink-muted">See bookings, block dates and check nightly prices.</p>
          </div>
          <ButtonLink href="/owner/calendar" variant="secondary">Open calendar</ButtonLink>
        </Card>
      </div>
    </PortalShell>
  );
}
