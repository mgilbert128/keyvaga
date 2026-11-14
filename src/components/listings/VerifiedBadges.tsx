import type { Verification } from "@/lib/documents";

/** "Verified owner/manager" and "Permit verified" badges, based on documents Keyvaga has approved. */
export function VerifiedBadges({ v, size = "md" }: { v: Verification; size?: "sm" | "md" }) {
  if (!v.host && !v.permit) return null;
  const cls = size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-sm";
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Verified by Keyvaga">
      {v.host ? (
        <li className={`inline-flex items-center gap-1 rounded-full bg-soft font-semibold text-on-soft ${cls}`} title={`Keyvaga checked this ${v.host}'s documents for this property`}>
          <span aria-hidden="true">✓</span> Verified {v.host}
        </li>
      ) : null}
      {v.permit ? (
        <li className={`inline-flex items-center gap-1 rounded-full bg-soft font-semibold text-on-soft ${cls}`} title="Keyvaga checked the short-term rental permit">
          <span aria-hidden="true">✓</span> Permit verified
        </li>
      ) : null}
    </ul>
  );
}
