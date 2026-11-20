import type { Metadata } from "next";
import { ButtonLink, buttonClass } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "Integrations",
  description: "Keyvaga works with the tools vacation rental hosts already use: Hospitable, Airbnb, Vrbo, Booking.com, smart locks and Stripe.",
};

const others = [
  { name: "Airbnb, Vrbo, Booking.com and more", body: "Two-way calendar sync with iCal. Keyvaga re-checks your calendars before every booking, so you're never double-booked." },
  { name: "OwnerRez and other property managers", body: "Connect any system that offers iCal calendar links from the Connections screen in your owner portal." },
  { name: "Smart locks", body: "Schlage, Yale, August and more: a unique, timed door code for every stay and every cleaner, removed automatically on cancellation." },
  { name: "Stripe", body: "Secure guest payments and fast payouts to your bank account through Stripe Connect." },
  { name: "PriceLabs", body: "Connect your PriceLabs account from your owner portal and your dynamic nightly prices update on Keyvaga automatically. Or use PriceLabs through Hospitable, or set seasonal, weekend and per-date prices yourself." },
];

export default function IntegrationsPage() {
  return (
    <div className="flex flex-col gap-10 pt-6 sm:pt-10">
      <div className="flex max-w-3xl flex-col gap-3">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Integrations</h1>
        <p className="text-lg text-ink-muted">Keyvaga works with the tools you already use, so listing here doesn&apos;t mean double work.</p>
      </div>

      <Card className="flex flex-col gap-5 border-2 border-brand/30">
        <p className="self-start rounded-full bg-soft px-3 py-1 text-sm font-semibold text-on-soft">Recommended property management system</p>
        <h2 className="text-3xl font-bold tracking-tight">Hospitable</h2>
        <p className="max-w-3xl text-lg text-ink-muted">
          Hospitable is the all-in-one software many vacation rental hosts use to run their rentals: one inbox for every channel, automated guest
          messages, cleaning tasks and smart-lock codes. Keyvaga&apos;s founder runs her own properties on it.
        </p>
        <ul className="grid max-w-3xl grid-cols-1 gap-2 sm:grid-cols-2">
          {[
            "Import your properties and photos",
            "Availability and nightly prices stay in sync",
            "Keyvaga bookings appear on your Hospitable calendar",
            "Guest messages land in your Hospitable inbox",
          ].map((f) => (
            <li key={f} className="flex gap-2"><span aria-hidden="true" className="font-bold text-brand">✓</span>{f}</li>
          ))}
        </ul>
        <p className="text-sm text-ink-muted">Direct Hospitable connection coming soon. Today you can connect Hospitable calendars with iCal links.</p>
        <div className="flex flex-wrap gap-3">
          <a href="https://hospitable.com" target="_blank" rel="noopener" className={buttonClass("secondary")}>Learn about Hospitable</a>
          <ButtonLink href="/list-your-property">List your property</ButtonLink>
        </div>
      </Card>

      <section aria-labelledby="more-title" className="flex flex-col gap-4">
        <h2 id="more-title" className="text-2xl font-bold tracking-tight sm:text-3xl">Also works with</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {others.map((o) => (
            <Card key={o.name} className="flex flex-col gap-2">
              <h3 className="text-xl font-bold">{o.name}</h3>
              <p className="text-ink-muted">{o.body}</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
