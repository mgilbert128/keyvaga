"use client";

import { useActionState, useState } from "react";
import { buttonClass } from "@/components/ui/Button";
import type { CancelState } from "@/app/actions/bookings";

/** Two-step cancel: shows exactly what will be refunded before the guest or owner confirms. */
export function CancelBooking({ action, preview, label = "Cancel booking" }: { action: () => Promise<CancelState>; preview: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [state, run, pending] = useActionState(async () => action(), undefined);
  if (state?.ok) return <p role="status" className="rounded-control bg-soft px-4 py-3 font-medium text-on-soft">{state.message}</p>;
  return (
    <div className="flex flex-col items-start gap-3">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className={buttonClass("secondary", "border-danger text-danger hover:bg-danger/5")}>{label}</button>
      ) : (
        <form action={run} className="flex w-full flex-col gap-3 rounded-control border border-danger/30 bg-danger/5 p-4">
          <p className="font-semibold">Are you sure?</p>
          <p>{preview}</p>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={pending} className={buttonClass("primary", "bg-danger hover:bg-danger/90")}>{pending ? "Cancelling…" : "Yes, cancel"}</button>
            <button type="button" onClick={() => setOpen(false)} className={buttonClass("ghost")}>Keep booking</button>
          </div>
        </form>
      )}
      {state?.message && !state.ok ? <p role="alert" className="font-medium text-danger">{state.message}</p> : null}
    </div>
  );
}
