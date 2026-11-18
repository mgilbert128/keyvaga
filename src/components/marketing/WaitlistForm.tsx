"use client";

import { useActionState } from "react";
import { joinWaitlist, type WaitlistState } from "@/app/actions/waitlist";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

/** Owner waitlist form for the soft launch. */
export function WaitlistForm() {
  const [state, action, pending] = useActionState<WaitlistState, FormData>(joinWaitlist, null);
  if (state?.ok) return <p role="status" className="rounded-control bg-soft px-4 py-3 text-lg font-semibold text-on-soft">{state.message}</p>;
  return (
    <form action={action} className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Field label="Your name" id="name" required autoComplete="name" />
      <Field label="Email" id="email" type="email" required autoComplete="email" />
      <Field label="Phone (optional)" id="phone" type="tel" autoComplete="tel" />
      <Field label="Company (optional)" id="company" autoComplete="organization" />
      <Field label="How many properties?" id="propertyCount" type="number" min={1} defaultValue="1" inputMode="numeric" />
      <Field label="Where are they?" id="locations" placeholder="Gulf Shores, AL · Lake of the Ozarks, MO" />
      <Field label="Software you use (optional)" id="software" placeholder="Hospitable, OwnerRez, Airbnb only…" />
      <Field label="Anything else? (optional)" id="notes" />
      {/* Hidden from people; bots that fill it are ignored. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="flex flex-col gap-2 md:col-span-2">
        <Button type="submit" disabled={pending} className="self-start">{pending ? "Joining…" : "Join the waitlist"}</Button>
        {state && !state.ok ? <p role="alert" className="text-sm font-medium text-danger">{state.message}</p> : null}
      </div>
    </form>
  );
}
