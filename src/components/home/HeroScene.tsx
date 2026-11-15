/** Illustrated getaway scenes in the Keyvaga palette, used when there are no hero photos yet. */
export type SceneKind = "coast" | "lake" | "mountain" | "city";

export function HeroScene({ kind }: { kind: SceneKind }) {
  return (
    <svg viewBox="0 0 1200 640" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`sky-${kind}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={kind === "city" ? "#20566a" : "#2b6a80"} />
          <stop offset="0.55" stopColor="#83b8c7" />
          <stop offset="1" stopColor="#f6f4ef" />
        </linearGradient>
        <linearGradient id={`water-${kind}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#83b8c7" />
          <stop offset="1" stopColor="#20566a" />
        </linearGradient>
      </defs>
      <rect width="1200" height="640" fill={`url(#sky-${kind})`} />
      <circle cx={kind === "city" ? 930 : 860} cy={kind === "coast" ? 300 : 230} r="70" fill="#e99583" opacity="0.9" />
      {kind === "coast" ? (
        <>
          <path d="M0 360 C200 340 400 380 600 360 S1000 340 1200 360 V640 H0 Z" fill={`url(#water-${kind})`} />
          <path d="M0 420 C150 410 300 440 450 425 S750 410 900 430 S1100 445 1200 430" stroke="#f6f4ef" strokeOpacity="0.5" strokeWidth="3" fill="none" />
          <path d="M0 470 C180 455 360 490 540 470 S900 455 1200 480" stroke="#f6f4ef" strokeOpacity="0.35" strokeWidth="3" fill="none" />
          <path d="M0 520 C220 480 420 500 560 540 C640 565 700 640 700 640 H0 Z" fill="#efe2d3" />
          <g fill="#243d38">
            <rect x="120" y="430" width="150" height="80" rx="4" />
            <path d="M105 435 L195 380 L285 435 Z" />
            <rect x="170" y="470" width="30" height="40" fill="#f6f4ef" />
            <rect x="215" y="450" width="35" height="25" fill="#83b8c7" />
          </g>
          <path d="M330 520 C335 470 345 430 370 400" stroke="#243d38" strokeWidth="8" fill="none" strokeLinecap="round" />
          <path d="M370 400 C340 395 315 405 300 420 M370 400 C395 385 420 390 435 405 M370 400 C365 375 375 355 395 345" stroke="#243d38" strokeWidth="7" fill="none" strokeLinecap="round" />
        </>
      ) : null}
      {kind === "lake" || kind === "mountain" ? (
        <>
          <path d="M0 380 L180 210 L300 320 L470 150 L650 340 L800 230 L1000 360 L1200 260 V420 H0 Z" fill="#20566a" opacity="0.55" />
          <path d="M0 410 L140 300 L260 380 L420 260 L600 400 L760 320 L940 410 L1100 330 L1200 380 V460 H0 Z" fill="#243d38" />
          <path d="M470 150 L430 190 L470 180 L510 195 Z M180 210 L150 240 L185 232 L210 240 Z" fill="#f6f4ef" opacity="0.85" />
          {kind === "lake" ? (
            <>
              <rect y="455" width="1200" height="185" fill={`url(#water-${kind})`} />
              <path d="M200 500 H420 M560 540 H860 M300 590 H520" stroke="#f6f4ef" strokeOpacity="0.45" strokeWidth="3" />
              <rect x="700" y="470" width="260" height="8" fill="#5a4a3c" />
              <path d="M720 478 V520 M780 478 V520 M840 478 V520 M900 478 V520 M950 478 V520" stroke="#5a4a3c" strokeWidth="6" />
              <g fill="#efe2d3">
                <rect x="760" y="395" width="140" height="62" rx="4" />
                <path d="M745 400 L830 352 L915 400 Z" fill="#e99583" />
                <rect x="815" y="420" width="26" height="37" fill="#243d38" />
              </g>
            </>
          ) : (
            <>
              <path d="M0 460 C300 430 600 470 900 445 S1100 440 1200 450 V640 H0 Z" fill="#d5e6e1" />
              {[80, 160, 240, 980, 1060, 1140].map((x, i) => (
                <path key={x} d={`M${x} ${520 + (i % 2) * 20} l30 -80 l30 80 Z`} fill="#243d38" />
              ))}
              <g>
                <rect x="520" y="470" width="180" height="90" rx="4" fill="#5a4a3c" />
                <path d="M500 478 L610 405 L720 478 Z" fill="#243d38" />
                <rect x="590" y="505" width="34" height="55" fill="#e99583" />
                <rect x="540" y="495" width="34" height="28" fill="#f6f4ef" opacity="0.9" />
                <rect x="645" y="495" width="34" height="28" fill="#f6f4ef" opacity="0.9" />
              </g>
            </>
          )}
        </>
      ) : null}
      {kind === "city" ? (
        <>
          <g fill="#243d38">
            {[[40, 260, 110], [160, 200, 90], [260, 300, 120], [390, 150, 100], [500, 240, 130], [640, 180, 90], [740, 280, 140], [890, 210, 100], [1000, 260, 90], [1100, 190, 110]].map(([x, y, w]) => (
              <rect key={x} x={x} y={y} width={w} height={640 - y!} />
            ))}
          </g>
          <g fill="#f6f4ef" opacity="0.75">
            {Array.from({ length: 60 }, (_, i) => {
              const cols = [55, 175, 280, 405, 520, 655, 760, 905, 1015, 1115];
              const x = cols[i % 10]! + ((i * 7) % 40);
              const y = 330 + Math.floor(i / 10) * 45;
              return <rect key={i} x={x} y={y} width="16" height="22" />;
            })}
          </g>
          <rect y="560" width="1200" height="80" fill={`url(#water-${kind})`} />
        </>
      ) : null}
    </svg>
  );
}
