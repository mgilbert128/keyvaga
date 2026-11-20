"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";

export type CalendarCell = {
  iso: string;
  day: number;
  kind: "booked" | "blocked" | "open";
  label: string;
  href: string | null;
  past: boolean;
  custom: boolean;
  /** Percent off this night (owner date discount), 0 when none. */
  discountPct: number;
  a11y: string;
};

type Tab = "price" | "discount" | "block";

type Result = { ok?: boolean; message?: string } | undefined;
type Action = (prev: Result, fd: FormData) => Promise<Result>;

const WEEKDAYS = [["Sun", "Sunday"], ["Mon", "Monday"], ["Tue", "Tuesday"], ["Wed", "Wednesday"], ["Thu", "Thursday"], ["Fri", "Friday"], ["Sat", "Saturday"]] as const;
const fmt = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const label = (iso: string) => fmt.format(new Date(`${iso}T00:00:00Z`));

function RangeForm({ action, start, end, submit, variant, children, onDone }: { action: Action; start: string; end: string; submit: string; variant?: "primary" | "secondary" | "ghost"; children?: React.ReactNode; onDone: (r: Result) => void }) {
  const [state, run, pending] = useActionState(action, undefined);
  useEffect(() => {
    if (state) onDone(state);
  }, [state, onDone]);
  return (
    <form action={run} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="start" value={start} />
      <input type="hidden" name="end" value={end} />
      {children}
      <Button type="submit" variant={variant} disabled={pending}>{pending ? "Saving…" : submit}</Button>
    </form>
  );
}

/**
 * Owner calendar: tap a first and last night to select a range, then set a custom price,
 * block the nights, or reset them to the normal price. Booked nights link to the booking.
 */
export function CalendarSelector({ weeks, setPrice, block, resetPrice, addDiscount, caption }: { weeks: (CalendarCell | null)[][]; setPrice: Action; block: Action; resetPrice: Action; addDiscount: Action; caption: string }) {
  const [tab, setTab] = useState<Tab>("price");
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [message, setMessage] = useState<Result>(undefined);

  function pick(iso: string) {
    setMessage(undefined);
    if (!start || end) {
      setStart(iso);
      setEnd(null);
    } else if (iso < start) {
      setEnd(start);
      setStart(iso);
    } else {
      setEnd(iso);
    }
  }
  const last = end ?? start;
  const inRange = (iso: string) => Boolean(start && last && iso >= start && iso <= last);
  const nights = start && last ? Math.round((Date.parse(last) - Date.parse(start)) / 86_400_000) + 1 : 0;
  const done = (r: Result) => {
    setMessage(r);
    if (r?.ok) {
      setStart(null);
      setEnd(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-muted">Tap the first night, then the last night, to select dates. Then set a price, add a discount, or block them.</p>
      <table className="w-full table-fixed border-collapse">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>{WEEKDAYS.map(([s, l]) => <th key={s} scope="col" className="pb-2 text-xs font-semibold text-ink-muted sm:text-sm"><abbr title={l} className="no-underline">{s}</abbr></th>)}</tr>
        </thead>
        <tbody>
          {weeks.map((week, wi) => (
            <tr key={wi}>
              {week.map((c, di) => {
                if (!c) return <td key={di} />;
                const selected = inRange(c.iso);
                const base = "flex h-16 w-full flex-col gap-0.5 overflow-hidden rounded-lg border p-1.5 text-left sm:h-20";
                const tone =
                  c.kind === "booked" ? "border-brand bg-brand text-on-brand"
                  : c.kind === "blocked" ? "border-line bg-line text-ink"
                  : c.past ? "border-line bg-surface text-ink-muted/60"
                  : "border-line bg-surface hover:border-brand";
                const content = (
                  <>
                    <span className="text-xs font-semibold sm:text-sm">{c.day}</span>
                    <span className={`truncate text-[11px] sm:text-xs ${c.custom && c.kind === "open" ? "font-bold text-brand" : ""}`}>
                      {c.past && c.kind === "open" ? "" : c.label}
                      {c.custom && c.kind === "open" && !c.past ? <span aria-hidden="true"> ●</span> : null}
                    </span>
                    {c.discountPct && c.kind === "open" && !c.past ? (
                      <span className="w-fit rounded bg-brand px-1 text-[10px] font-bold leading-4 text-on-brand sm:text-[11px]" aria-hidden="true">−{c.discountPct}%</span>
                    ) : null}
                  </>
                );
                return (
                  <td key={di} className="p-0.5 align-top">
                    {c.kind === "booked" && c.href ? (
                      <Link href={c.href} className={`${base} ${tone}`} aria-label={c.a11y}>{content}</Link>
                    ) : c.past ? (
                      <div className={`${base} ${tone}`} aria-label={c.a11y}>{content}</div>
                    ) : (
                      <button type="button" onClick={() => pick(c.iso)} aria-pressed={selected} aria-label={`${c.a11y}${selected ? ", selected" : ""}`} className={`${base} ${tone} ${selected ? "!border-2 !border-brand ring-2 ring-brand/40" : ""} ${selected && c.kind === "open" ? "!bg-soft" : ""}`}>
                        {content}
                      </button>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-muted" aria-label="Calendar key">
        <li className="flex items-center gap-2"><span className="inline-block h-4 w-4 rounded border border-line bg-surface" aria-hidden="true" /> Open (nightly price)</li>
        <li className="flex items-center gap-2"><span className="font-bold text-brand" aria-hidden="true">$ ●</span> Custom price</li>
        <li className="flex items-center gap-2"><span className="rounded bg-brand px-1 text-[11px] font-bold text-on-brand" aria-hidden="true">−20%</span> Discount (price shown after discount)</li>
        <li className="flex items-center gap-2"><span className="inline-block h-4 w-4 rounded bg-brand" aria-hidden="true" /> Booked</li>
        <li className="flex items-center gap-2"><span className="inline-block h-4 w-4 rounded bg-line" aria-hidden="true" /> Blocked</li>
      </ul>

      <div aria-live="polite" className="flex flex-col gap-4 rounded-control border border-line bg-bg p-4">
        {start && last ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">
                Selected: {label(start)}{last !== start ? ` – ${label(last)}` : ""} · {nights} night{nights === 1 ? "" : "s"}
                {!end ? <span className="font-normal text-ink-muted"> (tap another date to select a range)</span> : null}
              </p>
              <button type="button" className="min-h-11 px-2 text-brand underline underline-offset-4" onClick={() => { setStart(null); setEnd(null); }}>Clear</button>
            </div>
            <div role="tablist" aria-label="What to do with these dates" className="flex flex-wrap gap-2 border-b border-line pb-3">
              {([["price", "Price"], ["discount", "Discount"], ["block", "Block"]] as const).map(([k, l]) => (
                <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                  className={`min-h-11 rounded-control px-4 font-semibold ${tab === k ? "bg-brand text-on-brand" : "border border-line bg-surface text-ink hover:border-brand"}`}>
                  {l}
                </button>
              ))}
            </div>
            {tab === "price" ? (
              <div role="tabpanel" className="flex flex-wrap items-end gap-3">
                <RangeForm action={setPrice} start={start} end={last} submit="Set price" onDone={done}>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="cal-rate" className="text-sm font-semibold">New price per night ($)</label>
                    <input id="cal-rate" name="rate" inputMode="decimal" placeholder="350" required className={`${inputClass} w-40`} />
                  </div>
                </RangeForm>
                <RangeForm action={resetPrice} start={start} end={last} submit="Reset to normal price" variant="ghost" onDone={done} />
              </div>
            ) : tab === "discount" ? (
              <div role="tabpanel" className="flex flex-col gap-2">
                <RangeForm action={addDiscount} start={start} end={last} submit="Add discount" onDone={done}>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="cal-pct" className="text-sm font-semibold">Percent off</label>
                    <div className="flex items-center gap-2">
                      <input id="cal-pct" name="percent" type="number" min={1} max={90} step={1} inputMode="numeric" placeholder="20" required className={`${inputClass} w-24`} />
                      <span aria-hidden="true" className="font-semibold">%</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="cal-dname" className="text-sm font-semibold">Name guests see (optional)</label>
                    <input id="cal-dname" name="name" placeholder="Fall special" maxLength={60} className={`${inputClass} w-48`} />
                  </div>
                </RangeForm>
                <div className="flex flex-wrap gap-2" aria-label="Quick picks">
                  {[10, 15, 20, 25, 30].map((p) => (
                    <button key={p} type="button" className="min-h-11 rounded-full border border-line px-3 text-sm font-semibold hover:border-brand"
                      onClick={() => { const el = document.getElementById("cal-pct") as HTMLInputElement | null; if (el) { el.value = String(p); el.focus(); } }}>
                      {p}%
                    </button>
                  ))}
                </div>
                <p className="text-sm text-ink-muted">Comes off the nightly price, not the cleaning fee. If a weekly or monthly discount would save the guest more, they get that one instead (discounts don&apos;t stack).</p>
              </div>
            ) : (
              <div role="tabpanel">
                <RangeForm action={block} start={start} end={last} submit="Block these nights" variant="secondary" onDone={done}>
                  <label htmlFor="cal-note" className="sr-only">Note</label>
                  <input id="cal-note" name="note" placeholder="Note (optional)" maxLength={120} className={`${inputClass} w-48`} />
                </RangeForm>
              </div>
            )}
          </>
        ) : (
          <p className="text-ink-muted">No dates selected.</p>
        )}
        {message?.message ? <p role={message.ok ? "status" : "alert"} className={`font-medium ${message.ok ? "text-on-soft" : "text-danger"}`}>{message.message}</p> : null}
      </div>
    </div>
  );
}
