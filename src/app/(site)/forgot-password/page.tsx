import Link from "next/link";
import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { ForgotPasswordForm } from "@/components/auth/ResetForms";

export const metadata: Metadata = { title: "Forgot password" };

export default function Page() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 pt-8 sm:pt-14">
      <h1 className="text-3xl font-bold tracking-tight">Forgot your password?</h1>
      <p className="text-ink-muted">Enter your account email and we&apos;ll send you a link to choose a new one.</p>
      <Card><ForgotPasswordForm /></Card>
      <Link href="/login" className="text-center font-semibold text-brand underline underline-offset-4">Back to log in</Link>
    </div>
  );
}
