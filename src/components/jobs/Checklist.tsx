import { deleteJobPhoto, toggleChecklistItem } from "@/app/actions/jobs";
import { completionBlockers } from "@/lib/checklist";
import { JobPhotoUploader } from "./JobPhotoUploader";

type Item = { id: string; label: string; doneAt: Date | null };
type Photo = { id: string; caption: string; createdAt: Date };

const time = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });

function PhotoGrid({ photos, removable }: { photos: Photo[]; removable?: boolean }) {
  if (!photos.length) return null;
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {photos.map((p, i) => (
        <li key={p.id} className="flex flex-col gap-1">
          <a href={`/api/job-photos/${p.id}`} target="_blank" rel="noopener">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/job-photos/${p.id}`} alt={p.caption || `Proof photo ${i + 1}`} className="aspect-square w-full rounded-lg object-cover" loading="lazy" />
          </a>
          <span className="text-xs text-ink-muted">{time.format(p.createdAt)}</span>
          {removable ? (
            <form action={deleteJobPhoto.bind(null, p.id)}>
              <button type="submit" className="min-h-11 text-sm text-danger underline underline-offset-4">Remove</button>
            </form>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** What a cleaner sees before hiring: the list of what's included. */
export function ChecklistPreview({ items, minPhotos }: { items: Item[]; minPhotos: number }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-lg font-bold">Cleaning checklist</h2>
      <ul className="list-disc pl-5 text-sm">
        {items.map((i) => <li key={i.id}>{i.label}</li>)}
      </ul>
      {minPhotos ? <p className="text-sm text-ink-muted">The owner asks for at least {minPhotos} photo{minPhotos === 1 ? "" : "s"} when you finish.</p> : null}
    </div>
  );
}

/** Hired cleaner works through the checklist and adds photos. */
export function ChecklistWork({ jobId, items, photos, minPhotos }: { jobId: string; items: Item[]; photos: Photo[]; minPhotos: number }) {
  if (!items.length && !minPhotos) return null;
  const done = items.filter((i) => i.doneAt).length;
  const blockers = completionBlockers({ items, photoCount: photos.length, minPhotos });
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-bold">Checklist</h2>
        <span className="text-sm font-semibold text-ink-muted">{done} of {items.length} done</span>
      </div>
      <ul className="flex flex-col divide-y divide-line">
        {items.map((i) => (
          <li key={i.id}>
            <form action={toggleChecklistItem.bind(null, jobId, i.id, !i.doneAt)}>
              <button type="submit" aria-pressed={Boolean(i.doneAt)} className="flex min-h-12 w-full items-center gap-3 py-2 text-left">
                <span aria-hidden="true" className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 ${i.doneAt ? "border-brand bg-brand text-white" : "border-line-strong"}`}>{i.doneAt ? "✓" : ""}</span>
                <span className={i.doneAt ? "text-ink-muted line-through" : ""}>{i.label}</span>
              </button>
            </form>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-3 border-t border-line pt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-lg font-bold">Photos</h3>
          <span className="text-sm font-semibold text-ink-muted">{photos.length}{minPhotos ? ` of ${minPhotos} required` : ""}</span>
        </div>
        <p className="text-sm text-ink-muted">Take a photo of each room when it&apos;s finished: beds made, bathrooms, kitchen, living area. Only the owner sees them.</p>
        <JobPhotoUploader jobId={jobId} />
        <PhotoGrid photos={photos} removable />
      </div>
      {blockers.length ? <p className="rounded-control bg-warn-soft px-4 py-3 text-sm font-medium text-on-warn-soft">Before you can mark it done: {blockers.join(" and ")}.</p> : <p className="rounded-control bg-soft px-4 py-3 text-sm font-medium text-on-soft">All set. You can mark the job as done.</p>}
    </div>
  );
}

/** Owner / admin view of the finished (or in-progress) checklist and photos. */
export function ChecklistReview({ items, photos, minPhotos }: { items: Item[]; photos: Photo[]; minPhotos: number }) {
  if (!items.length && !photos.length) return null;
  const done = items.filter((i) => i.doneAt).length;
  return (
    <div className="flex flex-col gap-4">
      {items.length ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-bold">Cleaning checklist</h2>
            <span className="text-sm font-semibold text-ink-muted">{done} of {items.length} done</span>
          </div>
          <ul className="flex flex-col divide-y divide-line">
            {items.map((i) => (
              <li key={i.id} className="flex items-start justify-between gap-3 py-2">
                <span className="flex items-start gap-3">
                  <span aria-hidden="true" className={i.doneAt ? "font-bold text-brand" : "text-ink-muted"}>{i.doneAt ? "✓" : "○"}</span>
                  <span>{i.label}</span>
                </span>
                <span className="shrink-0 text-xs text-ink-muted">{i.doneAt ? time.format(i.doneAt) : "Not yet"}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-bold">Photos ({photos.length}{minPhotos ? ` of ${minPhotos}` : ""})</h3>
        {photos.length ? <PhotoGrid photos={photos} /> : <p className="text-sm text-ink-muted">No photos yet.</p>}
      </div>
    </div>
  );
}
