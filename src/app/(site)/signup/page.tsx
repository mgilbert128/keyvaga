import { Suspense } from "react";
import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/AuthForms";
import { Card } from "@/components/ui/Card";
import { safeNextPath } from "@/lib/auth/roles";

export const metadata: Metadata = { title: "Sign up" };

export default function Page({ searchParams }: PageProps<"/signup">) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 pt-8 sm:pt-14">
      <h1 className="text-3xl font-bold tracking-tight">Create your Keyvaga account</h1>
      <Card>
        <Suspense fallback={<div className="h-80" aria-hidden="true" />}>
          <FormWithParams searchParams={searchParams} />
        </Suspense>
      </Card>
    </div>
  );
}

async function FormWithParams({ searchParams }: { searchParams: PageProps<"/signup">["searchParams"] }) {
  const sp = await searchParams;
  const next = safeNextPath(typeof sp.next === "string" ? sp.next : null) ?? undefined;
  return <SignupForm next={next} intent={typeof sp.intent === "string" ? sp.intent : undefined} />;
}
