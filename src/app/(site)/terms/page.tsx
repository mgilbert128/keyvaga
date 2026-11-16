import type { Metadata } from "next";
import Link from "next/link";
import { LegalDoc, CONTACT_EMAIL, type LegalSection } from "@/components/legal/LegalDoc";
import { BALANCE_DAYS_BEFORE, DEPOSIT_BPS, GUEST_FEE_BPS, HOST_FEE_BPS } from "@/lib/booking-money";
import { AUTO_RELEASE_DAYS, JOB_OWNER_FEE_BPS, JOB_PROVIDER_FEE_BPS } from "@/lib/services";

export const metadata: Metadata = { title: "Terms of Service", description: "The rules for using Keyvaga as a guest, owner or service provider." };

const pct = (bps: number) => `${bps / 100}%`;

const sections: LegalSection[] = [
  {
    id: "about",
    title: "About Keyvaga",
    body: (
      <>
        <p>
          Keyvaga is an online marketplace. It lets property owners and managers (&ldquo;Owners&rdquo;) list vacation rentals, travelers (&ldquo;Guests&rdquo;) book them, and cleaners, handymen and other local professionals (&ldquo;Service Providers&rdquo;) offer their services to Owners.
        </p>
        <p>
          Keyvaga is not a party to the rental agreement between a Guest and an Owner, or to the service agreement between an Owner and a Service Provider. We don&apos;t own, manage or inspect listed properties, and we don&apos;t employ Service Providers. Owners and Service Providers are responsible for what they offer.
        </p>
      </>
    ),
  },
  {
    id: "accounts",
    title: "Your account",
    body: (
      <ul>
        <li>You must be at least 18 years old and able to enter into a binding contract.</li>
        <li>Give accurate information and keep it up to date. One person per account.</li>
        <li>Keep your password private. You&apos;re responsible for what happens under your account. Tell us right away if you think someone else has used it.</li>
        <li>We may suspend or close accounts that break these terms, put others at risk, or are used for fraud.</li>
      </ul>
    ),
  },
  {
    id: "guests",
    title: "Booking a stay (Guests)",
    body: (
      <>
        <ul>
          <li><strong>Instant booking.</strong> When your payment goes through, your booking is confirmed. The price you see before paying is the total you pay: nightly rates, any cleaning fee, and Keyvaga&apos;s {pct(GUEST_FEE_BPS)} guest service fee.</li>
          <li><strong>Payment schedule.</strong> If check-in is more than {BALANCE_DAYS_BEFORE} days away, you pay {pct(DEPOSIT_BPS)} when you book and the rest is charged automatically to the same card {BALANCE_DAYS_BEFORE} days before check-in. Closer to check-in, you pay the full amount when you book. If the balance charge fails, we&apos;ll retry and let you know; a booking with an unpaid balance may be cancelled under the listing&apos;s cancellation policy.</li>
          <li><strong>Cancellations.</strong> Each listing shows its cancellation policy before you book. Refunds follow our <Link href="/cancellation-policy">Cancellation Policy</Link>.</li>
          <li><strong>During your stay.</strong> Follow the house rules, respect the maximum number of guests, and leave the property as you found it. You&apos;re responsible for damage caused by you or your guests beyond normal wear and tear.</li>
          <li><strong>Check-in details and door codes.</strong> The address, access instructions and any smart lock code are shared with you shortly before check-in. Don&apos;t share codes with anyone outside your group.</li>
        </ul>
      </>
    ),
  },
  {
    id: "owners",
    title: "Listing a property (Owners)",
    body: (
      <ul>
        <li><strong>Accurate listings.</strong> Describe your property honestly, with real photos, correct amenities, prices, house rules and availability. Keep your calendar up to date, including dates booked on other sites.</li>
        <li><strong>Right to rent.</strong> You confirm you own the property or are authorized to rent it (for example as its manager), and that renting it complies with local laws, HOA rules, leases, permits and licenses. We may ask for proof of ownership or a management agreement and a rental permit, and may remove listings until it&apos;s provided.</li>
        <li><strong>Taxes.</strong> You&apos;re responsible for collecting and paying any lodging, occupancy, sales or income taxes that apply to your rentals, unless Keyvaga tells you in writing that it collects a specific tax for you.</li>
        <li><strong>Instant booking and your cancellation policy.</strong> Guests can book open dates instantly. You choose Flexible, Moderate or Strict. If you cancel a confirmed booking, the Guest gets a full refund and you receive nothing for it; repeated cancellations may lead to account suspension.</li>
        <li><strong>Fees and payouts.</strong> Listing is free. Keyvaga keeps {pct(HOST_FEE_BPS)} of each booking&apos;s subtotal (nightly rates plus cleaning fee). Payouts are sent through our payment partner, Stripe, after the Guest checks in, to the bank account you add. You must complete Stripe&apos;s identity checks to receive payouts.</li>
        <li><strong>Safety.</strong> Keep your property safe and in good repair, with working smoke and carbon monoxide detectors, and disclose hazards.</li>
      </ul>
    ),
  },
  {
    id: "services",
    title: "Service jobs (Owners and Service Providers)",
    body: (
      <ul>
        <li>Owners can request quotes and hire Service Providers through Keyvaga. Service Providers set their own prices and decide how to do the work. They are independent businesses, not Keyvaga employees.</li>
        <li><strong>Payment.</strong> When an Owner accepts a quote, they pay the quote plus a {pct(JOB_OWNER_FEE_BPS)} Keyvaga fee. Keyvaga holds the payment and releases it to the Service Provider, minus a {pct(JOB_PROVIDER_FEE_BPS)} fee, when the Owner confirms the work is done, or automatically {AUTO_RELEASE_DAYS} days after the Service Provider marks it done if the Owner hasn&apos;t reported a problem.</li>
        <li><strong>Checklists and photos.</strong> For cleanings, the Owner&apos;s checklist must be completed and the required photos uploaded before a job can be marked done.</li>
        <li><strong>Problems.</strong> If an Owner reports a problem, payment is held while Keyvaga reviews the job, its messages, checklist and photos. Keyvaga may release the payment, refund the Owner, or split it. Cancelled jobs are refunded in full.</li>
        <li>Service Providers are responsible for their own licenses, insurance and taxes.</li>
      </ul>
    ),
  },
  {
    id: "payments",
    title: "Payments",
    body: (
      <>
        <p>
          Payments are processed by Stripe. By paying or receiving money through Keyvaga you also agree to <a href="https://stripe.com/legal" rel="noopener" target="_blank">Stripe&apos;s terms</a>. Keyvaga acts as the Owner&apos;s or Service Provider&apos;s limited agent to collect payments; once you pay Keyvaga, your payment obligation to them is met.
        </p>
        <p>All prices are in US dollars. Your bank may charge its own fees. Refunds go back to the original payment method and usually take 5–10 business days to appear.</p>
      </>
    ),
  },
  {
    id: "off-platform",
    title: "Keep bookings and payments on Keyvaga",
    body: <p>Don&apos;t ask for or make payments outside Keyvaga for bookings or jobs arranged here. Off-platform payments aren&apos;t protected by our refund and payout rules, and asking for them may lead to account suspension.</p>,
  },
  {
    id: "content",
    title: "Your content and reviews",
    body: (
      <>
        <p>You keep ownership of the photos, descriptions, reviews and messages you post. You give Keyvaga permission to use, display and adapt them to run and promote the service (for example, showing your listing photos in search or on our homepage).</p>
        <p>Reviews must be honest and about a real stay or job. We may remove content that is false, discriminatory, hateful, sexual, threatening, violates someone&apos;s privacy or rights, or advertises other businesses.</p>
      </>
    ),
  },
  {
    id: "rules",
    title: "Things you may not do",
    body: (
      <ul>
        <li>Discriminate against anyone based on race, religion, national origin, disability, sex, gender identity, sexual orientation, age or familial status.</li>
        <li>Post fake listings, reviews or accounts, or misrepresent yourself or a property.</li>
        <li>Use Keyvaga for illegal activity, including unpermitted rentals or parties that break local rules.</li>
        <li>Scrape, copy, overload or interfere with the site, or try to get around security or fees.</li>
        <li>Harass, threaten or spam other users.</li>
      </ul>
    ),
  },
  {
    id: "connections",
    title: "Smart locks, calendar sync and other connections",
    body: (
      <p>
        If you connect a smart lock account (through our partner Seam) or another calendar (such as Airbnb, Vrbo, Hospitable or OwnerRez), you authorize Keyvaga to create and remove door codes and to read or share availability as described in the app. These connections depend on third-party services that can be delayed or unavailable. Keep a backup way to enter your property, and check your calendars, especially where other sites sync only every few hours.
      </p>
    ),
  },
  {
    id: "disclaimers",
    title: "Disclaimers",
    body: (
      <p>
        Keyvaga is provided &ldquo;as is.&rdquo; To the extent the law allows, we make no warranties about listings, properties, Service Providers, Guests, or that the service will be uninterrupted or error-free. We may verify some information (such as ownership documents), but verification isn&apos;t a guarantee. Use your own judgment when booking, hosting or hiring.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Limitation of liability",
    body: (
      <p>
        To the extent the law allows, Keyvaga isn&apos;t liable for indirect, incidental, special or consequential damages, lost profits, or for injuries or property damage arising from stays, properties or services arranged through Keyvaga. Our total liability for any claim is limited to the greater of the fees you paid Keyvaga in the 12 months before the claim or $100. Some places don&apos;t allow these limits, so they may not apply to you.
      </p>
    ),
  },
  {
    id: "indemnity",
    title: "Your responsibility to us",
    body: <p>You agree to cover Keyvaga&apos;s losses and reasonable legal costs from claims that arise out of your listing, stay, services, content, or breach of these terms or the law.</p>,
  },
  {
    id: "disputes",
    title: "Disputes",
    body: (
      <p>
        If you have a problem, contact us first at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>; most issues can be solved quickly. These terms are governed by the laws of the State of Missouri, without regard to conflict-of-law rules, and disputes will be heard in the state or federal courts located in Missouri unless the law requires otherwise.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to these terms",
    body: <p>We may update these terms as Keyvaga grows. If we make important changes, we&apos;ll tell you by email or on the site before they take effect. Bookings and jobs already confirmed keep the terms that applied when they were made. Continuing to use Keyvaga after changes take effect means you accept them.</p>,
  },
];

export default function TermsPage() {
  return (
    <LegalDoc
      title="Terms of Service"
      intro={<p>These terms are the agreement between you and Keyvaga LLC, a Missouri limited liability company (&ldquo;Keyvaga,&rdquo; &ldquo;we&rdquo; or &ldquo;us&rdquo;), when you use keyvaga.com as a guest, owner or service provider. Please read them along with our <Link href="/privacy" className="text-brand underline underline-offset-4">Privacy Policy</Link> and <Link href="/cancellation-policy" className="text-brand underline underline-offset-4">Cancellation Policy</Link>.</p>}
      sections={sections}
    />
  );
}
