import { Suspense } from "react";
import type { Metadata } from "next";
import { requirePortal } from "@/lib/auth/dal";
import { PortalShell, ComingSoon } from "@/components/layout/PortalShell";

export const metadata: Metadata = { title: "Admin" };

const NAV = [{ label: "Overview", href: "/admin", current: true }];

export default function Page() {
  return (
    <Suspense fallback={<div className="h-screen" aria-hidden="true" />}>
      <Portal />
    </Suspense>
  );
}

async function Portal() {
  const user = await requirePortal("admin", "/admin");
  return (
    <PortalShell portal={"Admin"} user={user} nav={NAV}>
      <div className="flex flex-col gap-6 pt-6 sm:pt-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Admin</h1>
        <p className="text-ink-muted">Signed in as {user.name}.</p>
        <ComingSoon items={["Approve listings and providers", "Disputes and refunds", "Reports and audit log"]} />
      </div>
    </PortalShell>
  );
}
