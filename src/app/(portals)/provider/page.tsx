import { Suspense } from "react";
import type { Metadata } from "next";
import { requirePortal } from "@/lib/auth/dal";
import { PortalShell, ComingSoon } from "@/components/layout/PortalShell";

export const metadata: Metadata = { title: "Your jobs" };

const NAV = [{ label: "My jobs", href: "/provider", current: true }];

export default function Page() {
  return (
    <Suspense fallback={<div className="h-screen" aria-hidden="true" />}>
      <Portal />
    </Suspense>
  );
}

async function Portal() {
  const user = await requirePortal("provider", "/provider");
  return (
    <PortalShell portal={"Services"} user={user} nav={NAV}>
      <div className="flex flex-col gap-6 pt-6 sm:pt-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Your jobs</h1>
        <p className="text-ink-muted">Signed in as {user.name}.</p>
        <ComingSoon items={["Business profile, services and service area", "Job inbox and quote builder", "Schedule and completed jobs", "Payouts"]} />
      </div>
    </PortalShell>
  );
}
