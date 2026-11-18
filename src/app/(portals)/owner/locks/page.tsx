import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { requirePortal } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { finishPendingConnects, locksConfigured, refreshCodeStatuses } from "@/lib/locks";
import { US_TIME_ZONES } from "@/lib/locks/time";
import { connectLockAccount, disconnectLockAccount, dismissLockEvent, refreshLocks, retryLockEvent, saveLockSettings, setListingTimeZone } from "@/app/actions/locks";
import { PortalShell } from "@/components/layout/PortalShell";
import { ownerNav } from "@/components/layout/portal-nav";
import { Card, Chip } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";

export const metadata: Metadata = { title: "Smart locks" };

const when = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });

const BRANDS = ["Schlage", "Yale", "August", "Kwikset", "Igloohome", "Lockly", "Nuki", "SmartThings", "TTLock"];

export default function Page({ searchParams }: PageProps<"/owner/locks">) {
  return (
    <Suspense fallback={<div className="h-screen" aria-hidden="true" />}>
      <Locks searchParams={searchParams} />
    </Suspense>
  );
}

async function Locks({ searchParams }: { searchParams: PageProps<"/owner/locks">["searchParams"] }) {
  const sp = await searchParams;
  await connection(); // talks to the lock service
  const user = await requirePortal("owner", "/owner/locks");
  const configured = locksConfigured();
  const justConnected = configured ? await finishPendingConnects(user.id) : 0;
  if (configured) await refreshCodeStatuses(user.id);

  const [accounts, listings, events, upcoming] = await Promise.all([
    db.lockAccount.findMany({ where: { ownerId: user.id }, orderBy: { createdAt: "asc" }, include: { locks: { orderBy: { name: "asc" } } } }),
    db.listing.findMany({ where: { ownerId: user.id, deletedAt: null }, orderBy: { createdAt: "asc" }, select: { id: true, title: true, timeZone: true, checkInTime: true, checkOutTime: true, locks: { select: { id: true } } } }),
    db.lockEvent.findMany({ where: { ownerId: user.id }, orderBy: { createdAt: "desc" }, take: 25 }),
    db.accessCode.findMany({
      where: { lock: { ownerId: user.id }, status: { not: "REMOVED" }, endsAt: { gt: new Date() } },
      orderBy: { startsAt: "asc" },
      take: 20,
      include: { lock: { select: { name: true } }, booking: { select: { id: true } }, job: { select: { id: true } } },
    }),
  ]);
  const problems = events.filter((e) => e.retryable && !e.resolvedAt);
  const error = typeof sp.error === "string" ? sp.error : null;
  const locks = accounts.flatMap((a) => a.locks);

  return (
    <PortalShell portal="Owner" user={user} nav={ownerNav("/owner/locks")}>
      <div className="flex flex-col gap-6 pt-6 sm:pt-10">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Smart locks</h1>
          <p className="max-w-2xl text-ink-muted">
            Connect your smart lock and every guest gets their own door code that works only from check-in to checkout. Cleaners and other pros you hire get a code for the day of the job. Codes are removed automatically if a booking is cancelled.
          </p>
        </div>
        {error ? <p role="alert" className="rounded-control border border-danger/30 bg-danger/5 px-4 py-3 font-medium text-danger">{error}</p> : null}
        {justConnected ? <p role="status" className="rounded-control bg-soft px-4 py-3 font-medium text-on-soft">Lock account connected. Now choose which property each lock is on.</p> : null}
        {sp.saved ? <p role="status" className="rounded-control bg-soft px-4 py-3 font-medium text-on-soft">Saved.</p> : null}

        {!configured ? (
          <Card className="flex flex-col gap-2">
            <h2 className="text-xl font-bold">Coming soon</h2>
            <p className="text-ink-muted">Smart lock connections are being set up for Keyvaga. Check back shortly.</p>
          </Card>
        ) : null}

        {problems.length ? (
          <Card className="flex flex-col gap-3 border-danger/40">
            <h2 className="text-xl font-bold text-danger">Needs attention</h2>
            <ul className="flex flex-col gap-3">
              {problems.map((e) => (
                <li key={e.id} className="flex flex-col gap-2 border-t border-line pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm">{e.message}</span>
                  <div className="flex gap-2">
                    <form action={retryLockEvent.bind(null, e.id)}><Button type="submit" variant="secondary">Retry</Button></form>
                    <form action={dismissLockEvent.bind(null, e.id)}><Button type="submit" variant="ghost">Dismiss</Button></form>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {configured ? (
          <Card className="flex flex-col items-start gap-4">
            <h2 className="text-xl font-bold">Lock accounts</h2>
            {accounts.length === 0 ? (
              <p className="text-ink-muted">
                Sign in to your lock brand&apos;s account (the same one you use in its app) to connect your locks. Works with {BRANDS.join(", ")} and more.
              </p>
            ) : (
              <ul className="flex w-full flex-col gap-3">
                {accounts.map((a) => (
                  <li key={a.id} className="flex flex-col gap-2 border-t border-line pt-3 first:border-0 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      <span className="font-semibold">{a.provider}</span>
                      {a.label ? <span className="text-ink-muted"> · {a.label}</span> : null}
                      <span className="text-ink-muted"> · {a.locks.length} lock{a.locks.length === 1 ? "" : "s"}</span>
                    </span>
                    <form action={disconnectLockAccount.bind(null, a.id)}>
                      <Button type="submit" variant="ghost" className="text-danger">Disconnect</Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-3">
              <form action={connectLockAccount}><Button type="submit">{accounts.length ? "Connect another account" : "Connect a lock"}</Button></form>
              {accounts.length ? <form action={refreshLocks}><Button type="submit" variant="secondary">Refresh locks</Button></form> : null}
            </div>
          </Card>
        ) : null}

        {locks.length ? (
          <Card className="flex flex-col gap-4">
            <h2 className="text-xl font-bold">Your locks</h2>
            <ul className="flex flex-col gap-5">
              {locks.map((l) => (
                <li key={l.id} className="flex flex-col gap-3 border-t border-line pt-4 first:border-0 first:pt-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-semibold">{l.name}</span>
                    <span className="text-sm text-ink-muted">{l.provider}</span>
                    {l.online ? <Chip>Online</Chip> : <Chip tone="warn">Offline</Chip>}
                  </div>
                  <form action={saveLockSettings.bind(null, l.id)} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                    <label className="flex flex-col gap-1 text-sm font-medium">
                      Property
                      <select name="listingId" defaultValue={l.listingId ?? ""} className={inputClass}>
                        <option value="">Not used for Keyvaga</option>
                        {listings.map((x) => (
                          <option key={x.id} value={x.id}>{x.title}</option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-sm font-medium">
                      Backup code (optional)
                      <input name="backupCode" defaultValue={l.backupCode ?? ""} inputMode="numeric" pattern="\d{4,10}" placeholder="e.g. a code you set in the lock's app" className={inputClass} />
                    </label>
                    <Button type="submit" variant="secondary">Save</Button>
                  </form>
                  <p className="text-xs text-ink-muted">The backup code is shown to a booked guest only if their own code couldn&apos;t be added or the lock is offline.</p>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {listings.some((x) => x.locks.length) ? (
          <Card className="flex flex-col gap-4">
            <h2 className="text-xl font-bold">Code times</h2>
            <p className="text-sm text-ink-muted">Guest codes start at your check-in time and stop at your checkout time, in the property&apos;s time zone. Service codes work 7 AM–9 PM on the job day. Changes apply to codes created from now on.</p>
            <ul className="flex flex-col gap-3">
              {listings.filter((x) => x.locks.length).map((x) => (
                <li key={x.id} className="flex flex-col gap-2 border-t border-line pt-3 first:border-0 first:pt-0 sm:flex-row sm:items-end sm:justify-between">
                  <span>
                    <span className="font-semibold">{x.title}</span>
                    <span className="block text-sm text-ink-muted">Check-in {x.checkInTime} · checkout {x.checkOutTime} (change these on the listing)</span>
                  </span>
                  <form action={setListingTimeZone.bind(null, x.id)} className="flex items-end gap-2">
                    <label className="flex flex-col gap-1 text-sm font-medium">
                      Time zone
                      <select name="timeZone" defaultValue={x.timeZone} className={inputClass}>
                        {US_TIME_ZONES.map((t) => (
                          <option key={t.id} value={t.id}>{t.label}</option>
                        ))}
                      </select>
                    </label>
                    <Button type="submit" variant="secondary">Save</Button>
                  </form>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {upcoming.length ? (
          <Card className="flex flex-col gap-3">
            <h2 className="text-xl font-bold">Upcoming codes</h2>
            <ul className="flex flex-col gap-2 text-sm">
              {upcoming.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2 first:border-0 first:pt-0">
                  <span>
                    <a href={c.booking ? `/owner/bookings/${c.booking.id}` : c.job ? `/owner/jobs/${c.job.id}` : "#"} className="font-semibold underline underline-offset-4">{c.name}</a>
                    {" "}on {c.lock.name} · {when.format(c.startsAt)} → {when.format(c.endsAt)}
                  </span>
                  <span className={c.status === "FAILED" ? "font-semibold text-danger" : "text-ink-muted"}>
                    {c.status === "SET" ? "Ready on lock" : c.status === "SETTING" ? "Scheduled" : "Couldn't add"}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {events.length ? (
          <Card className="flex flex-col gap-3">
            <h2 className="text-xl font-bold">Recent activity</h2>
            <ul className="flex flex-col gap-2 text-sm">
              {events.map((e) => (
                <li key={e.id} className="flex flex-col border-t border-line pt-2 first:border-0 first:pt-0 sm:flex-row sm:justify-between sm:gap-4">
                  <span className={e.kind === "error" && !e.resolvedAt ? "text-danger" : ""}>{e.message}</span>
                  <span className="shrink-0 text-ink-muted">{when.format(e.createdAt)}</span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        <p className="text-sm text-ink-muted">
          Privacy: your lock company only receives a code name (guest first name and dates) and the times it works. Keyvaga never unlocks your door remotely.
        </p>
      </div>
    </PortalShell>
  );
}
