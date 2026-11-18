import Link from "next/link";
import { formatCents } from "@/lib/money";
import { buttonClass, Button } from "@/components/ui/Button";
import { cancelRequestAction, declineRequestAction } from "@/app/actions/payment-requests";

type R = { id: string; description: string; totalCents: number; ownerPayoutCents: number; hostFeeCents: number; taxCents: number; status: string; paidAt: Date | null; paidOutAt: Date | null; createdAt: Date };

const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const LABEL: Record<string, string> = { REQUESTED: "Waiting for guest", PAID: "Paid", DECLINED: "Declined", CANCELLED: "Cancelled", REFUNDED: "Refunded" };

/** Payment requests on a booking. Owners see payouts and can cancel unpaid ones; guests can pay or decline. */
export function PaymentRequestList({ requests, view, bookingId }: { requests: R[]; view: "owner" | "guest"; bookingId: string }) {
  if (requests.length === 0) return null;
  return (
    <ul className="flex flex-col divide-y divide-line">
      {requests.map((r) => (
        <li key={r.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <p className="font-semibold">{r.description}</p>
            <p className="text-sm text-ink-muted">
              {formatCents(r.totalCents)}{r.taxCents ? " incl. tax" : ""} · {view === "guest" && r.status === "REQUESTED" ? "Awaiting your approval" : LABEL[r.status]}
              {r.status === "PAID" && r.paidAt ? ` ${day.format(r.paidAt)}` : ""}
              {view === "owner" && r.status === "PAID" ? ` · Your payout ${formatCents(r.ownerPayoutCents)} (${r.paidOutAt ? "sent" : "sent once the stay starts"})` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {view === "guest" && r.status === "REQUESTED" ? (
              <>
                <Link href={`/trips/${bookingId}/requests/${r.id}`} className={buttonClass("primary")}>Pay {formatCents(r.totalCents)}</Link>
                <form action={declineRequestAction.bind(null, bookingId, r.id)}><Button type="submit" variant="ghost">Decline</Button></form>
              </>
            ) : null}
            {view === "owner" && r.status === "REQUESTED" ? (
              <form action={cancelRequestAction.bind(null, bookingId, r.id)}><Button type="submit" variant="ghost">Cancel request</Button></form>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
