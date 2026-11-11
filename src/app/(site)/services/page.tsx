import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { Card, Chip } from "@/components/ui/Card";

export const metadata: Metadata = { title: "Services" };

const categories = ["Cleaners", "Handymen", "Plumbers", "Electricians", "Landscaping", "Linen service", "Photographers"];

export default function ServicesPage() {
  return (
    <div className="flex flex-col gap-10 pt-8 sm:pt-16">
      <div className="flex max-w-2xl flex-col gap-5">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Find help for your property</h1>
        <p className="text-lg text-ink-muted">Compare vetted local pros and request quotes in one tap.</p>
      </div>
      <ul className="flex flex-wrap gap-3" aria-label="Service categories">
        {categories.map((c) => (
          <li key={c}><Chip>{c}</Chip></li>
        ))}
      </ul>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card className="flex flex-col items-start gap-4">
          <h2 className="text-2xl font-bold">For owners</h2>
          <p className="text-ink-muted">
            Request a quote from one provider, or post a job once and get quotes from several. Link each job to a
            property and a date, like a turnover cleaning after a checkout.
          </p>
          <ButtonLink href="/signup?intent=OWNER" variant="secondary">Join as an owner</ButtonLink>
        </Card>
        <Card className="flex flex-col items-start gap-4 bg-soft">
          <h2 className="text-2xl font-bold">For service providers</h2>
          <p className="text-ink-muted">
            Create a business profile, receive job requests from local owners, send quotes and get paid.
          </p>
          <ButtonLink href="/signup?intent=PROVIDER">Join as a provider</ButtonLink>
        </Card>
      </div>
    </div>
  );
}
