"use client";

import { useActionState } from "react";
import { submitProviderProfile } from "@/app/actions/provider";
import { Button } from "@/components/ui/Button";

export function SubmitProfile() {
  const [state, run, pending] = useActionState(async () => submitProviderProfile(), undefined);
  return (
    <form action={run} className="flex flex-col items-start gap-2">
      <Button type="submit" disabled={pending}>{pending ? "Submitting…" : "Submit profile for review"}</Button>
      {state?.message ? <p role={state.ok ? "status" : "alert"} className={`text-sm font-medium ${state.ok ? "text-on-soft" : "text-danger"}`}>{state.message}</p> : null}
    </form>
  );
}
