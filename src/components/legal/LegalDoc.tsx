import type { ReactNode } from "react";

export type LegalSection = { id: string; title: string; body: ReactNode };

export const CONTACT_EMAIL = "hello@keyvaga.com";
export const LEGAL_UPDATED = "November 15, 2026";

/** Shared layout for Terms, Privacy and Cancellation policy: title, date, contents list, numbered sections. */
export function LegalDoc({ title, intro, sections }: { title: string; intro: ReactNode; sections: LegalSection[] }) {
  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-8 pt-6 sm:pt-10">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="text-sm text-ink-muted">Last updated {LEGAL_UPDATED}</p>
        <div className="text-lg leading-relaxed text-ink-muted">{intro}</div>
      </header>
      <nav aria-label="On this page" className="rounded-card border border-line bg-surface p-5">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-muted">On this page</h2>
        <ol className="grid list-decimal gap-1 pl-5 sm:grid-cols-2">
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="inline-flex min-h-9 items-center text-brand underline-offset-4 hover:underline">{s.title}</a>
            </li>
          ))}
        </ol>
      </nav>
      {sections.map((s, i) => (
        <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="flex scroll-mt-6 flex-col gap-3 leading-relaxed [&_a]:text-brand [&_a]:underline [&_a]:underline-offset-4 [&_li]:pl-1 [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-1.5 [&_ul]:pl-5">
          <h2 id={`${s.id}-h`} className="text-xl font-bold tracking-tight">
            {i + 1}. {s.title}
          </h2>
          {s.body}
        </section>
      ))}
      <p className="border-t border-line pt-6 text-ink-muted">
        Questions? Email <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand underline underline-offset-4">{CONTACT_EMAIL}</a> or visit the <a href="/help" className="text-brand underline underline-offset-4">Help center</a>.
      </p>
    </article>
  );
}
