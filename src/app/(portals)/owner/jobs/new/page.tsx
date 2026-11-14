import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { requirePortal } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { SERVICE_CATEGORIES, isServiceCategory, categoryNoun } from "@/lib/services";
import { addDays, parseISODate, todayIn, toISODate } from "@/lib/dates";
import { createJobAction } from "@/app/actions/jobs";
import { PortalShell } from "@/components/layout/PortalShell";
import { ownerNav } from "@/components/layout/portal-nav";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { SelectField, TextAreaField } from "@/components/ui/Select";
import { ActionForm } from "@/components/owner/ActionForm";

export const metadata: Metadata = { title: "Request a quote" };
const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export default function Page({ searchParams }: PageProps<"/owner/jobs/new">) {
  return (
    <Suspense fallback={<div className="h-screen" aria-hidden="true" />}>
      <NewJob searchParams={searchParams} />
    </Suspense>
  );
}

async function NewJob({ searchParams }: { searchParams: PageProps<"/owner/jobs/new">["searchParams"] }) {
  const sp = await searchParams;
  await connection();
  const user = await requirePortal("owner", "/owner/jobs/new");
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const listings = await db.listing.findMany({ where: { ownerId: user.id }, orderBy: { createdAt: "asc" }, select: { id: true, title: true } });
  const provider = str("provider") ? await db.providerProfile.findFirst({ where: { id: str("provider"), status: "APPROVED" }, select: { id: true, businessName: true, categories: true } }) : null;
  const category = isServiceCategory(str("category")) ? str("category") : isServiceCategory(str("need")) ? str("need") : provider?.categories[0] ?? "cleaning";
  const date = parseISODate(str("date"));
  const listingId = listings.some((l) => l.id === str("listing")) ? str("listing") : listings[0]?.id;
  // Turnover cleans: link to the booking that checks out on that date.
  const booking = date && listingId ? await db.booking.findFirst({ where: { listingId, status: "CONFIRMED", checkOut: date }, select: { id: true, checkOut: true } }) : null;
  const title = category === "cleaning" && booking ? `Turnover cleaning after checkout ${fmt.format(booking.checkOut)}` : categoryNoun(category);

  return (
    <PortalShell portal="Owner" user={user} nav={ownerNav("/owner/jobs")}>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 pt-6 sm:pt-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{provider ? `Request a quote from ${provider.businessName}` : "Post a job"}</h1>
        <p className="text-ink-muted">{provider ? "They'll reply with a price and date. You only pay if you accept." : "Pros who serve your property's area will send quotes. Compare them and pick one. You only pay when you accept."}</p>
        {listings.length === 0 ? <p className="text-ink-muted">Add a property first.</p> : (
          <Card>
            <ActionForm action={createJobAction} submitLabel={provider ? "Send request" : "Post job"}>
              {provider ? <input type="hidden" name="providerId" value={provider.id} /> : null}
              {booking ? <input type="hidden" name="bookingId" value={booking.id} /> : null}
              <SelectField label="Property" id="listingId" defaultValue={listingId}>
                {listings.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
              </SelectField>
              <SelectField label="What do you need?" id="category" defaultValue={category}>
                {SERVICE_CATEGORIES.filter((c) => !provider || provider.categories.includes(c.key)).map((c) => <option key={c.key} value={c.key}>{c.noun}</option>)}
              </SelectField>
              <Field label="Short title" id="title" defaultValue={title} maxLength={100} required />
              <TextAreaField label="Details" id="description" rows={5} maxLength={3000} required hint="Size of the property, what needs doing, access instructions, anything the pro should know." />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-end">
                <Field label="Preferred date" id="preferredDate" type="date" min={toISODate(todayIn())} max={toISODate(addDays(todayIn(), 365))} defaultValue={date ? toISODate(date) : undefined} />
                <label className="flex min-h-11 cursor-pointer items-center gap-3">
                  <input type="checkbox" name="flexibleDate" defaultChecked={!booking} className="h-5 w-5 accent-[var(--kv-brand)]" /> My date is flexible
                </label>
              </div>
            </ActionForm>
          </Card>
        )}
      </div>
    </PortalShell>
  );
}
