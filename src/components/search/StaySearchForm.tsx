import { inputClass } from "@/components/ui/Field";
import { buttonClass } from "@/components/ui/Button";

type Defaults = { where?: string; checkIn?: string; checkOut?: string; guests?: string };

/** Plain GET form: works without JavaScript and produces shareable search URLs. */
export function StaySearchForm({ defaults = {} }: { defaults?: Defaults }) {
  return (
    <form action="/search" method="get" role="search" aria-label="Search stays" className="rounded-card border border-line bg-surface p-6 sm:p-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] lg:items-end">
        <div className="flex flex-col gap-2">
          <label htmlFor="where" className="text-sm font-semibold">Where</label>
          <input id="where" name="where" type="search" placeholder="Search destinations" defaultValue={defaults.where} className={inputClass} autoComplete="off" />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="checkIn" className="text-sm font-semibold">Check in</label>
          <input id="checkIn" name="checkIn" type="date" defaultValue={defaults.checkIn} className={inputClass} />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="checkOut" className="text-sm font-semibold">Check out</label>
          <input id="checkOut" name="checkOut" type="date" defaultValue={defaults.checkOut} className={inputClass} />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="guests" className="text-sm font-semibold">Guests</label>
          <input id="guests" name="guests" type="number" min={1} max={30} inputMode="numeric" placeholder="Add guests" defaultValue={defaults.guests} className={inputClass} />
        </div>
        <button type="submit" className={buttonClass("primary", "min-h-12 w-full sm:col-span-2 lg:col-span-1 lg:w-auto")}>
          Search stays
        </button>
      </div>
    </form>
  );
}
