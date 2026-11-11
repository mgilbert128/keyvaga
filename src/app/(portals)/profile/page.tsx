import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { connection } from "next/server";
import { requirePortal } from "@/lib/auth/dal";
import { PortalShell } from "@/components/layout/PortalShell";
import { guestNav } from "@/components/layout/portal-nav";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { ActionForm } from "@/components/owner/ActionForm";
import { changePassword, updateProfile } from "@/app/actions/guest";

export const metadata: Metadata = { title: "Profile" };

export default function Page() {
  return (
    <Suspense fallback={<div className="h-screen" aria-hidden="true" />}>
      <Profile />
    </Suspense>
  );
}

async function Profile() {
  await connection();
  const user = await requirePortal("guest", "/profile");
  return (
    <PortalShell user={user} nav={guestNav("/profile")}>
      <div className="flex max-w-2xl flex-col gap-6 pt-6 sm:pt-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Profile and settings</h1>
        <Card className="flex flex-col gap-4">
          <h2 className="text-xl font-bold">Your details</h2>
          <p className="text-ink-muted">Email: {user.email}</p>
          <ActionForm action={updateProfile} submitLabel="Save">
            <Field label="Name" id="name" defaultValue={user.name} maxLength={80} autoComplete="name" required />
          </ActionForm>
        </Card>
        <Card className="flex flex-col gap-4">
          <h2 className="text-xl font-bold">Change password</h2>
          <ActionForm action={changePassword} submitLabel="Change password" resetOnSuccess>
            <Field label="Current password" id="current" type="password" autoComplete="current-password" required />
            <Field label="New password" id="next" type="password" autoComplete="new-password" minLength={10} required hint="At least 10 characters." />
          </ActionForm>
        </Card>
        <Card className="flex flex-col gap-2">
          <h2 className="text-xl font-bold">Your portals</h2>
          <ul className="flex flex-col gap-1">
            <li><Link href="/trips" className="text-brand underline underline-offset-4">Guest: trips and messages</Link></li>
            {user.roles.includes("OWNER") ? <li><Link href="/owner" className="text-brand underline underline-offset-4">Owner portal</Link></li> : <li><Link href="/list-your-property" className="text-brand underline underline-offset-4">List a property</Link></li>}
            {user.roles.includes("PROVIDER") ? <li><Link href="/provider" className="text-brand underline underline-offset-4">Service provider portal</Link></li> : null}
          </ul>
        </Card>
      </div>
    </PortalShell>
  );
}
