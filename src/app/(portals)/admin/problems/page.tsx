import { Suspense } from "react";
import { ChecklistReview } from "@/components/jobs/Checklist";
import type { Metadata } from "next";
import { connection } from "next/server";
import { requirePortal } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { resolveDisputeAction } from "@/app/actions/jobs";
import { PortalShell } from "@/components/layout/PortalShell";
import { adminNav } from "@/components/layout/portal-nav";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatCents } from "@/lib/money";

export const metadata: Metadata = { title: "Reported problems" };

export default function Page() {
  return (
    <Suspense fallback={<div className="h-screen" aria-hidden="true" />}>
      <Problems />
    </Suspense>
  );
}

async function Problems() {
  await connection();
  const user = await requirePortal("admin", "/admin/problems");
  const jobs = await db.job.findMany({
    where: { status: "DISPUTED" },
    orderBy: { updatedAt: "asc" },
    include: {
      owner: { select: { name: true, email: true } },
      listing: { select: { title: true, city: true } },
      acceptedQuote: { include: { provider: { include: { user: { select: { email: true } } } } } },
      messages: { orderBy: { createdAt: "asc" }, include: { sender: { select: { name: true } } } },
      checklist: { orderBy: { position: "asc" } },
      photos: { orderBy: { createdAt: "asc" }, select: { id: true, caption: true, createdAt: true } },
    },
  });
  return (
    <PortalShell portal="Admin" user={user} nav={adminNav("/admin/problems")}>
      <div className="flex flex-col gap-6 pt-6 sm:pt-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Reported problems</h1>
        <p className="text-ink-muted">Service jobs where the owner reported a problem. Payment is held until you decide.</p>
        {jobs.length === 0 ? <p className="text-ink-muted">No open problems. 🎉</p> : jobs.map((j) => (
          <Card key={j.id} className="flex flex-col gap-3">
            <h2 className="text-xl font-bold">{j.title} · {j.listing.title} ({j.listing.city})</h2>
            <p className="text-sm text-ink-muted">
              Owner: {j.owner.name} ({j.owner.email}) · Provider: {j.acceptedQuote?.provider.businessName} ({j.acceptedQuote?.provider.user.email}) · Paid {formatCents(j.ownerTotalCents)} · provider would receive {formatCents(j.providerPayoutCents)}
            </p>
            <p className="rounded-control bg-warn-soft px-4 py-3 text-on-warn-soft"><strong>Owner says:</strong> {j.disputeNote}</p>
            {j.completionNote ? <p className="rounded-control bg-soft px-4 py-3 text-on-soft"><strong>Provider&apos;s completion note:</strong> {j.completionNote}</p> : null}
            {j.checklist.length || j.photos.length ? (
              <details>
                <summary className="min-h-11 cursor-pointer text-brand underline underline-offset-4">Checklist and photos ({j.photos.length} photo{j.photos.length === 1 ? "" : "s"})</summary>
                <div className="mt-3"><ChecklistReview items={j.checklist} photos={j.photos} minPhotos={j.minPhotos} /></div>
              </details>
            ) : null}
            {j.messages.length ? (
              <details>
                <summary className="min-h-11 cursor-pointer text-brand underline underline-offset-4">Messages ({j.messages.length})</summary>
                <ol className="mt-2 flex flex-col gap-2 text-sm">{j.messages.map((m) => <li key={m.id}><strong>{m.sender.name}:</strong> {m.body}</li>)}</ol>
              </details>
            ) : null}
            <div className="flex flex-wrap gap-3 border-t border-line pt-3">
              <form action={resolveDisputeAction.bind(null, j.id, "pay")}><Button type="submit">Pay the provider</Button></form>
              <form action={resolveDisputeAction.bind(null, j.id, "refund")}><Button type="submit" variant="secondary">Refund the owner in full</Button></form>
            </div>
          </Card>
        ))}
      </div>
    </PortalShell>
  );
}
