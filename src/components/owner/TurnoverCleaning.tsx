import Link from "next/link";
import { ActionForm } from "@/components/owner/ActionForm";
import { SelectField } from "@/components/ui/Select";
import { setRegularCleaner } from "@/app/actions/jobs";

/** Listing editor section: choose a regular cleaner and turn on automatic turnover requests. */
export function TurnoverCleaning({ listingId, cleaners, current, auto }: { listingId: string; cleaners: { id: string; businessName: string; slug: string }[]; current: { id: string; businessName: string; slug: string; status: string } | null; auto: boolean }) {
  const options = current && !cleaners.some((c) => c.id === current.id) ? [current, ...cleaners] : cleaners;
  return (
    <section aria-labelledby="turnover-title" className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6 sm:p-8">
      <div>
        <h2 id="turnover-title" className="text-xl font-bold">Turnover cleaning</h2>
        <p className="mt-1 text-ink-muted">Pick your regular cleaner. With automatic requests on, every new booking sends them a cleaning request for checkout day. You just accept their quote. If a booking is cancelled, its cleaning is cancelled too.</p>
      </div>
      {options.length === 0 ? (
        <p className="text-ink-muted">No approved cleaners serve this property&apos;s area yet. <Link href={`/owner/services?need=cleaning&listing=${listingId}`} className="text-brand underline underline-offset-4">Find cleaners</Link></p>
      ) : (
        <ActionForm action={setRegularCleaner.bind(null, listingId)} submitLabel="Save">
          <SelectField label="Regular cleaner" id="regularCleanerId" defaultValue={current?.id ?? ""}>
            <option value="">None</option>
            {options.map((c) => <option key={c.id} value={c.id}>{c.businessName}</option>)}
          </SelectField>
          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <input type="checkbox" name="autoRequestCleaning" defaultChecked={auto} className="h-5 w-5 accent-[var(--kv-brand)]" />
            <span>Automatically request a turnover cleaning when a guest books</span>
          </label>
          {current && current.status !== "APPROVED" ? <p className="text-sm font-medium text-danger">{current.businessName} isn&apos;t taking requests right now.</p> : null}
        </ActionForm>
      )}
    </section>
  );
}
