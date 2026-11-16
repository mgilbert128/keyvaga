/**
 * Illustrations for the Hosting / Traveling switch animation, in the Keyvaga palette.
 * Animated purely with CSS classes defined in globals.css (kv-key, kv-door, kv-lid, kv-glow).
 */

function Key() {
  // Drawn pointing right with its tip at (0,0), so it can slide into a keyhole and turn around the tip.
  return (
    <g className="kv-key">
      <circle cx="-50" cy="0" r="13" fill="none" stroke="var(--kv-coral)" strokeWidth="7" />
      <rect x="-38" y="-3.5" width="40" height="7" rx="2" fill="var(--kv-coral)" />
      <rect x="-15" y="3" width="5" height="8" rx="1" fill="var(--kv-coral)" />
      <rect x="-6" y="3" width="4" height="5" rx="1" fill="var(--kv-coral)" />
    </g>
  );
}

export function HouseScene() {
  return (
    <svg viewBox="0 0 240 220" className="h-full w-full overflow-visible" aria-hidden="true">
      <ellipse cx="120" cy="196" rx="86" ry="8" fill="var(--kv-evergreen)" opacity="0.12" />
      <path d="M38 98 L120 30 L202 98 Z" fill="var(--kv-evergreen)" strokeLinejoin="round" />
      <rect x="168" y="44" width="16" height="34" fill="var(--kv-evergreen)" />
      <rect x="54" y="92" width="132" height="100" rx="6" fill="var(--kv-coastal)" />
      <rect x="70" y="112" width="28" height="26" rx="3" fill="var(--kv-mist)" />
      <rect x="142" y="112" width="28" height="26" rx="3" fill="var(--kv-mist)" />
      {/* Warm light behind the door, revealed as it swings open. */}
      <rect x="102" y="128" width="36" height="64" rx="3" fill="#ffe7c2" className="kv-glow" />
      <g className="kv-door">
        <rect x="102" y="128" width="36" height="64" rx="3" fill="var(--kv-ivory)" />
        <circle cx="120" cy="158" r="5" fill="var(--kv-coastal)" />
        <path d="M117.5 160 h5 l1.5 10 h-8 z" fill="var(--kv-coastal)" />
      </g>
      <g transform="translate(120 162)">
        <Key />
      </g>
    </svg>
  );
}

export function SuitcaseScene() {
  return (
    <svg viewBox="0 0 240 220" className="h-full w-full overflow-visible" aria-hidden="true">
      <ellipse cx="120" cy="196" rx="86" ry="8" fill="var(--kv-evergreen)" opacity="0.12" />
      {/* Light spilling out as the lid lifts. */}
      <ellipse cx="120" cy="108" rx="70" ry="14" fill="#ffe7c2" className="kv-glow" />
      <rect x="44" y="108" width="152" height="82" rx="14" fill="var(--kv-evergreen)" />
      <rect x="84" y="108" width="8" height="82" fill="var(--kv-ivory)" opacity="0.25" />
      <rect x="148" y="108" width="8" height="82" fill="var(--kv-ivory)" opacity="0.25" />
      <rect x="60" y="186" width="14" height="10" rx="3" fill="var(--kv-evergreen)" />
      <rect x="166" y="186" width="14" height="10" rx="3" fill="var(--kv-evergreen)" />
      <g className="kv-lid">
        <path d="M100 66 v-12 a8 8 0 0 1 8 -8 h24 a8 8 0 0 1 8 8 v12" fill="none" stroke="var(--kv-evergreen)" strokeWidth="8" strokeLinecap="round" />
        <rect x="44" y="66" width="152" height="44" rx="14" fill="var(--kv-coastal)" />
        <rect x="84" y="66" width="8" height="44" fill="var(--kv-ivory)" opacity="0.25" />
        <rect x="148" y="66" width="8" height="44" fill="var(--kv-ivory)" opacity="0.25" />
        <rect x="106" y="96" width="28" height="24" rx="4" fill="var(--kv-ivory)" />
        <circle cx="120" cy="105" r="4" fill="var(--kv-coastal)" />
        <path d="M118 107 h4 l1 8 h-6 z" fill="var(--kv-coastal)" />
      </g>
      <g transform="translate(120 109)">
        <Key />
      </g>
    </svg>
  );
}
