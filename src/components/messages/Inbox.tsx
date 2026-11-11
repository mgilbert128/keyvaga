import Link from "next/link";
import type { listThreads } from "@/lib/messages";

const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export function Inbox({ threads, base }: { threads: Awaited<ReturnType<typeof listThreads>>; base: string }) {
  if (threads.length === 0) return <p className="text-ink-muted">No conversations yet. Messages appear here once you have a booking.</p>;
  return (
    <ul className="flex flex-col gap-3">
      {threads.map((t) => (
        <li key={t.booking.id} className={`relative rounded-card border bg-surface p-4 ${t.unread ? "border-brand" : "border-line"}`}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-bold">
              <Link href={`${base}/${t.booking.id}`} className="after:absolute after:inset-0 after:rounded-card">{t.other}</Link>
              {t.unread ? <span className="ml-2 rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-on-brand">New</span> : null}
            </h2>
            <span className="text-sm text-ink-muted">{t.booking.listing.title} · {fmt.format(t.booking.checkIn)}</span>
          </div>
          <p className="mt-1 truncate text-ink-muted">{t.last ? t.last.body : "Start the conversation"}</p>
        </li>
      ))}
    </ul>
  );
}
