import Link from "next/link";
import { inputClass } from "@/components/ui/Field";
import { buttonClass } from "@/components/ui/Button";
import { PROPERTY_TYPES } from "@/lib/property-types";
import { SEARCH_AMENITIES, amenityLabel } from "@/lib/amenities";
import { SORTS } from "@/lib/listings-types";

type Props = {
  raw: Record<string, string | undefined>;
  types: string[];
  amenities: string[];
  activeCount: number;
};

/**
 * Filters live in the same GET form as the main search so the URL always describes
 * the full search (shareable, back-button friendly, works without JavaScript).
 * Hidden inputs carry the top search bar's values.
 */
export function SearchFilters({ raw, types, amenities, activeCount }: Props) {
  const keep = (["where", "checkIn", "checkOut", "guests"] as const).filter((k) => raw[k]);
  const clearHref = `/search?${new URLSearchParams(Object.fromEntries(keep.map((k) => [k, raw[k]!]))).toString()}`;
  return (
    <details className="group rounded-card border border-line bg-surface open:pb-2" open={activeCount > 0}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 px-6 py-3 font-semibold [&::-webkit-details-marker]:hidden">
        <span>
          Filters{activeCount ? <span className="ml-2 rounded-full bg-soft px-2.5 py-0.5 text-sm text-on-soft">{activeCount}</span> : null}
        </span>
        <span aria-hidden="true" className="transition-transform group-open:rotate-180">▾</span>
      </summary>
      <form action="/search" method="get" className="flex flex-col gap-6 px-6 pb-4 pt-2">
        {keep.map((k) => (
          <input key={k} type="hidden" name={k} value={raw[k]} />
        ))}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="minPrice" className="text-sm font-semibold">Min price / night ($)</label>
            <input id="minPrice" name="minPrice" type="number" min={0} inputMode="numeric" defaultValue={raw.minPrice} className={inputClass} />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="maxPrice" className="text-sm font-semibold">Max price / night ($)</label>
            <input id="maxPrice" name="maxPrice" type="number" min={0} inputMode="numeric" defaultValue={raw.maxPrice} className={inputClass} />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="bedrooms" className="text-sm font-semibold">Bedrooms</label>
            <select id="bedrooms" name="bedrooms" defaultValue={raw.bedrooms ?? ""} className={inputClass}>
              <option value="">Any</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{n}+</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="sort" className="text-sm font-semibold">Sort by</label>
            <select id="sort" name="sort" defaultValue={raw.sort ?? "recommended"} className={inputClass}>
              {Object.entries(SORTS).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        <fieldset>
          <legend className="mb-3 text-sm font-semibold">Property type</legend>
          <div className="flex flex-wrap gap-2">
            {PROPERTY_TYPES.map((t) => (
              <label key={t.value} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line-strong px-4 has-[:checked]:border-brand has-[:checked]:bg-soft has-[:checked]:text-on-soft">
                <input type="checkbox" name="type" value={t.value} defaultChecked={types.includes(t.value)} className="h-4 w-4 accent-[var(--kv-brand)]" />
                {t.label}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-3 text-sm font-semibold">Amenities</legend>
          <div className="flex flex-wrap gap-2">
            {SEARCH_AMENITIES.map((a) => (
              <label key={a} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line-strong px-4 has-[:checked]:border-brand has-[:checked]:bg-soft has-[:checked]:text-on-soft">
                <input type="checkbox" name="amenity" value={a} defaultChecked={amenities.includes(a)} className="h-4 w-4 accent-[var(--kv-brand)]" />
                {amenityLabel(a)}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap gap-3">
          <button type="submit" className={buttonClass("primary")}>Show stays</button>
          {activeCount ? <Link href={clearHref} className={buttonClass("ghost")}>Clear filters</Link> : null}
        </div>
      </form>
    </details>
  );
}
