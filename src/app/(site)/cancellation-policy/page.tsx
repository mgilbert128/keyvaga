import type { Metadata } from "next";
import Link from "next/link";
import { LegalDoc, type LegalSection } from "@/components/legal/LegalDoc";
import { BALANCE_DAYS_BEFORE, CANCELLATION_POLICIES, POLICY_INFO, refundShareBps } from "@/lib/booking-money";

export const metadata: Metadata = { title: "Cancellation Policy", description: "How refunds work when a Keyvaga booking is cancelled." };

/** Days-before-check-in points where refunds change, for the table. */
const CHECKPOINTS = [30, 14, 7, 0];
const label = (d: number) => (d === 0 ? "Less than 7 days" : `${d}+ days`);

const sections: LegalSection[] = [
  {
    id: "options",
    title: "The three policies",
    body: (
      <>
        <p>Every listing uses one of three policies, chosen by the owner and shown on the listing and at checkout before you pay.</p>
        <div className="overflow-x-auto rounded-card border border-line bg-surface">
          <table className="w-full min-w-[520px] text-left text-sm">
            <caption className="sr-only">Refund by days before check-in</caption>
            <thead className="bg-soft text-on-soft">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Cancelled before check-in</th>
                {CANCELLATION_POLICIES.map((p) => <th key={p} scope="col" className="px-4 py-3 font-semibold">{POLICY_INFO[p].label}</th>)}
              </tr>
            </thead>
            <tbody>
              {CHECKPOINTS.map((d) => (
                <tr key={d} className="border-t border-line">
                  <th scope="row" className="px-4 py-3 font-medium">{label(d)}</th>
                  {CANCELLATION_POLICIES.map((p) => {
                    const r = refundShareBps(p, d === 0 ? 0 : d) / 100;
                    return <td key={p} className={`px-4 py-3 ${r === 0 ? "text-ink-muted" : "font-semibold"}`}>{r === 0 ? "No refund" : `${r}% refund`}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul>
          {CANCELLATION_POLICIES.map((p) => <li key={p}><strong>{POLICY_INFO[p].label}:</strong> {POLICY_INFO[p].summary}</li>)}
        </ul>
        <p className="text-sm text-ink-muted">&ldquo;Days before check-in&rdquo; counts calendar days from the day you cancel to the check-in date.</p>
      </>
    ),
  },
  {
    id: "guest-cancels",
    title: "If you (the guest) cancel",
    body: (
      <ul>
        <li>The refund percentage applies to the full booking total, including the guest service fee.</li>
        <li>If you booked with a deposit and the balance hasn&apos;t been charged yet ({BALANCE_DAYS_BEFORE} days before check-in), we cancel the balance charge. We never charge you more because you cancelled; if what you&apos;ve paid is more than the policy lets the owner keep, we refund the difference.</li>
        <li>You can see exactly what you&apos;ll get back on your trip page before you confirm the cancellation.</li>
        <li>Cancel from <Link href="/trips">Trips</Link> → your booking → Cancel booking.</li>
      </ul>
    ),
  },
  {
    id: "owner-cancels",
    title: "If the owner cancels",
    body: <p>You get a full refund of everything you paid, whatever the policy and however close to check-in. We&apos;ll email you right away. The owner receives nothing for the booking.</p>,
  },
  {
    id: "refund-timing",
    title: "When refunds arrive",
    body: <p>Refunds go back to the card you paid with. We send them immediately; banks usually take 5–10 business days to show them.</p>,
  },
  {
    id: "exceptions",
    title: "Problems and special cases",
    body: (
      <ul>
        <li><strong>Dates taken during checkout:</strong> in the rare case someone else books the same dates while your payment is finishing, you&apos;re refunded in full automatically.</li>
        <li><strong>Property problems:</strong> if the property is seriously not as described, unsafe, or you can&apos;t get in, message the owner right away and contact us. We&apos;ll review it and may issue a full or partial refund.</li>
        <li><strong>Emergencies:</strong> owners may offer more generous refunds than their policy. Message them through Keyvaga.</li>
      </ul>
    ),
  },
  {
    id: "jobs",
    title: "Service job cancellations",
    body: <p>Owners or service providers can cancel a job before it&apos;s marked done; any payment is refunded to the owner in full. If a booking is cancelled, cleanings booked for it are cancelled and refunded automatically.</p>,
  },
];

export default function CancellationPolicyPage() {
  return <LegalDoc title="Cancellation Policy" intro={<p>Plans change. Here&apos;s exactly how refunds work on Keyvaga, so there are no surprises.</p>} sections={sections} />;
}
