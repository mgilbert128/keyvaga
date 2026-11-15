import Link from "next/link";
import { Suspense } from "react";
import { HomeLogoLink } from "@/components/brand/Logo";
import { UserMenu, UserMenuFallback } from "./UserMenu";

const navLink = "inline-flex min-h-11 items-center rounded-control px-3 text-base text-ink hover:bg-soft";

export function SiteHeader() {
  return (
    <header className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <HomeLogoLink />
        <nav aria-label="Main" className="flex flex-wrap items-center gap-x-1 gap-y-1">
          <Link href="/search" className={navLink}>
            Stays
          </Link>
          <Link href="/list-your-property" className={navLink}>
            List your property
          </Link>
          <Suspense fallback={<UserMenuFallback />}>
            <UserMenu />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const year = 2026;
  return (
    <footer className="mt-auto bg-evergreen text-ivory">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-ivory/85 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>© {year} Keyvaga. Your key to the ultimate vacation getaway.</p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-2">
          <Link href="/search" className="inline-flex min-h-11 items-center px-2 hover:text-white hover:underline underline-offset-4 focus-visible:outline-mist">Stays</Link>
          <Link href="/list-your-property" className="inline-flex min-h-11 items-center px-2 hover:text-white hover:underline underline-offset-4 focus-visible:outline-mist">List your property</Link>
          <Link href="/signup?intent=PROVIDER" className="inline-flex min-h-11 items-center px-2 hover:text-white hover:underline underline-offset-4 focus-visible:outline-mist">Offer your services</Link>
          <Link href="/help" className="inline-flex min-h-11 items-center px-2 hover:text-white hover:underline underline-offset-4 focus-visible:outline-mist">Help</Link>
          <Link href="/terms" className="inline-flex min-h-11 items-center px-2 hover:text-white hover:underline underline-offset-4 focus-visible:outline-mist">Terms</Link>
          <Link href="/privacy" className="inline-flex min-h-11 items-center px-2 hover:text-white hover:underline underline-offset-4 focus-visible:outline-mist">Privacy</Link>
          <Link href="/cancellation-policy" className="inline-flex min-h-11 items-center px-2 hover:text-white hover:underline underline-offset-4 focus-visible:outline-mist">Cancellations</Link>
        </nav>
      </div>
    </footer>
  );
}
