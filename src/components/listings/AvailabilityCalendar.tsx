import { monthGrid, toISODate } from "@/lib/dates";

const monthFmt = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const dayFmt = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
const WEEKDAYS = [
  ["S", "Sunday"], ["M", "Monday"], ["T", "Tuesday"], ["W", "Wednesday"], ["T", "Thursday"], ["F", "Friday"], ["S", "Saturday"],
] as const;

type Props = {
  months: { year: number; monthIndex: number }[];
  unavailable: Set<string>;
  today: Date;
  selected?: { checkIn: Date; checkOut: Date };
};

/** Read-only availability: shows which nights are already taken. */
export function AvailabilityCalendar({ months, unavailable, today, selected }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {months.map(({ year, monthIndex }) => (
          <table key={`${year}-${monthIndex}`} className="w-full table-fixed border-collapse text-center">
            <caption className="mb-3 text-left font-bold">{monthFmt.format(new Date(Date.UTC(year, monthIndex, 1)))}</caption>
            <thead>
              <tr>
                {WEEKDAYS.map(([short, long], i) => (
                  <th key={i} scope="col" className="pb-2 text-sm font-semibold text-ink-muted">
                    <abbr title={long} className="no-underline">{short}</abbr>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthGrid(year, monthIndex).map((week, wi) => (
                <tr key={wi}>
                  {week.map((d, di) => {
                    if (!d) return <td key={di} />;
                    const iso = toISODate(d);
                    const past = d < today;
                    const taken = unavailable.has(iso);
                    const inStay = selected && d >= selected.checkIn && d < selected.checkOut;
                    const label = `${dayFmt.format(d)}: ${past ? "past" : taken ? "unavailable" : "available"}${inStay ? ", in your selected stay" : ""}`;
                    return (
                      <td key={di} className="p-0.5">
                        <span
                          aria-label={label}
                          className={[
                            "flex h-10 items-center justify-center rounded-lg text-sm",
                            past ? "text-ink-muted/60" : taken ? "bg-line text-ink-muted line-through" : "font-medium",
                            inStay ? "bg-brand !text-on-brand no-underline" : "",
                          ].join(" ")}
                        >
                          {d.getUTCDate()}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-muted" aria-label="Calendar key">
        <li className="flex items-center gap-2"><span className="inline-block h-4 w-4 rounded border border-line-strong bg-surface" aria-hidden="true" /> Available</li>
        <li className="flex items-center gap-2"><span className="inline-block h-4 w-4 rounded bg-line" aria-hidden="true" /> Unavailable</li>
        <li className="flex items-center gap-2"><span className="inline-block h-4 w-4 rounded bg-brand" aria-hidden="true" /> Your dates</li>
      </ul>
    </div>
  );
}
