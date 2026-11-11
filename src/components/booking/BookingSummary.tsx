import { formatCents } from "@/lib/money";

const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

type B = {
  checkIn: Date; checkOut: Date; guests: number; nightlyCents: number; cleaningCents: number; serviceCents: number; totalCents: number;
  dueNowCents: number; balanceCents: number; balanceDueDate: Date | null; balanceStatus: string; refundedCents: number; status: string;
  hostFeeCents: number; hostPayoutCents: number; payoutDueCents: number; payoutStatus: string;
};

/** Price, payment schedule and refunds for a booking. `view` controls guest vs owner wording. */
export function BookingSummary({ b, view }: { b: B; view: "guest" | "owner" }) {
  const nights = Math.round((b.checkOut.getTime() - b.checkIn.getTime()) / 86_400_000);
  const balanceLabel: Record<string, string> = { SCHEDULED: "Scheduled", PAID: "Paid", FAILED: "Payment failed", CANCELLED: "Cancelled", NONE: "" };
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <dl className="flex flex-col gap-2">
        <div className="flex justify-between"><dt className="text-ink-muted">Check in</dt><dd>{fmt.format(b.checkIn)}</dd></div>
        <div className="flex justify-between"><dt className="text-ink-muted">Check out</dt><dd>{fmt.format(b.checkOut)}</dd></div>
        <div className="flex justify-between"><dt className="text-ink-muted">Guests</dt><dd>{b.guests}</dd></div>
        <div className="flex justify-between border-t border-line pt-2"><dt>{nights} night{nights === 1 ? "" : "s"}</dt><dd>{formatCents(b.nightlyCents)}</dd></div>
        {b.cleaningCents ? <div className="flex justify-between"><dt>Cleaning fee</dt><dd>{formatCents(b.cleaningCents)}</dd></div> : null}
        {view === "guest" ? (
          <>
            <div className="flex justify-between"><dt>Keyvaga service fee</dt><dd>{formatCents(b.serviceCents)}</dd></div>
            <div className="flex justify-between border-t border-line pt-2 font-bold"><dt>Total</dt><dd>{formatCents(b.totalCents)}</dd></div>
          </>
        ) : (
          <>
            <div className="flex justify-between"><dt>Keyvaga host fee (5%)</dt><dd>−{formatCents(b.hostFeeCents)}</dd></div>
            <div className="flex justify-between border-t border-line pt-2 font-bold"><dt>Your payout</dt><dd>{formatCents(b.status === "CANCELLED" ? b.payoutDueCents : b.hostPayoutCents)}</dd></div>
          </>
        )}
      </dl>
      <dl className="flex flex-col gap-2 rounded-control bg-soft p-4 text-on-soft">
        {view === "guest" ? (
          <>
            <div className="flex justify-between font-semibold"><dt>{b.balanceCents ? "Deposit (30%)" : "Paid in full"}</dt><dd>{formatCents(b.dueNowCents)} · Paid</dd></div>
            {b.balanceCents > 0 && b.balanceDueDate ? (
              <div className="flex justify-between"><dt>Balance due {fmt.format(b.balanceDueDate)}</dt><dd>{formatCents(b.balanceCents)} · {balanceLabel[b.balanceStatus]}</dd></div>
            ) : null}
            {b.refundedCents > 0 ? <div className="flex justify-between font-semibold"><dt>Refunded</dt><dd>{formatCents(b.refundedCents)}</dd></div> : null}
          </>
        ) : (
          <>
            <div className="flex justify-between"><dt>Guest has paid</dt><dd>{b.balanceStatus === "PAID" || !b.balanceCents ? "In full" : "Deposit (30%)"}</dd></div>
            <div className="flex justify-between"><dt>Payout</dt><dd>{{ NOT_DUE: "Not due", PENDING: "Sent after check-in", PAID: "Sent", NONE: "None" }[b.payoutStatus]}</dd></div>
          </>
        )}
      </dl>
    </div>
  );
}
