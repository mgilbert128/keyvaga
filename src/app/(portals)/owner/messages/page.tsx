import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { requirePortal } from "@/lib/auth/dal";
import { listThreads } from "@/lib/messages";
import { PortalShell } from "@/components/layout/PortalShell";
import { ownerNav } from "@/components/layout/portal-nav";
import { Inbox } from "@/components/messages/Inbox";

export const metadata: Metadata = { title: "Messages" };

export default function Page() {
  return (
    <Suspense fallback={<div className="h-screen" aria-hidden="true" />}>
      <Messages />
    </Suspense>
  );
}

async function Messages() {
  await connection();
  const user = await requirePortal("owner", "/owner/messages");
  const threads = await listThreads(user.id, "owner");
  return (
    <PortalShell portal="Owner" user={user} nav={ownerNav("/owner/messages")}>
      <div className="flex flex-col gap-6 pt-6 sm:pt-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Messages</h1>
        <Inbox threads={threads} base="/owner/messages" />
      </div>
    </PortalShell>
  );
}
