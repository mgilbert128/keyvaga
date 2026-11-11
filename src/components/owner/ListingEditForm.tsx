"use client";

import { useActionState } from "react";
import { updateListing } from "@/app/actions/listings";
import { Field } from "@/components/ui/Field";
import { SelectField, TextAreaField } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { PROPERTY_TYPES } from "@/lib/property-types";
import { AMENITY_GROUPS } from "@/lib/amenities";
import type { ListingFormState } from "@/lib/validation/listing";

export type EditableListing = {
  id: string;
  status: "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "PAUSED";
  title: string;
  summary: string;
  description: string;
  propertyType: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  bedrooms: number;
  bathrooms: string;
  maxGuests: number;
  nightlyRate: string;
  cleaningFee: string;
  minNights: number;
  checkInTime: string;
  checkOutTime: string;
  houseRules: string;
  amenities: string[];
};

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-5 rounded-card border border-line bg-surface p-6 sm:p-8">
      <legend className="sr-only">{title}</legend>
      <div aria-hidden="true">
        <h2 className="text-xl font-bold">{title}</h2>
        {description ? <p className="mt-1 text-ink-muted">{description}</p> : null}
      </div>
      {children}
    </fieldset>
  );
}

function Message({ state }: { state: ListingFormState }) {
  if (!state?.message) return null;
  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={`rounded-control px-4 py-3 font-medium ${state.ok ? "bg-soft text-on-soft" : "border border-danger/30 bg-danger/5 text-danger"}`}
    >
      {state.message}
    </p>
  );
}

export function ListingEditForm({ listing }: { listing: EditableListing }) {
  const [state, action, pending] = useActionState(updateListing.bind(null, listing.id), undefined);
  const e = state?.errors ?? {};
  const canSubmit = listing.status === "DRAFT";

  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      <div aria-live="polite"><Message state={state} /></div>

      <Section title="The basics" description="What guests see first in search results.">
        <Field label="Listing name" id="title" required maxLength={80} defaultValue={listing.title} error={e.title} />
        <Field label="Short summary" id="summary" maxLength={200} defaultValue={listing.summary} error={e.summary} hint="One sentence, up to 200 characters." />
        <SelectField label="Property type" id="propertyType" defaultValue={listing.propertyType} error={e.propertyType}>
          {PROPERTY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </SelectField>
        <TextAreaField label="Description" id="description" rows={6} maxLength={5000} defaultValue={listing.description} error={e.description} hint="Describe the space, the neighborhood and what makes it special." />
      </Section>

      <Section title="Location" description="Guests see only the city and state until their booking is confirmed.">
        <Field label="Street address" id="addressLine1" autoComplete="address-line1" defaultValue={listing.addressLine1} error={e.addressLine1} />
        <Field label="Apartment, unit or suite (optional)" id="addressLine2" autoComplete="address-line2" defaultValue={listing.addressLine2} error={e.addressLine2} />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <Field label="City" id="city" autoComplete="address-level2" defaultValue={listing.city} error={e.city} />
          <Field label="State" id="region" autoComplete="address-level1" defaultValue={listing.region} error={e.region} placeholder="e.g. WI" />
          <Field label="ZIP code" id="postalCode" autoComplete="postal-code" inputMode="numeric" defaultValue={listing.postalCode} error={e.postalCode} />
        </div>
      </Section>

      <Section title="Rooms and guests">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <Field label="Bedrooms" id="bedrooms" type="number" min={0} max={50} inputMode="numeric" defaultValue={listing.bedrooms} error={e.bedrooms} />
          <Field label="Bathrooms" id="bathrooms" type="number" min={0} max={50} step={0.5} inputMode="decimal" defaultValue={listing.bathrooms} error={e.bathrooms} />
          <Field label="Sleeps (max guests)" id="maxGuests" type="number" min={1} max={50} inputMode="numeric" defaultValue={listing.maxGuests} error={e.maxGuests} />
        </div>
      </Section>

      <Section title="Pricing" description="All prices are in US dollars. Seasonal rates and discounts come later.">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <Field label="Nightly rate ($)" id="nightlyRate" inputMode="decimal" placeholder="185" defaultValue={listing.nightlyRate} error={e.nightlyRate} />
          <Field label="Cleaning fee ($)" id="cleaningFee" inputMode="decimal" placeholder="95" defaultValue={listing.cleaningFee} error={e.cleaningFee} hint="Charged once per stay." />
          <Field label="Minimum stay (nights)" id="minNights" type="number" min={1} max={365} inputMode="numeric" defaultValue={listing.minNights} error={e.minNights} />
        </div>
      </Section>

      <Section title="Amenities">
        <div className="flex flex-col gap-6">
          {AMENITY_GROUPS.map((g) => (
            <fieldset key={g.label}>
              <legend className="mb-3 font-semibold">{g.label}</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {g.items.map((a) => (
                  <label key={a.key} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-control border border-line px-3 has-[:checked]:border-brand has-[:checked]:bg-soft">
                    <input type="checkbox" name="amenities" value={a.key} defaultChecked={listing.amenities.includes(a.key)} className="h-5 w-5 accent-[var(--kv-brand)]" />
                    <span>{a.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      </Section>

      <Section title="House rules and check-in">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Check-in from" id="checkInTime" type="time" defaultValue={listing.checkInTime} error={e.checkInTime} />
          <Field label="Check out by" id="checkOutTime" type="time" defaultValue={listing.checkOutTime} error={e.checkOutTime} />
        </div>
        <TextAreaField label="House rules" id="houseRules" rows={5} maxLength={3000} defaultValue={listing.houseRules} error={e.houseRules} hint="One rule per line, e.g. No smoking. Quiet hours after 10pm." />
      </Section>

      <div className="sticky bottom-0 -mx-4 flex flex-col gap-3 border-t border-line bg-bg/95 px-4 py-4 backdrop-blur sm:mx-0 sm:flex-row sm:items-center sm:justify-end sm:rounded-card sm:border sm:px-6">
        <div className="sm:mr-auto" aria-live="polite">{state?.message ? <span className="text-sm text-ink-muted">{state.message}</span> : null}</div>
        <Button type="submit" name="intent" value="save" variant={canSubmit ? "secondary" : "primary"} disabled={pending}>
          {pending ? "Saving…" : canSubmit ? "Save draft" : "Save changes"}
        </Button>
        {canSubmit ? (
          <Button type="submit" name="intent" value="submit" disabled={pending}>
            Save and submit for review
          </Button>
        ) : null}
      </div>
    </form>
  );
}
