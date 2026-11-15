import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/layout/SiteHeader";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Page not found" };

/** Friendly 404 with the site menu and the most useful next steps. */
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-start gap-5 px-4 pb-16 pt-12 sm:px-8 sm:pt-20">
        <p className="text-sm font-semibold text-brand">404</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">We couldn&apos;t find that page</h1>
        <p className="max-w-xl text-lg text-ink-muted">The address may be mistyped, or the page may have moved. Try one of these:</p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/">Go to the home page</ButtonLink>
          <ButtonLink href="/login" variant="secondary">Log in</ButtonLink>
          <ButtonLink href="/search" variant="ghost">Find a stay</ButtonLink>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
