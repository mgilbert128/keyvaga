import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = { title: "No access" };

export default function NoAccessPage() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 pt-8 sm:pt-14">
      <h1 className="text-3xl font-bold tracking-tight">This portal isn&apos;t on your account yet</h1>
      <Card className="flex flex-col items-start gap-4">
        <p className="text-ink-muted">
          Your account doesn&apos;t have access to that area. If you want to host guests or offer services, you can add
          that to your account.
        </p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/list-your-property">List a property</ButtonLink>
          <ButtonLink href="/" variant="secondary">Back to home</ButtonLink>
        </div>
      </Card>
    </div>
  );
}
