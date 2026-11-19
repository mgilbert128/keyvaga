"use client";

import { useActionState, useState } from "react";
import { buttonClass } from "@/components/ui/Button";
import type { CancelState } from "@/app/actions/bookings";

/** Owner's answer to a request to book: accept charges the guest; decline (confirmed first) releases the card hold. */
export function RequestDecision({ accept, decline, guestFirst }: { accept: () => Promise<CancelState>; decline: () => Promise<CancelState>; guestFirst: string }) {
  const [confirmDecline, setConfirmDecline] = useState(false);
  const [acceptState, runAccept, accepting] = useActionState(async () => accept(), undefined);
  const [declineState, runDecline, declining] = useActionState(async () => decline(), undefined);
  const done = acceptState?.ok ? acceptState : declineState?.ok ? declineState : null;
  if (done) return <p role="status" className="rounded-control bg-soft px-4 py-3 font-medium text-on-soft">{done.message}</p>;
  const error = acceptState?.message ?? declineState?.message;
  const busy = accepting || declining;
  return (
    <div className="flex flex-col items-start gap-3">
      {!confirmDecline ? (
        <div className="flex flex-wrap gap-3">
          <form action={runAccept}>
            <button type="submit" disabled={busy} className={buttonClass("primary")}>{accepting ? "Accepting…" : "Accept request"}</button>
          </form>
          <button type="button" disabled={busy} onClick={() => setConfirmDecline(true)} className={buttonClass("secondary")}>Decline</button>
        </div>
      ) : (
        <form action={runDecline} className="flex w-full flex-col gap-3 rounded-control border border-line bg-soft p-4">
          <p className="font-semibold">Decline {guestFirst}&apos;s request?</p>
          <p>Their card hold is released and the dates open up again. They aren&apos;t charged.</p>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy} className={buttonClass("primary")}>{declining ? "Declining…" : "Yes, decline"}</button>
            <button type="button" onClick={() => setConfirmDecline(false)} className={buttonClass("ghost")}>Go back</button>
          </div>
        </form>
      )}
      {error && !acceptState?.ok && !declineState?.ok ? <p role="alert" className="font-medium text-danger">{error}</p> : null}
    </div>
  );
}
