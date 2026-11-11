"use client";

import { useActionState } from "react";
import { ownerListingAction } from "@/app/actions/listings";
import { Button } from "@/components/ui/Button";
import type { OwnerAction } from "@/lib/listing-policy";

const LABELS: Partial<Record<OwnerAction, string>> = {
  withdraw: "Withdraw from review",
  pause: "Pause listing",
  unpause: "Unpause listing",
};

export function StatusActions({ id, actions }: { id: string; actions: OwnerAction[] }) {
  const [state, run, pending] = useActionState(
    async (_prev: Awaited<ReturnType<typeof ownerListingAction>>, formData: FormData) =>
      ownerListingAction(id, formData.get("action") as OwnerAction),
    undefined,
  );
  if (actions.length === 0) return null;
  return (
    <form action={run} className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <Button key={a} type="submit" name="action" value={a} variant="secondary" disabled={pending}>
            {LABELS[a] ?? a}
          </Button>
        ))}
      </div>
      <p aria-live="polite" className={`text-sm ${state?.ok ? "text-on-soft" : "text-danger"}`}>{state?.message}</p>
    </form>
  );
}
