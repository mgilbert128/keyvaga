import Link from "next/link";
import type { ReactNode } from "react";
import { HomeLogoLink } from "@/components/brand/Logo";
import { Avatar } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { logout } from "@/app/actions/auth";
import type { CurrentUser } from "@/lib/auth/dal";

export type PortalNavItem = { label: string; href: string; current?: boolean };

/** Shared frame for the guest, owner, provider and admin portals. */
export function PortalShell({
  portal,
  user,
  nav,
  children,
}: {
  portal?: string;
  user: CurrentUser;
  nav: PortalNavItem[];
  children: ReactNode;
}) {
  return (
    <>
      <header className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <HomeLogoLink portal={portal} />
          <div className="flex items-center gap-2">
            {user.roles.includes("ADMIN") && portal !== "Admin" ? (
              <Link href="/admin" className="inline-flex min-h-11 items-center rounded-control px-3 text-base text-ink hover:bg-soft">
                Admin
              </Link>
            ) : null}
            {portal === "Admin" && user.roles.includes("OWNER") ? (
              <Link href="/owner" className="inline-flex min-h-11 items-center rounded-control px-3 text-base text-ink hover:bg-soft">
                Owner portal
              </Link>
            ) : null}
            <form action={logout}>
              <Button type="submit" variant="ghost">Log out</Button>
            </form>
            <Avatar name={user.name} />
          </div>
        </div>
        <nav aria-label={`${portal ?? "Guest"} portal`} className="mt-3 -mx-1 flex gap-1 overflow-x-auto pb-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={item.current ? "page" : undefined}
              className="inline-flex min-h-11 shrink-0 items-center rounded-control px-4 text-base text-ink hover:bg-soft aria-[current=page]:bg-soft aria-[current=page]:font-semibold aria-[current=page]:text-on-soft"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 sm:px-8">
        {children}
      </main>
    </>
  );
}

export function ComingSoon({ items }: { items: string[] }) {
  return (
    <div className="rounded-card border border-dashed border-line-strong bg-surface p-6 sm:p-8">
      <h2 className="text-lg font-bold">Coming in the next build phases</h2>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-ink-muted">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}
