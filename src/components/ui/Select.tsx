import type { ComponentProps } from "react";
import { inputClass } from "./Field";

export function SelectField({
  label,
  id,
  error,
  children,
  ...props
}: ComponentProps<"select"> & { label: string; id: string; error?: string[] }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      <select id={id} name={id} className={`${inputClass} appearance-auto`} aria-invalid={error?.length ? true : undefined} aria-describedby={error?.length ? `${id}-error` : undefined} {...props}>
        {children}
      </select>
      {error?.length ? <p id={`${id}-error`} className="text-sm font-medium text-danger">{error[0]}</p> : null}
    </div>
  );
}

export function TextAreaField({
  label,
  id,
  error,
  hint,
  ...props
}: ComponentProps<"textarea"> & { label: string; id: string; error?: string[]; hint?: string }) {
  const describedBy = [error?.length ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      <textarea id={id} name={id} className={`${inputClass} min-h-32 py-3`} aria-invalid={error?.length ? true : undefined} aria-describedby={describedBy} {...props} />
      {hint ? <p id={`${id}-hint`} className="text-sm text-ink-muted">{hint}</p> : null}
      {error?.length ? <p id={`${id}-error`} className="text-sm font-medium text-danger">{error[0]}</p> : null}
    </div>
  );
}
