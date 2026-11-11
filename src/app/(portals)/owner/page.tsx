import { Suspense } from "react";
import type { Metadata } from "next";
import { requirePortal } from "@/lib/auth/dal";
import { PortalShell, ComingSoon } from "@/components/layout/PortalShell";

export const metadata: Metadata = { title: "Welcome back" };

const NAV = [{ label: "Overview", href: "/owner", current: true }, { label: "Find services", href: "/services" }];

export default function Page() {
  return (
    <Suspense fallback={<div className="h-screen" aria-hidden="true" />}>
      <Portal />
    </Suspense>
  );
}

async function Portal() {
  const user = await requirePortal("owner", "/owner");
  return (
    <PortalShell portal={"Owner"} user={user} nav={NAV}>
      <div className="flex flex-col gap-6 pt-6 sm:pt-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Welcome back</h1>
        <p className="text-ink-muted">Signed in as {user.name}.</p>
        <ComingSoon items={["Earnings, occupancy and upcoming stays", "Listings, calendar and pricing", "Bookings, messages and payouts", "Needs attention, with shortcuts to book a cleaner", "Connections: Hospitable, calendar feeds, PriceLabs and door locks"]} />
      </div>
    </PortalShell>
  );
}
