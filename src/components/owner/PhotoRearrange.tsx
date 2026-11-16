"use client";

import { useState } from "react";
import { reorderPhotos } from "@/app/actions/listings";
import { buttonClass } from "@/components/ui/Button";

type Photo = { id: string; url: string; alt: string };

/**
 * "Rearrange photos" mode: drag photos by their handle (mouse or touch) or use the arrow buttons,
 * then Save once. Nothing is saved until Save, so Cancel restores the original order.
 * Dragging uses pointer events rather than HTML drag-and-drop so it also works on phones.
 */
export function PhotoRearrange({ listingId, photos, onDone, onCancel }: { listingId: string; photos: Photo[]; onDone: () => void; onCancel: () => void }) {
  const [order, setOrder] = useState(photos);
  const [dragId, setDragId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [announce, setAnnounce] = useState("");
  const changed = order.some((p, i) => p.id !== photos[i]?.id);

  function moveTo(id: string, target: number) {
    const from = order.findIndex((p) => p.id === id);
    const to = Math.max(0, Math.min(order.length - 1, target));
    if (from < 0 || from === to) return;
    const next = [...order];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    setOrder(next);
    setAnnounce(`Photo moved to position ${to + 1} of ${next.length}${to === 0 ? ", now the cover" : ""}.`);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragId) return;
    const over = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-photo-id]");
    const overId = over?.dataset.photoId;
    if (!overId || overId === dragId) return;
    moveTo(dragId, order.findIndex((p) => p.id === overId));
  }

  async function save() {
    setSaving(true);
    setError("");
    const res = await reorderPhotos(listingId, order.map((p) => p.id)).catch(() => ({ ok: false, error: "Couldn't save. Check your connection and try again." }));
    setSaving(false);
    if (res.ok) onDone();
    else setError(res.error ?? "Couldn't save the new order.");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-control bg-soft p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-on-soft">
          <strong>Drag photos by the ⠿ handle</strong> or use the arrows to change the order. The first photo is your cover.
        </p>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={onCancel} disabled={saving} className={buttonClass("ghost")}>Cancel</button>
          <button type="button" onClick={save} disabled={saving || !changed} className={buttonClass("primary", !changed || saving ? "opacity-60" : "")}>
            {saving ? "Saving…" : "Save order"}
          </button>
        </div>
      </div>
      {error ? <p role="alert" className="text-sm font-medium text-danger">{error}</p> : null}
      <p aria-live="polite" className="sr-only">{announce}</p>

      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {order.map((p, i) => (
          <li
            key={p.id}
            data-photo-id={p.id}
            className={`flex flex-col gap-2 rounded-xl border bg-surface p-2 transition-shadow ${dragId === p.id ? "border-brand opacity-70 shadow-lg ring-2 ring-brand" : "border-line"}`}
          >
            <div className="relative select-none">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={p.alt} draggable={false} className="pointer-events-none aspect-[4/3] w-full rounded-lg object-cover" />
              <span className="absolute left-2 top-2 rounded-full bg-surface px-2.5 py-0.5 text-sm font-semibold shadow-sm">{i === 0 ? "Cover" : i + 1}</span>
              <button
                type="button"
                aria-label={`Drag photo ${i + 1}`}
                className="absolute right-2 top-2 flex h-11 w-11 cursor-grab touch-none items-center justify-center rounded-full bg-surface text-xl text-ink shadow-md active:cursor-grabbing"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  setDragId(p.id);
                }}
                onPointerMove={onPointerMove}
                onPointerUp={() => setDragId(null)}
                onPointerCancel={() => setDragId(null)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); moveTo(p.id, i - 1); }
                  if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); moveTo(p.id, i + 1); }
                }}
              >
                ⠿
              </button>
            </div>
            <div className="flex items-center justify-between gap-1">
              <button type="button" onClick={() => moveTo(p.id, i - 1)} disabled={i === 0} aria-label={`Move photo ${i + 1} earlier`} className={buttonClass("ghost", "min-w-11 px-2 disabled:opacity-30")}>←</button>
              {i > 0 ? (
                <button type="button" onClick={() => moveTo(p.id, 0)} className={buttonClass("ghost", "px-2 text-sm")}>Make cover</button>
              ) : null}
              <button type="button" onClick={() => moveTo(p.id, i + 1)} disabled={i === order.length - 1} aria-label={`Move photo ${i + 1} later`} className={buttonClass("ghost", "min-w-11 px-2 disabled:opacity-30")}>→</button>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
