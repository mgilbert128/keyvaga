import { addCalendarFeed, removeCalendarFeed, resetExportLink, syncCalendarNow } from "@/app/actions/calendar-sync";
import { ActionForm } from "@/components/owner/ActionForm";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { CopyField } from "./CopyField";

type Feed = { id: string; name: string; provider: string; url: string; lastSyncedAt: Date | null; lastStatus: string | null; lastError: string | null; eventCount: number };

const when = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });

const HOW_TO: { name: string; get: string; put: string }[] = [
  {
    name: "Airbnb",
    get: "Listings → your listing → Availability → Connect calendars (or Sync calendars) → Export calendar → copy the link.",
    put: "Same screen → Import calendar → paste Keyvaga's link, name it “Keyvaga”.",
  },
  {
    name: "Vrbo",
    get: "Calendar → Import & export (or the ⋯ menu → Sync calendars) → Export → copy the link.",
    put: "Same screen → Import calendar → paste Keyvaga's link, name it “Keyvaga”.",
  },
  {
    name: "Booking.com",
    get: "Extranet → Rates & Availability → Sync calendars → Add calendar connection → copy the export link.",
    put: "Same screen → import a calendar → paste Keyvaga's link.",
  },
  {
    name: "Hospitable",
    get: "Properties → your property → Calendar sync (or Channels → iCal) → copy the property's export link.",
    put: "Same screen → Add iCal / Import calendar → paste Keyvaga's link and name it “Keyvaga”.",
  },
  {
    name: "OwnerRez",
    get: "Settings → Channels → Calendar Import/Export (iCal) → choose the property → copy the export link.",
    put: "Same screen → Add a calendar import → paste Keyvaga's link and name it “Keyvaga”.",
  },
];

/** Owner calendar section: export link for other platforms + calendars to import from them. */
export function CalendarSync({ listingId, exportUrl, feeds }: { listingId: string; exportUrl: string; feeds: Feed[] }) {
  return (
    <Card className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold">Sync with Airbnb, Vrbo, Hospitable and OwnerRez</h2>
        <p className="text-ink-muted">
          Listed somewhere else too? Connect the calendars both ways so a booking on one site blocks the dates on the others. Works with Airbnb, Vrbo, Booking.com, Hospitable, OwnerRez, Google Calendar and any site with an iCal link.
        </p>
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="font-bold">1. Send Keyvaga bookings to your other sites</h3>
        <p className="text-sm text-ink-muted">Copy this link and paste it into each site&apos;s “Import calendar” box. It shows only dates (never guest names). Keep it private.</p>
        <CopyField value={exportUrl} label="Keyvaga calendar link" />
        <form action={resetExportLink.bind(null, listingId)}>
          <button type="submit" className="min-h-11 text-sm text-ink-muted underline underline-offset-4">Shared it by mistake? Make a new link (the old one stops working)</button>
        </form>
      </section>

      <section className="flex flex-col gap-3 border-t border-line pt-4">
        <h3 className="font-bold">2. Block dates booked on your other sites</h3>
        {feeds.length ? (
          <ul className="flex flex-col divide-y divide-line">
            {feeds.map((f) => (
              <li key={f.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="flex min-w-0 flex-col">
                  <span className="font-semibold">{f.name}</span>
                  <span className="truncate text-xs text-ink-muted" title={f.url}>{f.url}</span>
                  {f.lastStatus === "error" ? (
                    <span role="alert" className="text-sm font-medium text-danger">{f.lastError}</span>
                  ) : f.lastSyncedAt ? (
                    <span className="text-sm text-ink-muted">Synced {when.format(f.lastSyncedAt)} · {f.eventCount} booked or blocked period{f.eventCount === 1 ? "" : "s"}</span>
                  ) : (
                    <span className="text-sm text-ink-muted">Not synced yet</span>
                  )}
                </span>
                <form action={removeCalendarFeed.bind(null, listingId, f.id)}>
                  <Button type="submit" variant="ghost" className="text-danger">Remove</Button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">No calendars connected yet.</p>
        )}
        <ActionForm action={addCalendarFeed.bind(null, listingId)} submitLabel="Connect calendar" resetOnSuccess>
          <Field label="Calendar link from your other site" id="url" name="url" type="url" required placeholder="https://www.airbnb.com/calendar/ical/….ics" />
          <Field label="Name (optional)" id="name" name="name" maxLength={40} placeholder="e.g. Airbnb, Vrbo, OwnerRez" hint="We'll guess it from the link if you leave it blank." />
        </ActionForm>
        {feeds.length ? (
          <form action={syncCalendarNow.bind(null, listingId)}>
            <Button type="submit" variant="secondary">Sync now</Button>
          </form>
        ) : null}
        <p className="text-sm text-ink-muted">
          Keyvaga checks these calendars right before every booking, whenever guests view the listing (hourly), and daily. Other sites pull Keyvaga&apos;s link on their own schedule, usually every 1–3 hours, so a small overlap window is possible. Hospitable and OwnerRez users: they sync to all your channels from there.
        </p>
      </section>

      <details className="border-t border-line pt-4">
        <summary className="min-h-11 cursor-pointer font-semibold text-brand underline underline-offset-4">Where do I find these links?</summary>
        <ul className="mt-3 flex flex-col gap-3 text-sm">
          {HOW_TO.map((h) => (
            <li key={h.name}>
              <span className="font-semibold">{h.name}</span>
              <span className="block"><span className="font-medium">Get their link:</span> {h.get}</span>
              <span className="block"><span className="font-medium">Add Keyvaga&apos;s link:</span> {h.put}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ink-muted">Menu names change from time to time. Look for “calendar sync”, “iCal” or “export calendar”.</p>
      </details>
    </Card>
  );
}
