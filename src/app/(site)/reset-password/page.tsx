import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { ResetPasswordForm } from "@/components/auth/ResetForms";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false }, referrer: "no-referrer" };

export default function Page({ searchParams }: PageProps<"/reset-password">) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 pt-8 sm:pt-14">
      <h1 className="text-3xl font-bold tracking-tight">Choose a new password</h1>
      <Card>
        <Suspense fallback={<div className="h-40" aria-hidden="true" />}>
          <Form searchParams={searchParams} />
        </Suspense>
      </Card>
    </div>
  );
}

async function Form({ searchParams }: { searchParams: PageProps<"/reset-password">["searchParams"] }) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  if (!token) return <p>This link is incomplete. <Link href="/forgot-password" className="font-semibold text-brand underline">Request a new one</Link>.</p>;
  return <ResetPasswordForm token={token} />;
}
