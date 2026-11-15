"use client";

import { useActionState } from "react";
import { requestPasswordReset, resetPassword } from "@/app/actions/password-reset";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export function ForgotPasswordForm() {
  const [state, run, pending] = useActionState(requestPasswordReset, undefined);
  if (state?.ok) return <p role="status" className="rounded-control bg-soft px-4 py-3 text-on-soft">{state.message}</p>;
  return (
    <form action={run} className="flex flex-col gap-5" noValidate>
      <Field label="Email" id="email" type="email" autoComplete="email" required />
      {state?.message ? <p role="alert" className="text-sm font-medium text-danger">{state.message}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "Sending…" : "Send reset link"}</Button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, run, pending] = useActionState(resetPassword, undefined);
  return (
    <form action={run} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="token" value={token} />
      <Field label="New password" id="password" type="password" autoComplete="new-password" minLength={10} required hint="At least 10 characters." />
      {state?.message ? <p role="alert" className="text-sm font-medium text-danger">{state.message}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Set new password"}</Button>
    </form>
  );
}
