import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = { title: "List your property" };

const steps = [
  { title: "Create your account", body: "Sign up as an owner. You can book stays with the same login." },
  { title: "Add your listing", body: "Photos, amenities, house rules, pricing and a digital guidebook." },
  { title: "Connect payouts", body: "Get paid in USD straight to your bank account." },
  { title: "Publish after review", body: "Our team checks each listing before it goes live. Guests book instantly." },
];

export default function ListYourPropertyPage() {
  return (
    <div className="flex flex-col gap-10 pt-8 sm:pt-16">
      <div className="flex max-w-2xl flex-col gap-5">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">List your property on Keyvaga</h1>
        <p className="text-lg text-ink-muted">
          Run your calendar, pricing, bookings and payouts in one place, and book trusted local cleaners and
          handymen when you need them, right from your owner portal.
        </p>
        <ButtonLink href="/signup?intent=OWNER" className="self-start">Get started</ButtonLink>
      </div>
      <ol className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {steps.map((s, i) => (
          <li key={s.title}>
            <Card className="flex h-full flex-col gap-2">
              <span className="text-sm font-semibold text-brand">Step {i + 1}</span>
              <h2 className="text-xl font-bold">{s.title}</h2>
              <p className="text-ink-muted">{s.body}</p>
            </Card>
          </li>
        ))}
      </ol>
    </div>
  );
}
