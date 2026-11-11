"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";

type Result = { ok?: boolean; message?: string } | undefined;

/** Small form wrapper: runs a server action and shows its success or error message. */
export function ActionForm({
  action,
  submitLabel,
  children,
  className = "flex flex-col gap-4",
  resetOnSuccess = false,
}: {
  action: (prev: Result, fd: FormData) => Promise<Result>;
  submitLabel: string;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, run, pending] = useActionState(action, undefined);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (resetOnSuccess && state?.ok) form.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={form} action={run} className={className}>
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : submitLabel}</Button>
        <p aria-live="polite" role={state && !state.ok ? "alert" : undefined} className={`text-sm font-medium ${state?.ok ? "text-on-soft" : "text-danger"}`}>{state?.message}</p>
      </div>
    </form>
  );
}
