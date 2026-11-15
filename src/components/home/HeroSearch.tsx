/** Homepage search: glass panel with pill fields. Plain GET form (works without JavaScript). */
const pill = "flex min-h-12 items-center gap-2 rounded-full bg-white px-4 shadow-sm ring-1 ring-black/5 focus-within:ring-2 focus-within:ring-brand";
const input = "h-12 w-full min-w-0 bg-transparent text-base text-ink placeholder:text-ink-muted focus:outline-none";

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-brand" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const PIN = "M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z";
const CAL = "M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z";
const PEOPLE = "M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM21 19v-1a4 4 0 0 0-3-3.9M15.5 4.1a3 3 0 0 1 0 5.8";

export function HeroSearch() {
  return (
    <form action="/search" method="get" role="search" aria-label="Search stays" className="rounded-[24px] border border-white/60 bg-white/65 p-4 shadow-[0_20px_60px_-20px_rgba(18,47,58,0.55)] backdrop-blur-xl sm:p-6">
      <h2 className="mb-4 text-xl font-bold tracking-tight text-ink sm:text-2xl">Find your getaway</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_0.8fr_auto] lg:items-end">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="where" className="pl-2 text-sm font-semibold text-ink">Destination</label>
          <div className={pill}><Icon d={PIN} /><input id="where" name="where" type="search" placeholder="Town, lake or region" autoComplete="off" className={input} /></div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="checkIn" className="pl-2 text-sm font-semibold text-ink">Check in</label>
          <div className={pill}><Icon d={CAL} /><input id="checkIn" name="checkIn" type="date" className={input} /></div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="checkOut" className="pl-2 text-sm font-semibold text-ink">Check out</label>
          <div className={pill}><Icon d={CAL} /><input id="checkOut" name="checkOut" type="date" className={input} /></div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="guests" className="pl-2 text-sm font-semibold text-ink">Guests</label>
          <div className={pill}><Icon d={PEOPLE} /><input id="guests" name="guests" type="number" min={1} max={30} inputMode="numeric" placeholder="2" className={input} /></div>
        </div>
        <button type="submit" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand px-7 font-semibold text-on-brand shadow-sm hover:bg-brand-hover sm:col-span-2 lg:col-span-1">
          Search
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        </button>
      </div>
    </form>
  );
}
