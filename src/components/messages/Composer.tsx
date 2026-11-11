"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import type { SendResult } from "@/app/actions/messages";

export function Composer({ action }: { action: (prev: SendResult, fd: FormData) => Promise<SendResult> }) {
  const [state, run, pending] = useActionState(action, undefined);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);
  return (
    <form ref={form} action={run} className="flex flex-col gap-3">
      <label htmlFor="body" className="sr-only">Message</label>
      <textarea
        id="body"
        name="body"
        rows={3}
        maxLength={4000}
        required
        placeholder="Write a message…"
        className="block min-h-24 w-full rounded-control border border-line-strong bg-surface px-4 py-3 text-base focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
      />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Sending…" : "Send"}</Button>
        {state?.message ? <p role="alert" className="text-sm font-medium text-danger">{state.message}</p> : null}
      </div>
    </form>
  );
}
