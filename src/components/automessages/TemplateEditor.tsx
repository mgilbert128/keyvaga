"use client";

import { useActionState, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";
import { PLACEHOLDERS, TRIGGERS, renderMessage, unknownPlaceholders, type PlaceholderKey, type Trigger } from "@/lib/auto-messages";
import type { TemplateResult } from "@/app/actions/auto-messages";

type Props = {
  action: (prev: TemplateResult, fd: FormData) => Promise<TemplateResult>;
  listings: { id: string; title: string }[];
  initial: { name: string; trigger: Trigger; offsetDays: number; body: string; listingId: string | null };
  sample: Record<PlaceholderKey, string>;
  sampleLabel: string;
};

/** Edit an automated message with fill-in buttons and a live preview. */
export function TemplateEditor({ action, listings, initial, sample, sampleLabel }: Props) {
  const [state, run, pending] = useActionState(action, undefined);
  const [trigger, setTrigger] = useState<Trigger>(initial.trigger);
  const [body, setBody] = useState(initial.body);
  const ref = useRef<HTMLTextAreaElement>(null);
  const t = TRIGGERS.find((x) => x.value === trigger)!;
  const unknown = unknownPlaceholders(body);

  function insert(key: string) {
    const el = ref.current;
    const token = `{${key}}`;
    if (!el) return setBody((b) => b + token);
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + token.length, start + token.length); });
  }

  return (
    <form action={run} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="name" className="text-sm font-semibold">Name (only you see this)</label>
          <input id="name" name="name" defaultValue={initial.name} maxLength={80} required className={inputClass} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_8rem] sm:items-end">
          <div className="flex flex-col gap-2">
            <label htmlFor="trigger" className="text-sm font-semibold">When to send</label>
            <select id="trigger" name="trigger" value={trigger} onChange={(e) => setTrigger(e.target.value as Trigger)} className={inputClass}>
              {TRIGGERS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
            </select>
          </div>
          {t.usesDays ? (
            <div className="flex flex-col gap-2">
              <label htmlFor="offsetDays" className="text-sm font-semibold">{t.daysLabel}</label>
              <input id="offsetDays" name="offsetDays" type="number" min={0} max={60} defaultValue={initial.offsetDays || (trigger === "BEFORE_CHECKIN" ? 7 : 1)} className={inputClass} />
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="listingId" className="text-sm font-semibold">For</label>
          <select id="listingId" name="listingId" defaultValue={initial.listingId ?? ""} className={inputClass}>
            <option value="">All my listings</option>
            {listings.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="body" className="text-sm font-semibold">Message</label>
          <div className="flex flex-wrap gap-1.5" aria-label="Insert a fill-in">
            {PLACEHOLDERS.map((p) => (
              <button key={p.key} type="button" onClick={() => insert(p.key)} title={p.help} className="min-h-9 rounded-full border border-line-strong px-3 text-xs hover:border-brand hover:bg-soft">
                {`{${p.key}}`}
              </button>
            ))}
          </div>
          <textarea id="body" name="body" ref={ref} rows={10} value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} required className={`${inputClass} min-h-48 py-3`} />
          {unknown.length ? <p role="alert" className="text-sm font-medium text-danger">Unknown fill-in: {unknown.map((u) => `{${u}}`).join(", ")}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save message"}</Button>
          {state?.message ? <p role="alert" className="text-sm font-medium text-danger">{state.message}</p> : null}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Preview <span className="font-normal text-ink-muted">({sampleLabel})</span></h2>
        <div className="whitespace-pre-line rounded-2xl bg-brand px-4 py-3 text-on-brand" aria-live="polite">{renderMessage(body, sample) || " "}</div>
        <p className="text-xs text-ink-muted">Guests receive this in their Keyvaga messages for the booking, marked as automated.</p>
      </div>
    </form>
  );
}
