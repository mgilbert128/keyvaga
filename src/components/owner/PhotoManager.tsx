"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePhoto, movePhoto } from "@/app/actions/listings";
import { buttonClass } from "@/components/ui/Button";

type Photo = { id: string; url: string; alt: string };

const MAX_EDGE = 2048;

/** Shrink and re-encode in the browser: faster uploads, stays under the 4 MB limit, strips location metadata. */
async function prepare(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.85),
  );
  return { blob, width, height };
}

export function PhotoManager({ listingId, photos, children }: { listingId: string; photos: Photo[]; children?: React.ReactNode }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError("");
    const list = [...files];
    let done = 0;
    for (const file of list) {
      setStatus(`Uploading photo ${done + 1} of ${list.length}…`);
      try {
        const { blob, width, height } = await prepare(file);
        const body = new FormData();
        body.set("file", blob, "photo.jpg");
        body.set("width", String(width));
        body.set("height", String(height));
        const res = await fetch(`/api/listings/${listingId}/photos`, { method: "POST", body });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Upload failed.");
        }
        done++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Upload failed.";
        setError(`${file.name}: ${msg.includes("decode") || msg.includes("source image") ? "this file type can't be read. Try a JPEG or PNG." : msg}`);
      }
    }
    setStatus(done ? `${done} photo${done === 1 ? "" : "s"} added.` : "");
    setBusy(false);
    if (input.current) input.current.value = "";
    startTransition(() => router.refresh());
  }

  return (
    <section aria-labelledby="photos-title" className="flex flex-col gap-5 rounded-card border border-line bg-surface p-6 sm:p-8">
      <div>
        <h2 id="photos-title" className="text-xl font-bold">Photos and video</h2>
        <p className="mt-1 text-ink-muted">The first photo is the cover in search results. Add at least one to submit for review.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className={buttonClass("primary", busy ? "pointer-events-none opacity-60" : "cursor-pointer")}>
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            multiple
            className="sr-only"
            disabled={busy}
            onChange={(e) => onFiles(e.target.files)}
          />
          {busy ? "Uploading…" : "Add photos"}
        </label>
        <p aria-live="polite" className="text-sm text-ink-muted">{status}</p>
      </div>
      {error ? <p role="alert" className="text-sm font-medium text-danger">{error}</p> : null}

      {photos.length === 0 ? (
        <p className="rounded-control border border-dashed border-line-strong p-6 text-center text-ink-muted">No photos yet.</p>
      ) : (
        <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((p, i) => (
            <li key={p.id} className="flex flex-col gap-2 rounded-xl border border-line p-2">
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.alt} className="aspect-[4/3] w-full rounded-lg object-cover" loading="lazy" />
                {i === 0 ? <span className="absolute left-2 top-2 rounded-full bg-surface px-3 py-1 text-sm font-semibold">Cover</span> : null}
              </div>
              <div className="flex flex-wrap gap-1">
                {i > 0 ? (
                  <form action={movePhoto.bind(null, listingId, p.id, "cover")}>
                    <button type="submit" className={buttonClass("ghost", "px-3 text-sm")}>Make cover</button>
                  </form>
                ) : null}
                {i > 0 ? (
                  <form action={movePhoto.bind(null, listingId, p.id, "up")}>
                    <button type="submit" className={buttonClass("ghost", "px-3 text-sm")} aria-label={`Move photo ${i + 1} earlier`}>← Earlier</button>
                  </form>
                ) : null}
                {i < photos.length - 1 ? (
                  <form action={movePhoto.bind(null, listingId, p.id, "down")}>
                    <button type="submit" className={buttonClass("ghost", "px-3 text-sm")} aria-label={`Move photo ${i + 1} later`}>Later →</button>
                  </form>
                ) : null}
                <form
                  action={deletePhoto.bind(null, listingId, p.id)}
                  onSubmit={(e) => {
                    if (!confirm("Delete this photo?")) e.preventDefault();
                  }}
                  className="ml-auto"
                >
                  <button type="submit" className={buttonClass("ghost", "px-3 text-sm text-danger")} aria-label={`Delete photo ${i + 1}`}>Delete</button>
                </form>
              </div>
            </li>
          ))}
        </ol>
      )}
      {children}
    </section>
  );
}
