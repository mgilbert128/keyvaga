"use client";

import { useActionState, useRef, useEffect } from "react";
import type { RequestFormState } from "@/app/actions/payment-requests";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

/** Owner form: ask the guest for an extra payment (parking pass, beach gear…). */
export function RequestPaymentForm({ action }: { action: (prev: RequestFormState, formData: FormData) => Promise<RequestFormState> }) {
  const [state, formAction, pending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);
  return (
    <form ref={formRef} action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr]">
      <Field label="What it's for" id="description" required maxLength={140} placeholder="Second parking pass" />
      <Field label="Amount ($)" id="amount" required inputMode="decimal" placeholder="25" />
      <label className="flex min-h-11 items-center gap-3 sm:col-span-2">
        <input type="checkbox" name="taxable" className="h-5 w-5 accent-[var(--kv-coastal)]" />
        <span>Lodging tax applies <span className="text-sm text-ink-muted">(uses your area&apos;s tax rates; ask your CPA if unsure)</span></span>
      </label>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <Button type="submit" disabled={pending} className="self-start">{pending ? "Sending…" : "Send request"}</Button>
        {state ? <p role={state.ok ? "status" : "alert"} className={`text-sm font-medium ${state.ok ? "text-brand" : "text-danger"}`}>{state.message}</p> : null}
      </div>
    </form>
  );
}
