"use client";

import { useActionState } from "react";
import { sendTestError, type TestErrorState } from "@/app/actions/monitoring";
import { Button } from "@/components/ui/Button";

/** "Send test error" for the admin dashboard: confirms Sentry monitoring is connected. */
export function TestErrorButton() {
  const [state, action, pending] = useActionState<TestErrorState>(sendTestError, null);
  return (
    <form action={action} className="flex flex-col items-start gap-3">
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Sending…" : "Send test error"}
      </Button>
      {state ? (
        <p role="status" className={`text-sm font-medium ${state.ok ? "text-brand" : "text-danger"}`}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
