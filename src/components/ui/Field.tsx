import type { ComponentProps } from "react";

export const inputClass =
  "block min-h-12 w-full rounded-control border border-line-strong bg-surface px-4 text-base text-ink placeholder:text-ink-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";

export function Field({
  label,
  id,
  error,
  hint,
  ...props
}: ComponentProps<"input"> & { label: string; id: string; error?: string[]; hint?: string }) {
  const describedBy = [error?.length ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
      </label>
      <input id={id} name={id} className={inputClass} aria-invalid={error?.length ? true : undefined} aria-describedby={describedBy} {...props} />
      {hint ? (
        <p id={`${id}-hint`} className="text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error?.length ? (
        <p id={`${id}-error`} className="text-sm font-medium text-danger">
          {error[0]}
        </p>
      ) : null}
    </div>
  );
}
