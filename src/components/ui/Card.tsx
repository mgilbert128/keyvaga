import type { ComponentProps } from "react";

export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return <div className={`rounded-card border border-line bg-surface p-6 sm:p-8 ${className}`} {...props} />;
}

export function Chip({ tone = "soft", className = "", ...props }: ComponentProps<"span"> & { tone?: "soft" | "warn" }) {
  const toneClass = tone === "warn" ? "bg-warn-soft text-on-warn-soft" : "bg-soft text-on-soft";
  return (
    <span
      className={`inline-flex items-center rounded-full px-4 py-1.5 text-sm font-semibold ${toneClass} ${className}`}
      {...props}
    />
  );
}

export function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
  return (
    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-soft text-sm font-bold text-on-soft" aria-hidden="true">
      {initials || "?"}
    </span>
  );
}
