"use client";

import { becomeHost } from "@/app/actions/mode";
import { useModeTransition, type Mode } from "./ModeTransition";

const OPTIONS: { mode: Mode; label: string; href: string }[] = [
  { mode: "traveling", label: "Traveling", href: "/trips" },
  { mode: "hosting", label: "Hosting", href: "/owner" },
];

/**
 * Traveling | Hosting toggle for signed-in users. One account does both; the first switch to hosting
 * adds the owner role. `current` is null on pages that are neither (home, search, services, admin).
 */
export function ModeSwitch({ current, isHost, onPhoto = false }: { current: Mode | null; isHost: boolean; onPhoto?: boolean }) {
  const play = useModeTransition();
  return (
    <div role="group" aria-label="Switch between traveling and hosting" className={`inline-flex rounded-full p-1 ${onPhoto ? "bg-[#0f2a35]/75 shadow-md ring-1 ring-white/30 backdrop-blur-md" : "bg-soft"}`}>
      {OPTIONS.map((o) => {
        const active = current === o.mode;
        return (
          <button
            key={o.mode}
            type="button"
            aria-pressed={active}
            onClick={() => {
              if (active) return;
              play(o.mode, o.href, o.mode === "hosting" && !isHost ? becomeHost : undefined);
            }}
            className={`min-h-9 rounded-full px-4 text-sm font-semibold transition-colors ${
              active ? (onPhoto ? "bg-white text-brand shadow-sm" : "bg-brand text-on-brand shadow-sm") : onPhoto ? "text-white hover:bg-white/15" : "text-on-soft hover:bg-white"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
