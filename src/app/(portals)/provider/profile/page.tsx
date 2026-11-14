import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { requirePortal } from "@/lib/auth/dal";
import { getOrCreateProfile } from "@/lib/providers";
import { saveProviderProfile, setProviderPaused } from "@/app/actions/provider";
import { SERVICE_CATEGORIES } from "@/lib/services";
import { PortalShell } from "@/components/layout/PortalShell";
import { providerNav } from "@/components/layout/portal-nav";
import { Card, Chip } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { TextAreaField } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { ActionForm } from "@/components/owner/ActionForm";
import { ProviderPhotos } from "@/components/provider/ProviderPhotos";
import { SubmitProfile } from "@/components/provider/SubmitProfile";

export const metadata: Metadata = { title: "Business profile" };

const STATUS = { DRAFT: { t: "Draft", tone: "warn" }, PENDING_REVIEW: { t: "In review", tone: "warn" }, APPROVED: { t: "Live", tone: "soft" }, PAUSED: { t: "Paused", tone: "warn" } } as const;

export default function Page() {
  return (
    <Suspense fallback={<div className="h-screen" aria-hidden="true" />}>
      <Profile />
    </Suspense>
  );
}

async function Profile() {
  await connection();
  const user = await requirePortal("provider", "/provider/profile");
  const p = await getOrCreateProfile(user);
  const st = STATUS[p.status];

  return (
    <PortalShell portal="Services" user={user} nav={providerNav("/provider/profile")}>
      <div className="flex max-w-3xl flex-col gap-6 pt-6 sm:pt-10">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Business profile</h1>
          <Chip tone={st.tone}>{st.t}</Chip>
        </div>
        {p.status === "DRAFT" && p.reviewNote ? (
          <p role="note" className="rounded-control bg-warn-soft px-4 py-3 text-on-warn-soft"><strong>Changes requested:</strong> {p.reviewNote}</p>
        ) : null}
        {p.status === "PENDING_REVIEW" ? <p className="rounded-control bg-warn-soft px-4 py-3 text-on-warn-soft">Keyvaga is reviewing your profile. You can keep editing.</p> : null}
        {p.status === "APPROVED" ? <p className="rounded-control bg-soft px-4 py-3 text-on-soft">Your profile is live. Owners in your area can find you and send you jobs.</p> : null}

        <Card className="flex flex-col gap-4">
          <h2 className="text-xl font-bold">About your business</h2>
          <ActionForm action={saveProviderProfile} submitLabel="Save profile">
            <Field label="Business name" id="businessName" defaultValue={p.businessName} maxLength={80} required />
            <TextAreaField label="Description" id="bio" rows={5} maxLength={3000} defaultValue={p.bio} hint="What you do, your experience, what makes you reliable for vacation rentals." />
            <fieldset>
              <legend className="mb-3 font-semibold">Services you offer</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {SERVICE_CATEGORIES.map((c) => (
                  <label key={c.key} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-control border border-line px-3 has-[:checked]:border-brand has-[:checked]:bg-soft">
                    <input type="checkbox" name="categories" value={c.key} defaultChecked={p.categories.includes(c.key)} className="h-5 w-5 accent-[var(--kv-brand)]" />
                    {c.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_8rem]">
              <Field label="Towns and cities you serve" id="serviceAreaText" defaultValue={p.serviceAreaText} maxLength={500} placeholder="Lake Geneva, Williams Bay, Delavan" hint="Separate with commas. Leave empty to cover your whole state." />
              <Field label="State" id="region" defaultValue={p.region} maxLength={40} placeholder="WI" required />
            </div>
            <TextAreaField label="Pricing guidance" id="pricingGuidance" rows={3} maxLength={1000} defaultValue={p.pricingGuidance} hint="e.g. Turnover cleans from $120 for a 2-bedroom; handyman $65/hour, 1-hour minimum." />
            <Field label="Availability (shown on your card)" id="availabilityNote" defaultValue={p.availabilityNote} maxLength={60} placeholder="Same-day available" />
          </ActionForm>
        </Card>

        <Card className="flex flex-col gap-4">
          <h2 className="text-xl font-bold">Photos</h2>
          <ProviderPhotos photos={p.photos.map((x) => ({ id: x.id, url: x.url }))} />
        </Card>

        {p.status === "DRAFT" ? (
          <Card className="flex flex-col gap-3">
            <h2 className="text-xl font-bold">Ready to go live?</h2>
            <p className="text-ink-muted">Keyvaga reviews every provider before owners can see them. You&apos;ll need a description, at least one service, your state and a photo.</p>
            <SubmitProfile />
          </Card>
        ) : null}
        {p.status === "APPROVED" || p.status === "PAUSED" ? (
          <Card className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-ink-muted">{p.status === "PAUSED" ? "Your profile is hidden from owners." : "Going on vacation or fully booked? Pause to stop new requests."}</p>
            <form action={setProviderPaused.bind(null, p.status === "APPROVED")}><Button type="submit" variant="secondary">{p.status === "APPROVED" ? "Pause profile" : "Go live again"}</Button></form>
          </Card>
        ) : null}
      </div>
    </PortalShell>
  );
}
