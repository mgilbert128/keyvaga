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

/** Lowercase "keyvaga" wordmark: "key" in the brand color, "vaga" in charcoal. */
export function Wordmark({ portal }: { portal?: string }) {
  return (
    <span className="inline-flex items-center gap-2 font-brand text-2xl font-bold tracking-tight">
      <LogoMark className="h-7 w-7 text-brand" />
      <span>
        <span className="text-brand">key</span>
        <span className="text-ink">vaga</span>
      </span>
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
