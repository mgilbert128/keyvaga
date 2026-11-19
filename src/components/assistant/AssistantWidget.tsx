"use client";

import { useEffect, useRef, useState } from "react";

type Turn = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = ["How do refunds work if I cancel?", "When is the rest of my payment charged?", "How do I get paid as a host?", "How do I sync my Airbnb calendar?"];

/** Floating "Help" chat with Keyvaga Assistant (Claude). Answers stream in as they're written. */
export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [turns]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    const history: Turn[] = [...turns, { role: "user", content: q }];
    setTurns([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: history }) });
      if (!res.body) throw new Error("no body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        setTurns([...history, { role: "assistant", content: answer }]);
      }
    } catch {
      setTurns([...history, { role: "assistant", content: "Sorry, I couldn't connect. Please try again, or email support@keyvaga.com." }]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  return (
    <>
      {open ? (
        <div role="dialog" aria-label="Keyvaga Assistant" className="fixed inset-x-2 bottom-2 z-[90] flex max-h-[min(640px,calc(100dvh-16px))] flex-col overflow-hidden rounded-card border border-line bg-surface shadow-[0_20px_60px_-15px_rgba(18,47,58,0.45)] sm:inset-x-auto sm:bottom-24 sm:right-6 sm:w-[380px]">
          <div className="flex items-center justify-between gap-3 bg-brand px-4 py-3 text-on-brand">
            <div>
              <p className="font-semibold">Keyvaga Assistant</p>
              <p className="text-xs text-white/80">AI answers about bookings, hosting and services</p>
            </div>
            <button type="button" onClick={() => { setOpen(false); buttonRef.current?.focus(); }} aria-label="Close chat" className="flex h-11 w-11 items-center justify-center rounded-full text-2xl hover:bg-white/15">×</button>
          </div>
          <div ref={listRef} aria-live="polite" className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
            {turns.length === 0 ? (
              <>
                <p className="rounded-control bg-soft px-3 py-2 text-sm text-on-soft">Hi! I can answer questions about booking, payments, cancellations, hosting and hiring local pros. What can I help with?</p>
                <div className="flex flex-col gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} type="button" onClick={() => ask(s)} className="min-h-11 rounded-full border border-line px-4 text-left text-sm text-brand hover:bg-soft">{s}</button>
                  ))}
                </div>
              </>
            ) : (
              turns.map((t, i) => (
                <div key={i} className={t.role === "user" ? "self-end max-w-[85%] rounded-2xl rounded-br-md bg-brand px-3 py-2 text-sm text-on-brand" : "self-start max-w-[90%] whitespace-pre-line rounded-2xl rounded-bl-md bg-soft px-3 py-2 text-sm text-ink"}>
                  {t.content || <span className="inline-flex gap-1" aria-label="Writing"><span className="h-2 w-2 animate-bounce rounded-full bg-brand/60" /><span className="h-2 w-2 animate-bounce rounded-full bg-brand/60 [animation-delay:120ms]" /><span className="h-2 w-2 animate-bounce rounded-full bg-brand/60 [animation-delay:240ms]" /></span>}
                </div>
              ))
            )}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); void ask(input); }} className="flex items-end gap-2 border-t border-line p-3">
            <label htmlFor="assistant-input" className="sr-only">Your question</label>
            <textarea
              id="assistant-input"
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(input); } }}
              rows={1}
              maxLength={1200}
              placeholder="Ask a question…"
              className="max-h-32 min-h-11 flex-1 resize-none rounded-control border border-line-strong bg-surface px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-brand"
            />
            <button type="submit" disabled={busy || !input.trim()} className="min-h-11 rounded-control bg-brand px-4 font-semibold text-on-brand disabled:opacity-50">Send</button>
          </form>
          <p className="px-4 pb-3 text-[11px] leading-snug text-ink-muted">AI can make mistakes. It can&apos;t see your account. For help with a booking, email <a href="mailto:support@keyvaga.com" className="underline">support@keyvaga.com</a>.</p>
        </div>
      ) : null}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Close help chat" : "Open help chat"}
        className={`fixed bottom-4 right-4 z-[90] flex h-14 items-center gap-2 rounded-full bg-brand px-5 font-semibold text-on-brand shadow-[0_10px_30px_-8px_rgba(18,47,58,0.6)] hover:bg-brand-hover sm:bottom-6 sm:right-6 ${open ? "max-sm:hidden" : ""}`}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /></svg>
        {open ? "Close" : "Help"}
      </button>
    </>
  );
}
