import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { connection } from "next/server";
import { requirePortal } from "@/lib/auth/dal";
import { getThread, markRead } from "@/lib/messages";
import { PortalShell } from "@/components/layout/PortalShell";
import { guestNav } from "@/components/layout/portal-nav";
import { Thread } from "@/components/messages/Thread";

export const metadata: Metadata = { title: "Conversation", robots: { index: false } };

export default function Page({ params }: PageProps<"/messages/[bookingId]">) {
  return (
    <Suspense fallback={<div className="h-screen" aria-hidden="true" />}>
      <Conversation params={params} />
    </Suspense>
  );
}

async function Conversation({ params }: { params: PageProps<"/messages/[bookingId]">["params"] }) {
  const { bookingId } = await params;
  await connection();
  const user = await requirePortal("guest", `/messages/${bookingId}`);
  const b = await getThread(user, bookingId, "guest");
  if (!b) notFound();
  await markRead(b.id, "guest");
  return (
    <PortalShell user={user} nav={guestNav("/messages")}>
      <Thread
        bookingId={b.id}
        meId={user.id}
        title={b.listing.title}
        otherName={b.listing.owner.name}
        checkIn={b.checkIn}
        checkOut={b.checkOut}
        messages={b.messages}
        backHref="/messages"
        bookingHref={`/trips/${b.id}`}
        cancelled={b.status === "CANCELLED"}
      />
    </PortalShell>
  );
}
