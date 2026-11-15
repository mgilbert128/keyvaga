import type { DoorCode } from "@/lib/locks";

type Row = DoorCode & { backupCode: string | null; online: boolean };

/** Door code box for a guest's trip or a provider's job. `timeZone` is the property's, so times read as local. */
export function DoorCodes({ codes, timeZone, who = "you" }: { codes: Row[]; timeZone: string; who?: string }) {
  if (!codes.length) return null;
  const tzFmt = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const sameCode = new Set(codes.map((c) => c.code)).size === 1;
  return (
    <div className="flex flex-col gap-2 rounded-control border border-brand/30 bg-soft px-4 py-3 text-on-soft">
      <span className="text-sm font-semibold uppercase tracking-wide">Door code</span>
      <ul className="flex flex-col gap-2">
        {codes.map((c, i) => {
          if (sameCode && i > 0) return null;
          const usable = c.status !== "FAILED" && c.code;
          return (
            <li key={i} className="flex flex-col">
              {!sameCode || codes.length > 1 ? <span className="text-sm">{sameCode ? codes.map((x) => x.lockName).join(" · ") : c.lockName}</span> : null}
              {usable ? (
                <span className="font-mono text-3xl font-bold tracking-[0.2em]">{c.code}</span>
              ) : c.backupCode ? (
                <span className="font-mono text-3xl font-bold tracking-[0.2em]">{c.backupCode}</span>
              ) : (
                <span className="font-medium">Your host will send your code. Message them if you don&apos;t have it before arrival.</span>
              )}
              {usable && c.backupCode ? <span className="text-sm">If that code doesn&apos;t work, try the backup code {c.backupCode}.</span> : null}
            </li>
          );
        })}
      </ul>
      <span className="text-sm">
        Works for {who} from {tzFmt.format(codes[0]!.startsAt)} until {tzFmt.format(codes[0]!.endsAt)}. Please don&apos;t share it.
      </span>
    </div>
  );
}
