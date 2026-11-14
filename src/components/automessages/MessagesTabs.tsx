import Link from "next/link";

export function MessagesTabs({ current }: { current: "inbox" | "automated" }) {
  const tab = (href: string, label: string, active: boolean) => (
    <Link href={href} aria-current={active ? "page" : undefined} className="inline-flex min-h-11 items-center rounded-full border border-line px-4 aria-[current=page]:border-brand aria-[current=page]:bg-soft aria-[current=page]:font-semibold aria-[current=page]:text-on-soft">
      {label}
    </Link>
  );
  return (
    <nav aria-label="Messages" className="flex flex-wrap gap-2">
      {tab("/owner/messages", "Inbox", current === "inbox")}
      {tab("/owner/messages/automated", "Automated messages", current === "automated")}
    </nav>
  );
}
