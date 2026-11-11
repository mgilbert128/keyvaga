import { Suspense } from "react";
import type { Metadata } from "next";
import { requirePortal } from "@/lib/auth/dal";
import { PortalShell } from "@/components/layout/PortalShell";
import { ownerNav } from "@/components/layout/portal-nav";
import { Card } from "@/components/ui/Card";
import { NewListingForm } from "@/components/owner/NewListingForm";

export const metadata: Metadata = { title: "Add a listing" };

export default function Page() {
  return (
    <Suspense fallback={<div className="h-screen" aria-hidden="true" />}>
      <NewListing />
    </Suspense>
  );
}

async function NewListing() {
  const user = await requirePortal("owner", "/owner/listings/new");
  return (
    <PortalShell portal="Owner" user={user} nav={ownerNav("/owner/listings")}>
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 pt-6 sm:pt-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Add a listing</h1>
        <p className="text-ink-muted">Start with a name and type. Next you&apos;ll add the address, photos, pricing and more.</p>
        <Card>
          <NewListingForm />
        </Card>
      </div>
    </PortalShell>
  );
}
