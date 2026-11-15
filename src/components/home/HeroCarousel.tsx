"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { HeroScene, type SceneKind } from "./HeroScene";

export type Slide =
  | { type: "photo"; src: string; alt: string; title: string; place: string; href: string | null }
  | { type: "scene"; kind: SceneKind; title: string; place: string; href: string | null };

const INTERVAL = 6500;

/**
 * Full-bleed rotating hero. Crossfades every few seconds; pauses on hover/focus and when the tab is hidden;
 * no auto-rotation for people who prefer reduced motion. Children (headline + search) sit on top.
 */
export function HeroCarousel({ slides, children }: { slides: Slide[]; children: ReactNode }) {
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
    <section
      aria-labelledby="hero-title"
      aria-roledescription="carousel"
      className="relative isolate -mx-4 overflow-hidden sm:mx-0 sm:rounded-[28px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="absolute inset-0 -z-10 bg-brand" aria-hidden={true}>
        {slides.map((s, n) => (
          <div key={n} className={`absolute inset-0 transition-opacity duration-[1200ms] ease-out ${n === i ? "opacity-100" : "opacity-0"}`}>
            {s.type === "photo" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.src} alt="" className={`h-full w-full object-cover ${n === i ? "kv-kenburns" : ""}`} loading={n === 0 ? "eager" : "lazy"} fetchPriority={n === 0 ? "high" : "auto"} decoding="async" />
            ) : (
              <HeroScene kind={s.kind} />
            )}
          </div>
        ))}
        {/* Readability: darker at the top-left for the headline and at the bottom for the caption. */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#122f3a]/80 via-[#122f3a]/35 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#122f3a]/70 via-transparent to-transparent" />
      </div>

      {children}

      {current ? (
        <div className="relative flex flex-wrap items-center justify-between gap-3 px-6 pb-5 text-sm text-white/90 sm:px-10">
          <p aria-live="polite" className="min-w-0">
            {current.href ? (
              <Link href={current.href} className="font-semibold underline-offset-4 hover:underline">{current.title}</Link>
            ) : (
              <span className="font-semibold">{current.title}</span>
            )}
            <span className="text-white/75"> · {current.place}</span>
          </p>
          {count > 1 ? (
            <div className="flex items-center gap-1" role="group" aria-label="Choose photo">
              {slides.map((s, n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setI(n)}
                  aria-label={`Show ${s.title}`}
                  aria-current={n === i}
                  className="flex h-11 w-7 items-center justify-center"
                >
                  <span className={`block h-2 rounded-full transition-all ${n === i ? "w-6 bg-white" : "w-2 bg-white/55"}`} />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
