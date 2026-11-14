import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { connection } from "next/server";
import { requirePortal } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { triggerSummary, type Trigger } from "@/lib/auto-messages";
import { addSuggestedTemplates, deleteTemplate, toggleTemplate } from "@/app/actions/auto-messages";
import { PortalShell } from "@/components/layout/PortalShell";
import { ownerNav } from "@/components/layout/portal-nav";
import { MessagesTabs } from "@/components/automessages/MessagesTabs";
import { Card, Chip } from "@/components/ui/Card";
import { Button, ButtonLink, buttonClass } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Automated messages" };

export default function Page({ searchParams }: PageProps<"/owner/messages/automated">) {
  return (
    <Suspense fallback={<div className="h-screen" aria-hidden="true" />}>
      <Automated searchParams={searchParams} />
    </Suspense>
  );
}

const ORDER: Trigger[] = ["BOOKING_CONFIRMED", "BEFORE_CHECKIN", "CHECKIN_DAY", "BEFORE_CHECKOUT", "AFTER_CHECKOUT"];

async function Automated({ searchParams }: { searchParams: PageProps<"/owner/messages/automated">["searchParams"] }) {
  const sp = await searchParams;
  await connection();
  const user = await requirePortal("owner", "/owner/messages/automated");
  const templates = await db.messageTemplate.findMany({ where: { ownerId: user.id }, include: { listing: { select: { title: true } }, _count: { select: { logs: true } } } });
  templates.sort((a, b) => ORDER.indexOf(a.trigger) - ORDER.indexOf(b.trigger) || (a.trigger === "AFTER_CHECKOUT" ? a.offsetDays - b.offsetDays : b.offsetDays - a.offsetDays));

  return (
    <PortalShell portal="Owner" user={user} nav={ownerNav("/owner/messages")}>
      <div className="flex flex-col gap-6 pt-6 sm:pt-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Messages</h1>
        <MessagesTabs current="automated" />
        {sp.saved ? <p role="status" className="rounded-control bg-soft px-4 py-3 font-medium text-on-soft">Saved. It will be sent to every matching booking.</p> : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-2xl text-ink-muted">Set up messages once and Keyvaga sends them to every guest at the right time, from thanking them for booking to asking for a review. Scheduled messages go out each morning; booking confirmations go out right away.</p>
          <ButtonLink href="/owner/messages/automated/new">New message</ButtonLink>
        </div>

        {templates.length === 0 ? (
          <Card className="flex flex-col items-start gap-3">
            <h2 className="text-xl font-bold">Start with our suggested messages</h2>
            <p className="text-ink-muted">Five ready-to-edit messages: thanks for booking, check-in details (7 days before), welcome, checkout reminder and a thank-you with a review request.</p>
            <form action={addSuggestedTemplates}><Button type="submit">Add suggested messages</Button></form>
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {templates.map((t) => (
              <li key={t.id} className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/owner/messages/automated/${t.id}`} className="text-lg font-bold hover:underline">{t.name}</Link>
                    <Chip tone={t.enabled ? "soft" : "warn"}>{t.enabled ? "On" : "Off"}</Chip>
                  </div>
                  <p className="text-sm text-ink-muted">{triggerSummary(t.trigger, t.offsetDays)} · {t.listing ? t.listing.title : "All listings"} · sent {t._count.logs} time{t._count.logs === 1 ? "" : "s"}</p>
                  <p className="line-clamp-2 text-sm text-ink-muted">{t.body}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <form action={toggleTemplate.bind(null, t.id, !t.enabled)}><button type="submit" className={buttonClass("secondary")}>{t.enabled ? "Turn off" : "Turn on"}</button></form>
                  <Link href={`/owner/messages/automated/${t.id}`} className={buttonClass("ghost")}>Edit</Link>
                  <form action={deleteTemplate.bind(null, t.id)}><button type="submit" className={buttonClass("ghost", "text-danger")} aria-label={`Delete ${t.name}`}>Delete</button></form>
                </div>
              </li>
            ))}
          </ul>
        )}
        {templates.length > 0 && templates.length < 5 ? <form action={addSuggestedTemplates}><Button type="submit" variant="ghost">Add any missing suggested messages</Button></form> : null}
      </div>
    </PortalShell>
  );
}
