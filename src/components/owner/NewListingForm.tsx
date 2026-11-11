"use client";

import { useActionState } from "react";
import { createListing } from "@/app/actions/listings";
import { Field } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { PROPERTY_TYPES } from "@/lib/property-types";

export function NewListingForm() {
  const [state, action, pending] = useActionState(createListing, undefined);
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <Field label="Listing name" id="title" required maxLength={80} placeholder="e.g. Lakeside Cabin" error={state?.errors?.title} />
      <SelectField label="Property type" id="propertyType" defaultValue="HOUSE" error={state?.errors?.propertyType}>
        {PROPERTY_TYPES.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </SelectField>
      <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Continue"}</Button>
    </form>
  );
}
