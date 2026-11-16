"use client";

import { useEffect } from "react";
import "./globals.css";

/**
 * Last-resort error screen: shown when something crashes that no closer error boundary handles.
 * It replaces the root layout, so it brings its own <html>/<body>. Reports the crash to /api/client-error.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset?: () => void }) {
  useEffect(() => {
    try {
      fetch("/api/client-error", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: error.name, message: error.message, stack: error.stack, digest: error.digest, url: window.location.href }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      // Reporting is best-effort.
    }
  }, [error]);

  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-ivory text-ink">
        <main id="main" className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-start gap-5 px-4 pb-16 pt-12 sm:px-8 sm:pt-20">
          <p className="text-sm font-semibold text-brand">Something went wrong</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Sorry, this page hit a problem</h1>
          <p className="max-w-xl text-lg text-ink-muted">
            We&apos;ve been notified and are looking into it. Your bookings and payments are safe. Try again, or head back to the home page.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => (reset ? reset() : window.location.reload())}
              className="inline-flex min-h-11 items-center rounded-full bg-brand px-5 font-semibold text-on-brand hover:bg-brand-hover"
            >
              Try again
            </button>
            {/* A plain link on purpose: the app's router may be the thing that broke. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" className="inline-flex min-h-11 items-center rounded-full px-5 font-semibold text-brand hover:bg-soft">
              Go to the home page
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
