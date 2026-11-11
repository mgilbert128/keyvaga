import { inputClass } from "@/components/ui/Field";
import { buttonClass } from "@/components/ui/Button";

/** Plain GET form to switch which listing a page shows. Works without JavaScript. */
export function ListingPicker({ listings, current, action, extra }: { listings: { id: string; title: string }[]; current: string; action: string; extra?: Record<string, string> }) {
  if (listings.length <= 1) return null;
  return (
    <form action={action} method="get" className="flex flex-wrap items-end gap-3">
      {Object.entries(extra ?? {}).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <div className="flex flex-col gap-2">
        <label htmlFor="listing" className="text-sm font-semibold">Listing</label>
        <select id="listing" name="listing" defaultValue={current} className={inputClass}>
          {listings.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
        </select>
      </div>
      <button type="submit" className={buttonClass("secondary")}>Show</button>
    </form>
  );
}
