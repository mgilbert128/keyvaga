import type { PortalNavItem } from "./PortalShell";

const mark = (items: Omit<PortalNavItem, "current">[], current: string): PortalNavItem[] =>
  items.map((i) => ({ ...i, current: i.href === current }));

export const ownerNav = (current: string) =>
  mark(
    [
      { label: "Overview", href: "/owner" },
      { label: "Listings", href: "/owner/listings" },
      { label: "Bookings", href: "/owner/bookings" },
      { label: "Payouts", href: "/owner/payouts" },
      { label: "Find services", href: "/services" },
    ],
    current,
  );

export const adminNav = (current: string) => mark([{ label: "Listing reviews", href: "/admin" }], current);

export const guestNav = (current: string) =>
  mark(
    [
      { label: "Trips", href: "/trips" },
      { label: "Find a stay", href: "/search" },
    ],
    current,
  );
