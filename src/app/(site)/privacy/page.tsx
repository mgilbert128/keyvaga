import type { Metadata } from "next";
import { LegalDoc, CONTACT_EMAIL, type LegalSection } from "@/components/legal/LegalDoc";

export const metadata: Metadata = { title: "Privacy Policy", description: "What information Keyvaga collects, why, and the choices you have." };

const sections: LegalSection[] = [
  {
    id: "collect",
    title: "Information we collect",
    body: (
      <>
        <p><strong>You give us:</strong></p>
        <ul>
          <li>Account details: name, email address, password (stored only as a secure hash), and your role (guest, owner, service provider).</li>
          <li>Bookings and jobs: dates, number of guests, messages, reviews, checklists and job photos.</li>
          <li>Owners: listing details, address, photos and videos, house rules, check-in instructions, payout details (entered with Stripe), and verification documents such as a deed, rental permit or management agreement.</li>
          <li>Service providers: business profile, service area, photos, and payout details (entered with Stripe).</li>
        </ul>
        <p><strong>Collected automatically:</strong> basic technical information such as your IP address, browser type, pages visited and the time of visits, plus a session cookie that keeps you logged in.</p>
        <p><strong>From partners:</strong> payment status from Stripe (we never see or store full card numbers), smart lock status from Seam if an owner connects a lock, and availability from calendars an owner connects (such as Airbnb or Vrbo).</p>
      </>
    ),
  },
  {
    id: "use",
    title: "How we use it",
    body: (
      <ul>
        <li>To run Keyvaga: show listings, take bookings, process payments and payouts, send confirmations and messages, create door codes, and sync calendars.</li>
        <li>To keep people safe: verify owners and properties, prevent fraud and abuse, and resolve disputes.</li>
        <li>To communicate: booking and account emails, security notices, and (only if you agree) occasional news. You can&apos;t opt out of essential booking and security emails while you have an active account.</li>
        <li>To improve the service and meet legal, tax and accounting duties.</li>
      </ul>
    ),
  },
  {
    id: "share",
    title: "Who we share it with",
    body: (
      <>
        <ul>
          <li><strong>Other users, as needed for a booking or job.</strong> Owners see a booked guest&apos;s name, dates and messages. Guests receive the property&apos;s exact address and check-in details shortly before arrival. Hired service providers see the job details and property address. Public listings show the owner&apos;s name and the town, never the exact address.</li>
          <li><strong>Service providers that run Keyvaga for us:</strong> Stripe (payments and payouts), Vercel (hosting and file storage), Neon (database), Resend (email) and Seam (smart locks). They may use your information only to provide their service to us.</li>
          <li><strong>Connected calendars:</strong> calendar links share only dates, never guest names or contact details.</li>
          <li><strong>When required:</strong> to comply with the law or valid legal requests, to enforce our terms, or to protect someone&apos;s safety; and to a buyer if Keyvaga is sold or merged, under this policy.</li>
        </ul>
        <p><strong>We don&apos;t sell your personal information</strong> and we don&apos;t share it for cross-site advertising.</p>
      </>
    ),
  },
  {
    id: "documents",
    title: "Verification documents",
    body: <p>Ownership and permit documents are stored privately. Only the owner who uploaded them and Keyvaga staff reviewing them can open them, and every view is logged. They&apos;re never shown to guests; guests see only a &ldquo;verified&rdquo; badge.</p>,
  },
  {
    id: "cookies",
    title: "Cookies",
    body: <p>We use a necessary cookie to keep you logged in and protect your account. We don&apos;t use advertising cookies. If we add analytics later, we&apos;ll update this policy.</p>,
  },
  {
    id: "retention",
    title: "How long we keep it",
    body: <p>We keep account information while your account is open. Booking, payment and tax records are kept as long as the law requires (usually up to seven years). Messages and photos tied to bookings or jobs are kept so disputes can be resolved, then deleted or anonymized when no longer needed.</p>,
  },
  {
    id: "security",
    title: "Security",
    body: <p>We protect information with encryption in transit, hashed passwords, private file storage and limited staff access. No system is perfectly secure; if we learn of a breach affecting you, we&apos;ll notify you as the law requires.</p>,
  },
  {
    id: "choices",
    title: "Your choices and rights",
    body: (
      <>
        <p>You can view and update your profile in your account. You can ask us to send you a copy of your information, correct it, or delete your account by emailing <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We&apos;ll respond within 30 days and may need to verify your identity. We may keep some records where the law requires.</p>
        <p>Depending on where you live (for example California or other US states with privacy laws), you may have additional rights, including the right to know, delete and correct information and to not be discriminated against for using them. We honor these rights for all users.</p>
      </>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: <p>Keyvaga is for adults 18 and older. We don&apos;t knowingly collect information from children. Contact us if you think a child has given us information.</p>,
  },
  {
    id: "changes",
    title: "Changes",
    body: <p>We&apos;ll post any changes here and update the date at the top. If changes are significant, we&apos;ll let you know by email or on the site.</p>,
  },
];

export default function PrivacyPage() {
  return <LegalDoc title="Privacy Policy" intro={<p>This policy explains what information Keyvaga LLC (&ldquo;Keyvaga,&rdquo; &ldquo;we&rdquo; or &ldquo;us&rdquo;) collects when you use our site, how we use it, and the choices you have. The short version: we use your information to run your bookings and keep the platform safe, and we never sell it.</p>} sections={sections} />;
}
