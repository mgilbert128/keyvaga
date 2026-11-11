"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import type { GuestResult } from "@/app/actions/guest";

export function ReviewForm({ action }: { action: (prev: GuestResult, fd: FormData) => Promise<GuestResult> }) {
  const [state, run, pending] = useActionState(action, undefined);
  if (state?.ok) return <p role="status" className="rounded-control bg-soft px-4 py-3 font-medium text-on-soft">{state.message}</p>;
  return (
    <form action={run} className="flex flex-col gap-4">
      <fieldset>
        <legend className="mb-2 font-semibold">How was your stay?</legend>
        <div className="flex flex-row-reverse justify-end gap-1">
          {[5, 4, 3, 2, 1].map((n) => (
            <label key={n} className="peer flex h-11 w-11 cursor-pointer items-center justify-center rounded-control text-3xl text-line-strong hover:text-brand has-[:checked]:text-brand peer-hover:text-brand [&:has(~label_:checked)]:text-brand">
              <input type="radio" name="rating" value={n} className="sr-only" required />
              <span aria-hidden="true">★</span>
              <span className="sr-only">{n} star{n === 1 ? "" : "s"}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col gap-2">
        <label htmlFor="review-body" className="font-semibold">Your review</label>
        <textarea id="review-body" name="body" rows={4} minLength={10} maxLength={2000} required className="block min-h-28 w-full rounded-control border border-line-strong bg-surface px-4 py-3 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30" placeholder="What did you love? Anything future guests should know?" />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Posting…" : "Post review"}</Button>
        {state?.message ? <p role="alert" className="text-sm font-medium text-danger">{state.message}</p> : null}
      </div>
    </form>
  );
}
