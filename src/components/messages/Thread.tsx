import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Composer } from "./Composer";
import { sendMessage } from "@/app/actions/messages";

const timeFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });
const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

type Msg = { id: string; body: string; createdAt: Date; sender: { id: string; name: string } };

export function Thread({
  bookingId, meId, title, otherName, checkIn, checkOut, messages, backHref, bookingHref, cancelled,
}: {
  bookingId: string; meId: string; title: string; otherName: string; checkIn: Date; checkOut: Date; messages: Msg[]; backHref: string; bookingHref: string; cancelled: boolean;
}) {
  return (
    <div className="flex flex-col gap-6 pt-6 sm:pt-10">
      <Link href={backHref} className="inline-flex min-h-11 items-center self-start text-brand underline underline-offset-4">← All messages</Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{otherName}</h1>
        <p className="text-ink-muted">
          <Link href={bookingHref} className="underline underline-offset-4">{title}</Link> · {dateFmt.format(checkIn)} – {dateFmt.format(checkOut)}{cancelled ? " · Cancelled" : ""}
        </p>
      </div>
      <Card className="flex flex-col gap-4">
        {messages.length === 0 ? (
          <p className="text-ink-muted">No messages yet. Say hello!</p>
        ) : (
          <ol className="flex flex-col gap-3" aria-label="Messages">
            {messages.map((m) => {
              const mine = m.sender.id === meId;
              return (
                <li key={m.id} className={`flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`}>
                  <div className={`max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-3 ${mine ? "bg-brand text-on-brand" : "bg-soft text-ink"}`}>{m.body}</div>
                  <span className="text-xs text-ink-muted">{mine ? "You" : m.sender.name.split(" ")[0]} · {timeFmt.format(m.createdAt)}</span>
                </li>
              );
            })}
          </ol>
        )}
        <div className="border-t border-line pt-4">
          <Composer action={sendMessage.bind(null, bookingId)} />
        </div>
      </Card>
    </div>
  );
}
