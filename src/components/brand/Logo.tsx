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

/**
 * The KEYVAGA logo (gray capitals, orange map pin in the last A, orange swoosh), from the founder's artwork.
 * File: public/brand/keyvaga-logo.webp (transparent background; PNG copy beside it). 1200 x 261.
 */
export function KeyvagaLogo({ className = "h-8 w-auto" }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/keyvaga-logo.webp" alt="Keyvaga" width={1200} height={261} className={className} decoding="async" fetchPriority="high" />;
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
