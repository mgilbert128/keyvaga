"use client";

import { Suspense, createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { HouseScene, SuitcaseScene } from "./KeyScenes";

export type Mode = "hosting" | "traveling";
type Play = (mode: Mode, href: string, before?: () => Promise<unknown>) => void;

const Ctx = createContext<Play | null>(null);

const SEEN_KEY = "kv-mode-anim-seen";
const FULL_PLAYS = 2; // after this many, a quicker version plays

function seenCount(): number {
  try {
    return Number(localStorage.getItem(SEEN_KEY) ?? 0) || 0;
  } catch {
    return FULL_PLAYS; // storage blocked: just use the quick version
  }
}
function markSeen(n: number) {
  try {
    localStorage.setItem(SEEN_KEY, String(n + 1));
  } catch {
    // ignore
  }
}

type Run = { id: number; mode: Mode; href: string; speed: "full" | "quick"; startedAt: number; exiting: boolean };

/**
 * Lives in the root layout so the animation keeps playing while the page underneath changes
 * (hosting and traveling pages use different layouts). Short, skippable, and skipped entirely
 * for people who prefer reduced motion.
 */
/** Reads the current path. Kept in its own Suspense boundary so it doesn't block prerendering of every page. */
function PathWatcher({ onPath }: { onPath: (p: string) => void }) {
  const pathname = usePathname();
  useEffect(() => onPath(pathname), [pathname, onPath]);
  return null;
}

export function ModeTransitionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pathname, setPathname] = useState("");
  const [run, setRun] = useState<Run | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const nextId = useRef(1);

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const finish = useCallback(() => {
    clear();
    setRun((r) => (r ? { ...r, exiting: true } : r));
    timers.current.push(setTimeout(() => setRun(null), 280));
  }, []);

  const play = useCallback<Play>(
    (mode, href, before) => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const go = async () => {
        await before?.().catch(() => {});
        router.push(href);
      };
      if (reduce) {
        void go();
        return;
      }
      clear();
      const n = seenCount();
      markSeen(n);
      const speed = n < FULL_PLAYS ? "full" : "quick";
      const id = nextId.current++;
      router.prefetch(href);
      setRun({ id, mode, href, speed, startedAt: Date.now(), exiting: false });
      // Start loading the new page while the key turns; the overlay lifts once it's there.
      timers.current.push(setTimeout(() => void go(), speed === "full" ? 620 : 220));
      // Never leave the overlay up if navigation is slow or fails.
      timers.current.push(setTimeout(finish, 4500));
    },
    [router, finish],
  );

  // Lift the overlay once we've arrived and the animation has had time to play.
  useEffect(() => {
    if (!run || run.exiting) return;
    const target = run.href.split("?")[0]!;
    if (pathname !== target && !pathname.startsWith(`${target}/`)) return;
    const minMs = run.speed === "full" ? 1050 : 480;
    const wait = Math.max(0, minMs - (Date.now() - run.startedAt));
    const t = setTimeout(finish, wait);
    return () => clearTimeout(t);
  }, [pathname, run, finish]);

  useEffect(() => clear, []);

  const skip = () => {
    if (!run) return;
    clear();
    router.push(run.href);
    finish();
  };

  return (
    <Ctx.Provider value={play}>
      {children}
      <Suspense fallback={null}>
        <PathWatcher onPath={setPathname} />
      </Suspense>
      {run ? (
        <div
          key={run.id}
          role="status"
          aria-live="polite"
          data-speed={run.speed}
          onClick={skip}
          className={`kv-mode-overlay fixed inset-0 z-[100] flex cursor-pointer flex-col items-center justify-center gap-4 bg-ivory ${run.exiting ? "kv-mode-exit" : "kv-mode-enter"}`}
        >
          <div className="h-48 w-52 sm:h-56 sm:w-60">{run.mode === "hosting" ? <HouseScene /> : <SuitcaseScene />}</div>
          <p className="font-brand text-xl font-bold text-evergreen">{run.mode === "hosting" ? "Switching to hosting" : "Switching to traveling"}</p>
          <span className="text-sm text-ink-muted">Tap to skip</span>
        </div>
      ) : null}
    </Ctx.Provider>
  );
}

export function useModeTransition(): Play {
  const play = useContext(Ctx);
  const router = useRouter();
  return play ?? ((_m, href, before) => void (before?.() ?? Promise.resolve()).then(() => router.push(href)));
}
