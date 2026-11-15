"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";

/** Read-only link with a Copy button. */
export function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <label className="sr-only" htmlFor="copy-field">{label}</label>
      <input id="copy-field" readOnly value={value} onFocus={(e) => e.currentTarget.select()} className={`${inputClass} font-mono text-sm`} />
      <Button
        type="button"
        variant="secondary"
        className="shrink-0 whitespace-nowrap"
        onClick={async () => {
          await navigator.clipboard.writeText(value).catch(() => {});
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? "Copied ✓" : "Copy link"}
      </Button>
    </div>
  );
}
