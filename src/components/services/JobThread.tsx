import { Composer } from "@/components/messages/Composer";

const timeFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });

type Msg = { id: string; body: string; createdAt: Date; sender: { id: string; name: string } };
type Result = { ok?: boolean; message?: string } | undefined;

export function JobThread({ meId, messages, action, emptyText }: { meId: string; messages: Msg[]; action: (prev: Result, fd: FormData) => Promise<Result>; emptyText: string }) {
  return (
    <div className="flex flex-col gap-4">
      {messages.length === 0 ? <p className="text-ink-muted">{emptyText}</p> : (
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
      <Composer action={action} />
    </div>
  );
}
