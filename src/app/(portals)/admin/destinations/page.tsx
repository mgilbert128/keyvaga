import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { requirePortal } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { listDestinations } from "@/lib/destinations";
import { saveDestinationIntro } from "@/app/actions/destinations";
import { PortalShell } from "@/components/layout/PortalShell";
import { adminNav } from "@/components/layout/portal-nav";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";

export const metadata: Metadata = { title: "Destination pages" };

export default function Page() {
  return (
    <Suspense fallback={<div className="h-screen" aria-hidden="true" />}>
      <Destinations />
    </Suspense>
  );
}

async function Destinations() {
  await connection();
  const user = await requirePortal("admin", "/admin/destinations");
  const [list, content] = await Promise.all([listDestinations(), db.destinationContent.findMany()]);
  const intros = new Map(content.map((c) => [c.slug, c.intro]));
  return (
    <PortalShell portal="Admin" user={user} nav={adminNav("/admin/destinations")}>
      <div className="flex flex-col gap-6 pt-6 sm:pt-10">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Destination pages</h1>
          <p className="max-w-3xl text-ink-muted">
            A short introduction on each town&apos;s page helps travelers decide and helps Google rank the page. Aim for 2–4 short paragraphs:
            what the area is known for, things to do, the best time to visit, and the kinds of stays on Keyvaga. Leave a blank line between paragraphs.
          </p>
        </div>
        {list.length === 0 ? <Card><p className="text-ink-muted">Destinations appear here once stays are published.</p></Card> : (
          <ul className="flex flex-col gap-4">
            {list.map((d) => (
              <li key={d.slug}>
                <Card className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-xl font-bold">{d.label}</h2>
                    <a href={`/destinations/${d.slug}`} target="_blank" className="text-sm font-semibold text-brand underline underline-offset-4">View page</a>
                  </div>
                  <form action={saveDestinationIntro.bind(null, d.slug)} className="flex flex-col gap-3">
                    <label htmlFor={`intro-${d.slug}`} className="sr-only">Introduction for {d.label}</label>
                    <textarea id={`intro-${d.slug}`} name="intro" rows={7} maxLength={4000} defaultValue={intros.get(d.slug) ?? ""} className={inputClass} placeholder={`What makes ${d.city} special for a getaway…`} />
                    <Button type="submit" className="self-start">Save</Button>
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
