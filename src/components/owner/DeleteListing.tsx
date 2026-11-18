"use client";

import { useActionState, useState } from "react";
import type { DeleteListingState } from "@/app/actions/listings";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";

/** "Delete listing" with a typed confirmation, for when a property is sold or no longer rented. */
export function DeleteListing({ action, title }: { action: (prev: DeleteListingState, formData: FormData) => Promise<DeleteListingState>; title: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <section aria-labelledby="delete-title" className="flex flex-col gap-3 rounded-card border border-danger/40 bg-surface p-6 sm:p-8">
      <h2 id="delete-title" className="text-xl font-bold">Delete listing</h2>
      <p className="text-ink-muted">
        Sold the property or stopped renting it? Deleting removes it from Keyvaga and your account. Past bookings, payouts and reviews stay in your records.
        To take a break instead, pause the listing.
      </p>
      {!open ? (
        <Button type="button" variant="secondary" className="self-start" onClick={() => setOpen(true)}>Delete this listing…</Button>
      ) : (
        <form action={formAction} className="flex flex-col gap-3">
          <label htmlFor="confirm-delete" className="font-semibold">Type DELETE to permanently delete “{title}”</label>
          <input id="confirm-delete" name="confirm" autoComplete="off" className={`${inputClass} max-w-xs`} />
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={pending} className="inline-flex min-h-11 items-center rounded-full bg-danger px-5 font-semibold text-white disabled:opacity-60">
              {pending ? "Deleting…" : "Delete listing"}
            </button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
          {state?.message ? <p role="alert" className="text-sm font-medium text-danger">{state.message}</p> : null}
        </form>
      )}
    </section>
  );
}
