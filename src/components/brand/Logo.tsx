import Link from "next/link";

/** Location pin with a keyhole cut out of it. Uses currentColor so it follows the brand token. */
export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <defs>
        <mask id="kv-keyhole">
          <rect width="24" height="24" fill="white" />
          <circle cx="12" cy="9" r="2.3" fill="black" />
          <path d="M11 10.2h2l.7 4.3h-3.4z" fill="black" />
        </mask>
      </defs>
      <path
        d="M12 1.5c-4.6 0-8.3 3.6-8.3 8.2 0 5.9 7.4 12.2 7.7 12.5a.9.9 0 0 0 1.2 0c.3-.3 7.7-6.6 7.7-12.5 0-4.6-3.7-8.2-8.3-8.2z"
        fill="currentColor"
        mask="url(#kv-keyhole)"
      />
    </svg>
  );
}

const LOGO_GRAY = "#4a4a4a";
const LOGO_ORANGE = "#f26b21";

/**
 * KEYVAGA wordmark, drawn as vector strokes so it stays sharp at any size: geometric capitals in dark gray,
 * the last "A" holding an orange map pin, and an orange swoosh under "VAGA".
 */
export function KeyvagaLogo({ className = "h-7 w-auto" }: { className?: string }) {
  const s = { stroke: LOGO_GRAY, strokeWidth: 16, fill: "none", strokeLinejoin: "miter" as const, strokeMiterlimit: 10 };
  return (
    <svg viewBox="0 0 612 152" className={className} role="img" aria-label="Keyvaga">
      <g transform="translate(10 8)">
        {/* K */}
        <path d="M8 0V100" {...s} />
        <path d="M66 0L14 56M30 40L70 100" {...s} />
        {/* E */}
        <path d="M144 0H92V100H144M92 50H138" {...s} />
        {/* Y */}
        <path d="M162 0L194 50L226 0M194 50V100" {...s} />
        {/* V */}
        <path d="M238 0L274 100L310 0" {...s} />
        {/* A (no crossbar) */}
        <path d="M318 100L354 0L390 100" {...s} />
        {/* G */}
        <path d="M484 18A44 44 0 1 0 492 66H452" {...s} />
        {/* A with the map pin */}
        <path d="M506 100L542 0L578 100" {...s} />
        <path d="M542 52c-11 0-19 8-19 18 0 13 19 33 19 33s19-20 19-33c0-10-8-18-19-18z" fill={LOGO_ORANGE} />
        <circle cx="542" cy="70" r="6.5" fill="#ffffff" />
        {/* Swoosh under VAGA */}
        <path d="M244 132C330 110 420 112 470 122S560 130 588 116" stroke={LOGO_ORANGE} strokeWidth="7" strokeLinecap="round" fill="none" />
      </g>
    </svg>
  );
}

/** The site logo, with an optional portal name beside it ("· Owner"). */
export function Wordmark({ portal }: { portal?: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <KeyvagaLogo className="h-8 w-auto" />
      {portal ? (
        <span className="font-sans text-lg font-semibold text-brand">
          <span aria-hidden="true">· </span>
          {portal}
        </span>
      ) : null}
    </span>
  );
}

export function HomeLogoLink({ portal, href = "/" }: { portal?: string; href?: string }) {
  return (
    <Link href={href} className="inline-flex min-h-11 items-center rounded-control" aria-label={portal ? `Keyvaga ${portal} home` : "Keyvaga home"}>
      <Wordmark portal={portal} />
    </Link>
  );
}
