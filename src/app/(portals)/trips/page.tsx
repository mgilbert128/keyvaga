import { Suspense } from "react";
import type { Metadata } from "next";
import { requirePortal } from "@/lib/auth/dal";
import { PortalShell, ComingSoon } from "@/components/layout/PortalShell";

export const metadata: Metadata = { title: "Your trips" };

const NAV = [{ label: "Trips", href: "/trips", current: true }, { label: "Stays", href: "/search" }];

export default function Page() {
  return (
    <Suspense fallback={<div className="h-screen" aria-hidden="true" />}>
      <Portal />
    </Suspense>
  );
}

async function Portal() {
  const user = await requirePortal("guest", "/trips");
  return (
    <PortalShell portal={undefined} user={user} nav={NAV}>
      <div className="flex flex-col gap-6 pt-6 sm:pt-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Your trips</h1>
        <p className="text-ink-muted">Signed in as {user.name}.</p>
        <ComingSoon items={["Upcoming and past stays with check-in details", "Payments and receipts", "Before you arrive: ID verification and house rules", "Messages with your host", "Saved stays and reviews"]} />
      </div>
    </PortalShell>
  );
}
