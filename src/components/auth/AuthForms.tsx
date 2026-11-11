"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, signup } from "@/app/actions/auth";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import type { FormState } from "@/lib/validation/auth";

function FormError({ state }: { state: FormState }) {
  const msg = state?.errors?.form?.[0];
  if (!msg) return null;
  return (
    <p role="alert" className="rounded-control border border-danger/30 bg-danger/5 px-4 py-3 font-medium text-danger">
      {msg}
    </p>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <FormError state={state} />
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Email" id="email" type="email" autoComplete="email" required defaultValue={state?.values?.email} error={state?.errors?.email} />
      <Field label="Password" id="password" type="password" autoComplete="current-password" required error={state?.errors?.password} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Logging in…" : "Log in"}
      </Button>
      <p className="text-center text-ink-muted">
        New to Keyvaga?{" "}
        <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} className="font-semibold text-brand underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </form>
  );
}

const intents = [
  { value: "GUEST", label: "Book stays", hint: "Find and book vacation rentals" },
  { value: "OWNER", label: "List my property", hint: "Host guests and manage rentals" },
  { value: "PROVIDER", label: "Offer services", hint: "Cleaning, repairs and more" },
] as const;

export function SignupForm({ next, intent = "GUEST" }: { next?: string; intent?: string }) {
  const [state, action, pending] = useActionState(signup, undefined);
  const initial = intents.some((i) => i.value === intent) ? intent : "GUEST";
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <FormError state={state} />
      <input type="hidden" name="next" value={next ?? ""} />
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-semibold">I want to</legend>
        {intents.map((i) => (
          <label key={i.value} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-control border border-line-strong bg-surface px-4 py-3 has-[:checked]:border-brand has-[:checked]:bg-soft">
            <input type="radio" name="intent" value={i.value} defaultChecked={i.value === initial} className="h-5 w-5 accent-[var(--kv-brand)]" />
            <span className="flex flex-col">
              <span className="font-semibold">{i.label}</span>
              <span className="text-sm text-ink-muted">{i.hint}</span>
            </span>
          </label>
        ))}
        <p className="text-sm text-ink-muted">Every account can book stays. You can add more roles later.</p>
      </fieldset>
      <Field label="Full name" id="name" autoComplete="name" required defaultValue={state?.values?.name} error={state?.errors?.name} />
      <Field label="Email" id="email" type="email" autoComplete="email" required defaultValue={state?.values?.email} error={state?.errors?.email} />
      <Field label="Password" id="password" type="password" autoComplete="new-password" required hint="At least 10 characters." error={state?.errors?.password} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-center text-ink-muted">
        Already have an account?{" "}
        <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-semibold text-brand underline underline-offset-4">
          Log in
        </Link>
      </p>
    </form>
  );
}
