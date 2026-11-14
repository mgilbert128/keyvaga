import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { connection } from "next/server";
import { requirePortal } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { saveTemplate } from "@/app/actions/auto-messages";
import { previewSample } from "@/lib/auto-message-sample";
import { PortalShell } from "@/components/layout/PortalShell";
import { ownerNav } from "@/components/layout/portal-nav";
import { TemplateEditor } from "@/components/automessages/TemplateEditor";

export const metadata: Metadata = { title: "Automated message" };

export default function Page({ params }: PageProps<"/owner/messages/automated/[id]">) {
  return (
    <Suspense fallback={<div className="h-screen" aria-hidden="true" />}>
      <Edit params={params} />
    </Suspense>
  );
}

async function Edit({ params }: { params: PageProps<"/owner/messages/automated/[id]">["params"] }) {
  const { id } = await params;
  await connection();
  const user = await requirePortal("owner", `/owner/messages/automated/${id}`);
  const template = id === "new" ? null : await db.messageTemplate.findFirst({ where: { id, ownerId: user.id } });
  if (id !== "new" && !template) notFound();
  const [listings, sample] = await Promise.all([
    db.listing.findMany({ where: { ownerId: user.id }, orderBy: { createdAt: "asc" }, select: { id: true, title: true } }),
    previewSample(user.id),
  ]);
  return (
    <PortalShell portal="Owner" user={user} nav={ownerNav("/owner/messages")}>
      <div className="flex flex-col gap-6 pt-6 sm:pt-10">
        <Link href="/owner/messages/automated" className="inline-flex min-h-11 items-center self-start text-brand underline underline-offset-4">← Automated messages</Link>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{template ? `Edit "${template.name}"` : "New automated message"}</h1>
        <TemplateEditor
          action={saveTemplate.bind(null, template?.id ?? null)}
          listings={listings}
          initial={template ?? { name: "", trigger: "BEFORE_CHECKIN", offsetDays: 7, body: "Hi {guest_first_name}, ", listingId: null }}
          sample={sample.vars}
          sampleLabel={sample.label}
        />
      </div>
    </PortalShell>
  );
}
