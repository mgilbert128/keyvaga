import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { confirmEmail } from "@/lib/email-verification";
import { getCurrentUser } from "@/lib/auth/dal";
import { defaultLandingFor } from "@/lib/auth/roles";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Confirm your email", robots: { index: false } };

export default function Page({ searchParams }: PageProps<"/verify-email">) {
  return (
    <Suspense fallback={<div className="h-64" aria-hidden="true" />}>
      <Confirm searchParams={searchParams} />
    </Suspense>
  );
}

async function Confirm({ searchParams }: { searchParams: PageProps<"/verify-email">["searchParams"] }) {
  const sp = await searchParams;
  await connection();
  const token = typeof sp.token === "string" ? sp.token : "";
  const ok = Boolean(await confirmEmail(token));
  const user = await getCurrentUser();
  return (
    <div className="mx-auto flex max-w-lg flex-col items-start gap-4 pt-12">
      <h1 className="text-3xl font-bold tracking-tight">{ok ? "Email confirmed ✓" : "This link didn't work"}</h1>
      <p className="text-lg text-ink-muted">
        {ok
          ? "Thanks! You're all set to book stays, list a property or offer your services."
          : "It may have expired (links work for 48 hours) or been replaced by a newer one. Log in and use “Resend link” in the yellow banner to get a fresh one."}
      </p>
      <ButtonLink href={user ? defaultLandingFor(user.roles) : ok ? "/login" : "/login"}>{user ? "Go to my account" : "Log in"}</ButtonLink>
    </div>
  );
}
