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
  // An upright rolling carry-on: telescoping handle, wheels, ridges and travel stickers. The key unlocks the
  // front lock, then the pull handle pops up and the case tilts back onto its wheels, ready to roll.
  return (
    <svg viewBox="0 0 240 220" className="h-full w-full overflow-visible" aria-hidden="true">
      <ellipse cx="120" cy="204" rx="70" ry="7" fill="var(--kv-evergreen)" opacity="0.12" />
      {/* Motion lines, shown as it starts to roll. */}
      <g className="kv-glow" stroke="var(--kv-coral)" strokeWidth="5" strokeLinecap="round">
        <line x1="30" y1="120" x2="54" y2="120" />
        <line x1="20" y1="142" x2="52" y2="142" />
        <line x1="34" y1="164" x2="54" y2="164" />
      </g>
      <g className="kv-tilt">
        {/* Telescoping pull handle (drawn behind the case so it slides up out of it). */}
        <g className="kv-handle">
          <rect x="100" y="22" width="40" height="12" rx="6" fill="var(--kv-evergreen)" />
          <rect x="104" y="30" width="6" height="46" rx="2" fill="#8a9aa0" />
          <rect x="130" y="30" width="6" height="46" rx="2" fill="#8a9aa0" />
        </g>
        {/* Wheels */}
        <circle cx="86" cy="196" r="8" fill="var(--kv-evergreen)" />
        <circle cx="154" cy="196" r="8" fill="var(--kv-evergreen)" />
        <circle cx="86" cy="196" r="3" fill="#8a9aa0" />
        <circle cx="154" cy="196" r="3" fill="#8a9aa0" />
        {/* Case */}
        <rect x="66" y="66" width="108" height="126" rx="16" fill="var(--kv-coastal)" />
        {/* Zipper seam and carry handle on the side */}
        <rect x="66" y="66" width="108" height="126" rx="16" fill="none" stroke="var(--kv-evergreen)" strokeOpacity="0.35" strokeWidth="3" />
        {/* Vertical ridges */}
        <rect x="84" y="80" width="6" height="98" rx="3" fill="var(--kv-ivory)" opacity="0.28" />
        <rect x="150" y="80" width="6" height="98" rx="3" fill="var(--kv-ivory)" opacity="0.28" />
        {/* Corner guards */}
        <path d="M66 86 v-4 a16 16 0 0 1 16 -16 h4" fill="none" stroke="var(--kv-evergreen)" strokeWidth="6" strokeLinecap="round" />
        <path d="M174 86 v-4 a16 16 0 0 0 -16 -16 h-4" fill="none" stroke="var(--kv-evergreen)" strokeWidth="6" strokeLinecap="round" />
        <path d="M66 172 v4 a16 16 0 0 0 16 16 h4" fill="none" stroke="var(--kv-evergreen)" strokeWidth="6" strokeLinecap="round" />
        <path d="M174 172 v4 a16 16 0 0 1 -16 16 h-4" fill="none" stroke="var(--kv-evergreen)" strokeWidth="6" strokeLinecap="round" />
        {/* Travel stickers */}
        <circle cx="100" cy="168" r="10" fill="var(--kv-coral)" />
        <path d="M95 168 l3.5 3.5 l6.5 -7" fill="none" stroke="var(--kv-ivory)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="128" y="158" width="26" height="16" rx="3" fill="#ffe7c2" transform="rotate(-10 141 166)" />
        <path d="M133 168 q4 -6 8 0 t8 0" fill="none" stroke="var(--kv-coastal)" strokeWidth="2" strokeLinecap="round" transform="rotate(-10 141 166)" />
        {/* Lock plate with keyhole */}
        <rect x="106" y="110" width="28" height="26" rx="5" fill="var(--kv-ivory)" />
        <circle cx="120" cy="120" r="4" fill="var(--kv-coastal)" />
        <path d="M118 122 h4 l1 8 h-6 z" fill="var(--kv-coastal)" />
      </g>
      <g transform="translate(120 124)">
        <Key />
      </g>
    </svg>
  );
}
