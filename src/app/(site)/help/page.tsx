import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { CONTACT_EMAIL } from "@/components/legal/LegalDoc";
import { BALANCE_DAYS_BEFORE, DEPOSIT_BPS, GUEST_FEE_BPS, HOST_FEE_BPS } from "@/lib/booking-money";
import { AUTO_RELEASE_DAYS, JOB_OWNER_FEE_BPS, JOB_PROVIDER_FEE_BPS } from "@/lib/services";

export const metadata: Metadata = { title: "Help center", description: "Answers to common questions from Keyvaga guests, owners and service providers." };

const pct = (bps: number) => `${bps / 100}%`;
type QA = { q: string; a: ReactNode };

const GROUPS: { id: string; title: string; intro: string; items: QA[] }[] = [
  {
    id: "guests",
    title: "Guests",
    intro: "Booking, paying and staying.",
    items: [
      { q: "How do I book?", a: <p>Search by destination and dates, open a listing, choose your dates and guests, and click Reserve. Your dates are held for a few minutes while you pay. As soon as your payment goes through, the booking is confirmed. There&apos;s no waiting for the owner to accept.</p> },
      { q: "What does it cost?", a: <p>The nightly rate, any cleaning fee, and Keyvaga&apos;s {pct(GUEST_FEE_BPS)} service fee. Every cost is shown before you pay, and the total you see is the total you pay.</p> },
      { q: "Do I pay everything up front?", a: <p>If check-in is more than {BALANCE_DAYS_BEFORE} days away, you pay {pct(DEPOSIT_BPS)} now and the rest is charged automatically to the same card {BALANCE_DAYS_BEFORE} days before check-in. Closer to check-in, you pay in full when you book.</p> },
      { q: "How do I cancel, and will I get a refund?", a: <p>Go to <Link href="/trips">Trips</Link>, open the booking and choose Cancel booking. You&apos;ll see exactly what you&apos;ll get back before you confirm. Refunds depend on the listing&apos;s policy (Flexible, Moderate or Strict). See the <Link href="/cancellation-policy">Cancellation Policy</Link>.</p> },
      { q: "When do I get the address and door code?", a: <p>Your trip page shows the exact address, check-in instructions and, if the home has a smart lock, your own door code a few days before check-in (the owner sets how many). Your code only works from check-in time to checkout time.</p> },
      { q: "How do I contact the owner?", a: <p>Open your trip and click Message host. Keep conversations and payments on Keyvaga so you&apos;re protected.</p> },
      { q: "Something’s wrong with the property. What do I do?", a: <p>Message the owner first through your trip page; most issues are fixed quickly. If it&apos;s serious (unsafe, can&apos;t get in, very different from the listing), email us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> right away with photos.</p> },
      { q: "What do the verified badges mean?", a: <p>&ldquo;Verified host&rdquo; means the owner sent us proof they own or manage the property and we reviewed it. &ldquo;Permit on file&rdquo; means they provided a rental permit where one is required. It&apos;s a helpful check, not a guarantee.</p> },
    ],
  },
  {
    id: "owners",
    title: "Owners",
    intro: "Listing, pricing, getting paid and running turnovers.",
    items: [
      { q: "What does it cost to list?", a: <p>Listing is free. No monthly fees. Keyvaga keeps {pct(HOST_FEE_BPS)} of each booking (nightly rates plus cleaning fee). Use the &ldquo;What you&apos;d keep&rdquo; calculator on <Link href="/list-your-property">List your property</Link> to see your numbers.</p> },
      { q: "Can I charge a guest for extras after they book?", a: <p>Yes. Open the booking and use <strong>Request a payment</strong> for things like an extra parking pass or beach gear. The guest gets an email and approves and pays from their trip page. You receive the amount minus Keyvaga&apos;s 5% fee (at least $1) once the stay starts. You can cancel a request until it&apos;s paid; paid requests are refunded only if the booking is cancelled before check-in.</p> },
      { q: "Who handles lodging taxes?", a: <p>Where Keyvaga has tax rates for your area, guests pay lodging taxes at checkout and see them on their receipt. Some taxes Keyvaga files for you; others are added to your payout for you to report and pay. Your booking details show which is which. Keyvaga&apos;s fees are never charged on taxes.</p> },
      { q: "When and how do I get paid?", a: <p>Set up payouts under Owner → Payouts (through Stripe; it takes about 5 minutes). Your share of each booking is sent after the guest checks in. Banks usually show it within 2–3 business days.</p> },
      { q: "Why do you ask for ownership documents?", a: <p>To protect guests from fake listings. Upload a deed, tax bill or management agreement (and a rental permit if your area requires one) on your listing. Documents stay private: only you and our review team can see them, and guests just see a verified badge.</p> },
      { q: "How do I set prices for holidays or special dates?", a: <p>Go to Owner → Calendar, tap the first and last night, then set a price, block the dates, or reset to your normal price. Seasonal rates, weekend rates and weekly or monthly discounts are under Pricing.</p> },
      { q: "I also list on Airbnb, Vrbo, Hospitable or OwnerRez. How do I avoid double bookings?", a: <p>On Owner → Calendar, scroll to &ldquo;Sync with Airbnb, Vrbo, Hospitable and OwnerRez.&rdquo; Copy your Keyvaga link into each site&apos;s import box, and paste each site&apos;s export link into Keyvaga. Keyvaga re-checks your other calendars right before every booking. Other sites check Keyvaga every 1–3 hours.</p> },
      { q: "Can guests get a door code automatically?", a: <p>Yes. Connect your Schlage, Yale, August, Kwikset or other smart lock under Owner → Smart locks and choose which property each lock is on. Every confirmed guest gets a unique code that works from check-in to checkout; cleaners you hire get one for the job day. Codes are removed if a booking is cancelled.</p> },
      { q: "Can I send guests messages automatically?", a: <p>Yes. Under Owner → Messages → Automated messages, start from our suggested messages (thanks for booking, check-in details, welcome, checkout reminder, thanks for staying) and edit them. Fill-ins like {"{guest_first_name}"} and {"{door_code}"} are added for you.</p> },
      { q: "How do turnover cleanings work?", a: <p>Pick a regular cleaner on your listing and turn on automatic requests. Every new booking sends them a cleaning request for checkout day; you accept their quote. Cleaners work through your checklist and upload photos before they can mark the job done, and you check them before paying.</p> },
      { q: "What if I need to cancel a guest’s booking?", a: <p>You can, from the booking page, but the guest gets a full refund and you receive nothing for it. Please keep your calendar accurate to avoid cancellations.</p> },
    ],
  },
  {
    id: "pros",
    title: "Service pros",
    intro: "Cleaners, handymen and other local businesses.",
    items: [
      { q: "How do I join?", a: <p><Link href="/signup?intent=PROVIDER">Sign up as a service provider</Link>, complete your business profile (services, the towns you cover, photos) and submit it. We review new profiles, usually within a couple of business days.</p> },
      { q: "What does it cost?", a: <p>Joining is free. Keyvaga keeps {pct(JOB_PROVIDER_FEE_BPS)} of each job you complete. Owners pay a separate {pct(JOB_OWNER_FEE_BPS)} fee on their side.</p> },
      { q: "When do I get paid?", a: <p>The owner pays when they hire you, and we hold it. You&apos;re paid when the owner confirms the job, or automatically {AUTO_RELEASE_DAYS} days after you mark it done if they don&apos;t report a problem. Set up payouts under Services → Payouts.</p> },
      { q: "What’s the cleaning checklist?", a: <p>For cleanings, tick each item on the owner&apos;s checklist and upload the required photos from your phone. You can mark the job done once everything&apos;s complete. The photos protect you if there&apos;s ever a question about the clean.</p> },
    ],
  },
  {
    id: "account",
    title: "Account and security",
    intro: "Logging in and keeping your account safe.",
    items: [
      { q: "I forgot my password.", a: <p>Use <Link href="/forgot-password">Forgot password</Link> on the login page. We&apos;ll email you a link that works for one hour.</p> },
      { q: "Can I be a guest and an owner with one account?", a: <p>Yes. One account can book stays, list properties and offer services.</p> },
      { q: "How do I delete my account or get a copy of my data?", a: <p>Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> from the address on your account. See our <Link href="/privacy">Privacy Policy</Link>.</p> },
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10 pt-6 sm:pt-10">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Help center</h1>
        <p className="text-lg text-ink-muted">Answers to the questions we hear most. Can&apos;t find yours? Email <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand underline underline-offset-4">{CONTACT_EMAIL}</a>.</p>
        <nav aria-label="Help topics" className="flex flex-wrap gap-2 pt-2">
          {GROUPS.map((g) => (
            <a key={g.id} href={`#${g.id}`} className="inline-flex min-h-11 items-center rounded-full bg-soft px-4 font-semibold text-on-soft hover:bg-mist/40">{g.title}</a>
          ))}
        </nav>
      </header>
      {GROUPS.map((g) => (
        <section key={g.id} id={g.id} aria-labelledby={`${g.id}-h`} className="flex scroll-mt-6 flex-col gap-3">
          <div>
            <h2 id={`${g.id}-h`} className="text-2xl font-bold tracking-tight">{g.title}</h2>
            <p className="text-ink-muted">{g.intro}</p>
          </div>
          <div className="divide-y divide-line rounded-card border border-line bg-surface">
            {g.items.map((it) => (
              <details key={it.q} className="group px-5 [&_a]:text-brand [&_a]:underline [&_a]:underline-offset-4">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-semibold [&::-webkit-details-marker]:hidden">
                  <span>{it.q}</span>
                  <span aria-hidden="true" className="text-xl text-brand transition-transform group-open:rotate-45">+</span>
                </summary>
                <div className="pb-4 leading-relaxed text-ink-muted">{it.a}</div>
              </details>
            ))}
          </div>
        </section>
      ))}
      <section className="rounded-card bg-evergreen p-6 text-ivory sm:p-8">
        <h2 className="text-xl font-bold">Still need help?</h2>
        <p className="mt-2 text-ivory/85">Email <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-white underline underline-offset-4">{CONTACT_EMAIL}</a> and we&apos;ll get back to you as soon as we can, usually within one business day. For booking questions, include your booking number from your trip page.</p>
        <p className="mt-3 text-sm text-ivory/75">Read our <Link href="/terms" className="underline underline-offset-4">Terms</Link>, <Link href="/privacy" className="underline underline-offset-4">Privacy Policy</Link> and <Link href="/cancellation-policy" className="underline underline-offset-4">Cancellation Policy</Link>.</p>
      </section>
    </div>
  );
}
