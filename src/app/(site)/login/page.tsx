import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/AuthForms";
import { Card } from "@/components/ui/Card";
import { safeNextPath } from "@/lib/auth/roles";

export const metadata: Metadata = { title: "Log in" };

export default function Page({ searchParams }: PageProps<"/login">) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 pt-8 sm:pt-14">
      <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
      <Card>
        <Suspense fallback={<div className="h-80" aria-hidden="true" />}>
          <FormWithParams searchParams={searchParams} />
        </Suspense>
      </Card>
    </div>
  );
}

async function FormWithParams({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const sp = await searchParams;
  const next = safeNextPath(typeof sp.next === "string" ? sp.next : null) ?? undefined;
  return (
    <>
      {sp.reset ? <p role="status" className="mb-5 rounded-control bg-soft px-4 py-3 font-medium text-on-soft">Password changed. Log in with your new password.</p> : null}
      <LoginForm next={next} />
    </>
  );
}
