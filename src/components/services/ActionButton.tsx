"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";

type Result = { ok?: boolean; message?: string } | undefined;

/** One-click server action with a result message (e.g. "Release payment"). */
export function ActionButton({ action, label, variant = "primary", confirmText }: { action: () => Promise<Result>; label: string; variant?: "primary" | "secondary" | "ghost"; confirmText?: string }) {
  const [state, run, pending] = useActionState(async () => action(), undefined);
  if (state?.ok) return <p role="status" className="rounded-control bg-soft px-4 py-3 font-medium text-on-soft">{state.message}</p>;
  return (
    <form action={run} onSubmit={(e) => { if (confirmText && !confirm(confirmText)) e.preventDefault(); }} className="flex flex-col items-start gap-2">
      <Button type="submit" variant={variant} disabled={pending}>{pending ? "Working…" : label}</Button>
      {state?.message ? <p role="alert" className="text-sm font-medium text-danger">{state.message}</p> : null}
    </form>
  );
}
