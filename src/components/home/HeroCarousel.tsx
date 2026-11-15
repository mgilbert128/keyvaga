"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { HeroScene, type SceneKind } from "./HeroScene";

export type Slide =
  | { type: "photo"; src: string; alt: string; title: string; place: string; href: string | null; position?: string }
  | { type: "scene"; kind: SceneKind; title: string; place: string; href: string | null };

const INTERVAL = 7000;

/** Concave corner filler so the logo tab looks cut out of the photo. */
function Corner({ className }: { className: string }) {
  return <span aria-hidden="true" className={`pointer-events-none absolute h-7 w-7 bg-[radial-gradient(circle_at_100%_100%,transparent_27.5px,var(--kv-ivory)_28px)] sm:h-9 sm:w-9 sm:bg-[radial-gradient(circle_at_100%_100%,transparent_35.5px,var(--kv-ivory)_36px)] ${className}`} />;
}

/**
 * Homepage hero: rotating photos (crossfade, slow zoom) inside a large rounded card, with the logo in a tab cut
 * out of the top-left corner, the menu on the photo, and whatever `children` you pass (headline, search) on top.
 * Pauses on hover/focus and in hidden tabs; doesn't rotate for people who prefer reduced motion.
 */
export function HeroCarousel({ slides, logo, nav, children }: { slides: Slide[]; logo: ReactNode; nav: ReactNode; children: ReactNode }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;

  useEffect(() => {
    if (count < 2 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      if (!document.hidden) setI((n) => (n + 1) % count);
    }, INTERVAL);
    return () => clearInterval(t);
  }, [count, paused]);

  const current = slides[i];
  return (
    <section aria-labelledby="hero-title" className="mx-auto w-full max-w-[1440px] px-2 pt-2 sm:px-4 sm:pt-4">
      <div
        className="relative isolate flex min-h-[720px] flex-col sm:min-h-[760px]"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
      >
        <div className="absolute inset-0 -z-10 overflow-hidden rounded-[28px] bg-brand sm:rounded-[36px]" aria-hidden={true}>
          {slides.map((s, n) => (
            <div key={n} className={`absolute inset-0 transition-opacity duration-[1400ms] ease-out ${n === i ? "opacity-100" : "opacity-0"}`}>
              {s.type === "photo" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.src} alt="" style={s.position ? { objectPosition: s.position } : undefined} className={`h-full w-full object-cover ${n === i && count > 1 ? "kv-kenburns" : ""}`} loading={n === 0 ? "eager" : "lazy"} fetchPriority={n === 0 ? "high" : "auto"} decoding="async" />
              ) : (
                <HeroScene kind={s.kind} />
              )}
            </div>
          ))}
          {/* Readability: a soft shade behind the menu and headline, and toward the bottom. */}
          <div className="absolute inset-x-0 top-0 h-2/3 bg-gradient-to-b from-[#0f2a35]/55 via-[#0f2a35]/20 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0f2a35]/35 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#0f2a35]/40 to-transparent" />
        </div>

        {/* Logo tab cut out of the top-left corner. */}
        <div className="absolute left-0 top-0 z-10 rounded-br-[28px] bg-ivory py-3 pl-3 pr-5 sm:rounded-br-[36px] sm:py-5 sm:pl-6 sm:pr-9">
          {logo}
          <Corner className="left-full top-0" />
          <Corner className="left-0 top-full" />
        </div>

        <header className="relative z-10 flex min-h-[68px] items-center justify-end gap-2 px-3 pt-3 sm:min-h-[88px] sm:px-8 sm:pt-4">
          <nav aria-label="Main" className="flex flex-wrap items-center justify-end gap-1">{nav}</nav>
        </header>

        {children}
        {count <= 1 ? <div className="pb-4 sm:pb-6" /> : null}

        {current && count > 1 ? (
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 px-5 pb-4 text-sm text-white sm:px-10 sm:pb-6">
            <p aria-live="polite" className="min-w-0 drop-shadow">
              {current.href ? (
                <Link href={current.href} className="font-semibold underline-offset-4 hover:underline">{current.title}</Link>
              ) : (
                <span className="font-semibold">{current.title}</span>
              )}
              <span className="text-white/80"> · {current.place}</span>
            </p>
            {count > 1 ? (
              <div className="flex items-center" role="group" aria-label="Choose photo">
                {slides.map((s, n) => (
                  <button key={n} type="button" onClick={() => setI(n)} aria-label={`Show ${s.title}`} aria-current={n === i} className="flex h-11 w-7 items-center justify-center">
                    <span className={`block h-2 rounded-full transition-all ${n === i ? "w-6 bg-white" : "w-2 bg-white/60"}`} />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
