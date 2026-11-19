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
  // A little beach cottage: sun, sea-grass dune, sandy path to the door, shrubs, a palm and dune grass.
  return (
    <svg viewBox="0 0 240 220" className="h-full w-full overflow-visible" aria-hidden="true">
      {/* Sun */}
      <circle cx="200" cy="40" r="20" fill="#ffe7c2" opacity="0.85" />
      {/* Palm behind the house */}
      <path d="M34 196 C30 160 32 128 42 104" fill="none" stroke="#8a6a4a" strokeWidth="6" strokeLinecap="round" />
      <g fill="#4f8a6e">
        <path d="M42 104 C30 96 18 98 10 106 C22 100 32 102 42 108 Z" />
        <path d="M42 104 C36 90 26 84 14 84 C26 90 34 96 40 108 Z" />
        <path d="M42 104 C46 90 56 84 68 86 C56 90 48 96 44 108 Z" />
        <path d="M42 104 C54 98 66 100 72 110 C62 104 52 104 44 108 Z" />
      </g>
      {/* Dune with sea grass */}
      <path d="M0 196 Q60 176 120 184 T240 194 L240 214 Q120 222 0 214 Z" fill="#8cc3a4" />
      <path d="M0 196 Q60 176 120 184 T240 194" fill="none" stroke="#a9d6bb" strokeWidth="3" />
      {/* Roof with shingle rows and a chimney */}
      <rect x="168" y="44" width="16" height="34" fill="var(--kv-evergreen)" />
      <rect x="165" y="40" width="22" height="6" rx="2" fill="var(--kv-evergreen)" />
      <path d="M38 98 L120 30 L202 98 Z" fill="var(--kv-evergreen)" strokeLinejoin="round" />
      <g stroke="#ffffff" strokeOpacity="0.12" strokeWidth="2">
        <line x1="99" y1="48" x2="141" y2="48" />
        <line x1="78" y1="65" x2="162" y2="65" />
        <line x1="58" y1="82" x2="182" y2="82" />
      </g>
      <path d="M34 99 L120 27 L206 99" fill="none" stroke="var(--kv-ivory)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {/* Walls with siding */}
      <rect x="54" y="92" width="132" height="100" rx="6" fill="var(--kv-coastal)" />
      <g stroke="#ffffff" strokeOpacity="0.1" strokeWidth="2">
        <line x1="56" y1="104" x2="184" y2="104" />
        <line x1="56" y1="148" x2="102" y2="148" />
        <line x1="138" y1="148" x2="184" y2="148" />
        <line x1="56" y1="170" x2="102" y2="170" />
        <line x1="138" y1="170" x2="184" y2="170" />
      </g>
      {/* Windows: warm light, panes, sills and shutters */}
      {[70, 142].map((x) => (
        <g key={x}>
          <rect x={x - 6} y="110" width="6" height="30" rx="1.5" fill="var(--kv-mist)" opacity="0.7" />
          <rect x={x + 28} y="110" width="6" height="30" rx="1.5" fill="var(--kv-mist)" opacity="0.7" />
          <rect x={x} y="112" width="28" height="26" rx="3" fill="#ffe7c2" />
          <path d={`M${x + 14} 112 v26 M${x} 125 h28`} stroke="var(--kv-coastal)" strokeWidth="2.5" />
          <rect x={x - 3} y="138" width="34" height="4" rx="2" fill="var(--kv-ivory)" />
        </g>
      ))}
      {/* Porch step and sandy path to the door */}
      <path d="M104 192 L136 192 L156 216 L84 216 Z" fill="#f1dcb4" />
      <rect x="98" y="190" width="44" height="6" rx="2" fill="var(--kv-ivory)" />
      {/* Shrubs by the door */}
      <g fill="#3f7a5f">
        <circle cx="66" cy="190" r="10" />
        <circle cx="80" cy="192" r="8" />
        <circle cx="174" cy="190" r="10" />
        <circle cx="160" cy="192" r="8" />
      </g>
      <circle cx="69" cy="185" r="2.2" fill="var(--kv-coral)" />
      <circle cx="171" cy="186" r="2.2" fill="var(--kv-coral)" />
      {/* Dune grass tufts */}
      <g stroke="#4f8a6e" strokeWidth="2.5" strokeLinecap="round" fill="none">
        <path d="M200 200 q-2 -12 -8 -18 M204 200 q0 -14 2 -20 M208 200 q3 -10 9 -15" />
        <path d="M14 204 q-2 -10 -7 -15 M18 204 q1 -12 4 -17" />
      </g>
      {/* Warm light behind the door, revealed as it swings open. */}
      <rect x="102" y="128" width="36" height="64" rx="3" fill="#ffe7c2" className="kv-glow" />
      <g className="kv-door">
        <rect x="102" y="128" width="36" height="64" rx="3" fill="var(--kv-ivory)" />
        <rect x="108" y="134" width="24" height="16" rx="2" fill="none" stroke="var(--kv-mist)" strokeWidth="2" />
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
      <path d="M0 200 Q120 190 240 200 L240 216 Q120 222 0 216 Z" fill="#f1dcb4" />
      <ellipse cx="120" cy="204" rx="62" ry="6" fill="var(--kv-evergreen)" opacity="0.14" />
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
