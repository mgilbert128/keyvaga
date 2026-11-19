import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { KeepCalculator } from "@/components/marketing/KeepCalculator";
import { HOST_FEE_PERCENT } from "@/lib/earnings";
import { WaitlistForm } from "@/components/marketing/WaitlistForm";
import { softLaunch } from "@/lib/launch";

/** Hero photo credit. Set href to the Keyvaga listing (e.g. "/stays/mountain-peak-lodge-…") once it is published. */
const PHOTO_CREDIT: { label: string; href: string | null } = { label: "Mountain Peak Lodge, Gatlinburg, TN", href: null };

export const metadata: Metadata = {
  title: "List your property",
  description: "Free to list. Keep 95% of your booking revenue, with calendar, bookings and payouts in one place.",
  openGraph: {
    title: "List your property on Keyvaga",
    description: "Free to list. Keep 95% of your booking revenue, with calendar, bookings and payouts in one place.",
  },
};

const steps = [
  { title: "Create your account", body: "Sign up as an owner. You can book stays with the same login." },
  { title: "Add your listing", body: "Photos, amenities, house rules, pricing and a digital guidebook." },
  { title: "Connect payouts", body: "Get paid in USD straight to your bank account." },
  { title: "Publish after review", body: "Our team checks each listing before it goes live. Guests book instantly." },
];

export default function ListYourPropertyPage() {
  const waitlist = softLaunch();
  return (
    <div className="flex flex-col gap-10 pt-2 sm:pt-6">
      <section aria-labelledby="lyp-title" className="relative isolate -mx-4 overflow-hidden sm:mx-0 sm:rounded-[28px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/hero/mountain-peak-lodge-deck.webp" alt="" className="absolute inset-0 -z-10 h-full w-full object-cover object-[55%_center]" fetchPriority="high" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-[#0f2a35]/85 via-[#0f2a35]/55 to-[#0f2a35]/10" />
        <div className="flex min-h-[460px] max-w-2xl flex-col justify-center gap-5 px-6 py-12 text-white sm:min-h-[520px] sm:px-12">
          <h1 id="lyp-title" className="font-brand text-4xl font-bold leading-[1.05] tracking-tight drop-shadow-sm sm:text-5xl">List your property on Keyvaga</h1>
          <p className="text-lg text-white/90">
            Run your calendar, pricing, bookings and payouts in one place, and book trusted local cleaners and
            handymen when you need them, right from your owner portal.
          </p>
          <p className="text-lg font-semibold">
            <span className="mr-2 inline-block h-2 w-2 rounded-full bg-coral align-middle" aria-hidden="true" />
            Free to list. Keep {100 - HOST_FEE_PERCENT}% of your booking revenue (nightly rent and cleaning fees).
          </p>
          <ButtonLink href={waitlist ? "#waitlist" : "/signup?intent=OWNER"} className="self-start rounded-full !bg-white px-7 !text-brand hover:!bg-ivory">
            {waitlist ? "Join the waitlist" : "Get started"}
          </ButtonLink>
        </div>
        {/* Photo used with the owner's permission. Link it to his Keyvaga listing once Mountain Peak Lodge is live. */}
        <p className="absolute bottom-3 right-4 rounded-full bg-black/45 px-3 py-1 text-xs text-white/90 backdrop-blur-sm">
          Photo: {PHOTO_CREDIT.href ? <a href={PHOTO_CREDIT.href} className="underline underline-offset-2 hover:text-white">{PHOTO_CREDIT.label}</a> : PHOTO_CREDIT.label}
        </p>
      </section>
      <section aria-labelledby="keep-title" className="flex flex-col gap-4">
        <h2 id="keep-title" className="text-2xl font-bold tracking-tight sm:text-3xl">What you&apos;d keep</h2>
        <KeepCalculator />
      </section>
      {waitlist ? (
        <section id="waitlist" aria-labelledby="waitlist-title" className="scroll-mt-24">
          <Card className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <h2 id="waitlist-title" className="text-2xl font-bold tracking-tight sm:text-3xl">Join the owner waitlist</h2>
              <p className="text-ink-muted">
                We&apos;re opening Keyvaga to new owners in small groups. Leave your details and we&apos;ll email you as
                soon as you can set up your listings. No account or payment needed.
              </p>
            </div>
            <WaitlistForm />
          </Card>
        </section>
      ) : null}
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
