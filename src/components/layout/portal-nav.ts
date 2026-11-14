import type { PortalNavItem } from "./PortalShell";

const mark = (items: Omit<PortalNavItem, "current">[], current: string): PortalNavItem[] =>
  items.map((i) => ({ ...i, current: i.href === current }));

export const ownerNav = (current: string) =>
  mark(
    [
      { label: "Overview", href: "/owner" },
      { label: "Calendar", href: "/owner/calendar" },
      { label: "Listings", href: "/owner/listings" },
      { label: "Bookings", href: "/owner/bookings" },
      { label: "Pricing", href: "/owner/pricing" },
      { label: "Messages", href: "/owner/messages" },
      { label: "Payouts", href: "/owner/payouts" },
      { label: "Find services", href: "/owner/services" },
      { label: "Service jobs", href: "/owner/jobs" },
    ],
    current,
  );

export const adminNav = (current: string) => mark([{ label: "Listing reviews", href: "/admin" }], current);

export const guestNav = (current: string) =>
  mark(
    [
      { label: "Trips", href: "/trips" },
      { label: "Saved", href: "/saved" },
      { label: "Messages", href: "/messages" },
      { label: "Profile", href: "/profile" },
      { label: "Find a stay", href: "/search" },
    ],
    current,
  );

export const providerNav = (current: string) =>
  mark(
    [
      { label: "Overview", href: "/provider" },
      { label: "Jobs", href: "/provider/jobs" },
      { label: "Business profile", href: "/provider/profile" },
      { label: "Payouts", href: "/provider/payouts" },
    ],
    current,
  );
