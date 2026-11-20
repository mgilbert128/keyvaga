"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";

type State = { ok?: boolean; message?: string } | undefined;

/** Owner booking page: release the security deposit, or charge some or all of it with a reason. */
export function DepositPanel({ release, charge, maxDollars }: { release: (prev: State) => Promise<State>; charge: (prev: State, fd: FormData) => Promise<State>; maxDollars: string }) {
  const [relState, doRelease, releasing] = useActionState(release, undefined);
  const [chState, doCharge, charging] = useActionState(charge, undefined);
  const state = chState ?? relState;
  return (
    <div className="flex flex-col gap-4">
      <form action={doRelease}>
        <Button type="submit" disabled={releasing || charging}>{releasing ? "Releasing…" : "Release full deposit"}</Button>
      </form>
      <details className="rounded-control border border-line p-4">
        <summary className="cursor-pointer font-semibold">Charge for damage</summary>
        <form action={doCharge} className="mt-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="dep-amount" className="text-sm font-semibold">Amount to charge ($, up to {maxDollars})</label>
            <input id="dep-amount" name="amount" inputMode="decimal" required placeholder="150" className={`${inputClass} w-40`} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="dep-reason" className="text-sm font-semibold">What it&apos;s for (the guest sees this)</label>
            <textarea id="dep-reason" name="reason" required minLength={10} maxLength={1000} rows={3} className={inputClass} placeholder="Broken patio chair, replacement cost $150 (receipt available)." />
          </div>
          <p className="text-sm text-ink-muted">Keep photos and receipts in case the guest disputes the charge. The rest of the hold is released automatically.</p>
          <Button type="submit" variant="secondary" disabled={releasing || charging} className="self-start">{charging ? "Charging…" : "Charge deposit"}</Button>
        </form>
      </details>
      {state?.message ? <p role={state.ok ? "status" : "alert"} className={`font-medium ${state.ok ? "text-on-soft" : "text-danger"}`}>{state.message}</p> : null}
    </div>
  );
}
