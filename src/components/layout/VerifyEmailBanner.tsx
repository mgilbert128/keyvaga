"use client";

import { useActionState } from "react";
import { resendVerification } from "@/app/actions/verify-email";

/** Shown in the portals until the user confirms their email address. */
export function VerifyEmailBanner({ email }: { email: string }) {
  const [state, run, pending] = useActionState(resendVerification, undefined);
  return (
    <div role="status" className="bg-warn-soft text-on-warn-soft">
      <form action={run} className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm sm:px-8">
        <span>
          <strong>Please confirm your email.</strong> We sent a link to {email}. You&apos;ll need it to book, list a property or offer services.
        </span>
        {state?.message ? (
          <span className="font-semibold">{state.message}</span>
        ) : (
          <button type="submit" disabled={pending} className="min-h-11 font-semibold underline underline-offset-4 disabled:opacity-60">
            {pending ? "Sending…" : "Resend link"}
          </button>
        )}
      </form>
    </div>
  );
}
