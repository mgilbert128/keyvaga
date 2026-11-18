import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { requirePortal } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { setWaitlistContacted } from "@/app/actions/waitlist";
import { PortalShell } from "@/components/layout/PortalShell";
import { adminNav } from "@/components/layout/portal-nav";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { softLaunch } from "@/lib/launch";

export const metadata: Metadata = { title: "Owner waitlist" };

export default function Page() {
  return (
    <Suspense fallback={<div className="h-screen" aria-hidden="true" />}>
      <Waitlist />
    </Suspense>
  );
}

const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago" });

async function Waitlist() {
  await connection();
  const user = await requirePortal("admin", "/admin/waitlist");
  const entries = await db.ownerWaitlist.findMany({ orderBy: { createdAt: "desc" }, take: 500 });
  const properties = entries.reduce((n, e) => n + e.propertyCount, 0);
  return (
    <PortalShell portal="Admin" user={user} nav={adminNav("/admin/waitlist")}>
      <div className="flex flex-col gap-6 pt-6 sm:pt-10">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Owner waitlist</h1>
          <p className="text-ink-muted">
            {entries.length} {entries.length === 1 ? "owner" : "owners"} · {properties} {properties === 1 ? "property" : "properties"}.{" "}
            {softLaunch()
              ? "New owners join this list instead of adding listings. To let someone in now, add their email to OWNER_INVITES in Vercel."
              : "The waitlist is off: anyone can sign up and add listings."}
          </p>
        </div>
        {entries.length === 0 ? (
          <Card><p className="text-ink-muted">No one yet.</p></Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {entries.map((e) => (
              <li key={e.id}>
                <Card className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="text-lg font-semibold">
                      {e.name}{e.company ? <span className="font-normal text-ink-muted"> · {e.company}</span> : null}
                    </p>
                    <p className="break-words text-sm">
                      <a className="font-medium text-brand underline" href={`mailto:${e.email}`}>{e.email}</a>
                      {e.phone ? <> · <a className="underline" href={`tel:${e.phone}`}>{e.phone}</a></> : null}
                    </p>
                    <p className="text-sm text-ink-muted">
                      {e.propertyCount} {e.propertyCount === 1 ? "property" : "properties"}
                      {e.locations ? ` · ${e.locations}` : ""}{e.software ? ` · uses ${e.software}` : ""} · joined {fmt(e.createdAt)}
                    </p>
                    {e.notes ? <p className="text-sm">{e.notes}</p> : null}
                  </div>
                  <form action={setWaitlistContacted} className="flex shrink-0 items-center gap-3">
                    <input type="hidden" name="id" value={e.id} />
                    <input type="hidden" name="contacted" value={e.contactedAt ? "0" : "1"} />
                    {e.contactedAt ? <span className="text-sm font-semibold text-evergreen">Contacted {fmt(e.contactedAt)}</span> : null}
                    <Button type="submit" variant="secondary">{e.contactedAt ? "Undo" : "Mark contacted"}</Button>
                  </form>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PortalShell>
  );
}
