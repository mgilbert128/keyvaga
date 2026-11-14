"use client";

import { useId, useState } from "react";
import { estimateEarnings, HOST_FEE_PERCENT } from "@/lib/earnings";
import { inputClass } from "@/components/ui/Field";
import { formatCents } from "@/lib/money";

const num = (s: string) => {
  const n = Number(s.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};
const money = (cents: number) => formatCents(Math.round(cents / 100) * 100);

/** Interactive "What you'd keep" calculator for owners. All maths runs in the browser. */
export function KeepCalculator() {
  const id = useId();
  const [rate, setRate] = useState("200");
  const [nights, setNights] = useState("15");
  const [stay, setStay] = useState("3");
  const [cleaning, setCleaning] = useState("100");
  const [other, setOther] = useState("");

  const e = estimateEarnings({
    nightlyRateCents: Math.round(num(rate) * 100),
    nightsPerMonth: num(nights),
    avgStayNights: num(stay),
    cleaningFeeCents: Math.round(num(cleaning) * 100),
    otherPlatformFeePercent: other.trim() === "" ? null : num(other),
  });

  const field = (label: string, key: string, value: string, set: (v: string) => void, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="flex flex-col gap-1">
      <label htmlFor={`${id}-${key}`} className="text-sm font-semibold">{label}</label>
      <input id={`${id}-${key}`} value={value} onChange={(ev) => set(ev.target.value)} inputMode="decimal" className={inputClass} {...props} />
    </div>
  );

  return (
    <div className="grid grid-cols-1 gap-6 rounded-card border border-line bg-surface p-6 sm:p-8 lg:grid-cols-2">
      <form className="flex flex-col gap-4" onSubmit={(ev) => ev.preventDefault()} aria-label="Your rental">
        <div className="grid grid-cols-2 gap-4">
          {field("Nightly rate ($)", "rate", rate, setRate)}
          {field("Booked nights per month", "nights", nights, setNights, { type: "number", min: 0, max: 31, inputMode: "numeric" })}
          {field("Typical stay (nights)", "stay", stay, setStay, { type: "number", min: 1, max: 30, inputMode: "numeric" })}
          {field("Cleaning fee per stay ($)", "cleaning", cleaning, setCleaning)}
        </div>
        {field("Compare: host fee on the platform you use now (%) (optional)", "other", other, setOther, { placeholder: "e.g. your current fee" })}
        <p className="text-xs text-ink-muted">An estimate based on your numbers. Taxes, payment-processing differences and your actual bookings will vary.</p>
      </form>

      <div aria-live="polite" className="flex flex-col gap-4 rounded-control bg-soft p-6 text-on-soft">
        <div>
          <p className="text-sm font-semibold">You&apos;d keep</p>
          <p className="text-4xl font-bold tracking-tight">{money(e.keepMonthCents)}<span className="text-lg font-semibold"> / month</span></p>
          <p className="text-lg font-semibold">{money(e.keepYearCents)} a year</p>
        </div>
        <dl className="flex flex-col gap-1.5 border-t border-on-soft/20 pt-3 text-sm">
          <div className="flex justify-between gap-4"><dt>Bookings</dt><dd>{money(e.grossMonthCents)} / month</dd></div>
          <div className="flex justify-between gap-4"><dt>Keyvaga host fee ({HOST_FEE_PERCENT}%)</dt><dd>−{money(e.keyvagaFeeMonthCents)}</dd></div>
          <div className="flex justify-between gap-4"><dt>Listing or monthly fees</dt><dd>$0</dd></div>
          <div className="flex justify-between gap-4"><dt>Guests pay per {num(stay) || 1}-night stay, all-in</dt><dd>{money(e.guestPaysPerStayCents)}</dd></div>
        </dl>
        {e.extraVsOtherYearCents !== null ? (
          <p className="rounded-control bg-surface px-4 py-3 text-ink">
            {e.extraVsOtherYearCents > 0 ? (
              <>That&apos;s about <strong>{money(e.extraVsOtherYearCents)} more a year</strong> than a {num(other)}% host fee.</>
            ) : (
              <>Your current host fee is already {num(other)}%, the same or lower than Keyvaga&apos;s {HOST_FEE_PERCENT}%.</>
            )}
          </p>
        ) : null}
      </div>
    </div>
  );
}
