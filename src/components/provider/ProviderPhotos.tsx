"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteProviderPhoto } from "@/app/actions/provider";
import { buttonClass } from "@/components/ui/Button";

async function prepare(file: File) {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), "image/jpeg", 0.85));
  return { blob, width: canvas.width, height: canvas.height };
}

export function ProviderPhotos({ photos }: { photos: { id: string; url: string }[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [, start] = useTransition();

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError("");
    for (const f of [...files]) {
      try {
        const { blob, width, height } = await prepare(f);
        const body = new FormData();
        body.set("file", blob, "photo.jpg");
        body.set("width", String(width));
        body.set("height", String(height));
        const res = await fetch("/api/provider/photos", { method: "POST", body });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Upload failed.");
      } catch (e) {
        setError(`${f.name}: ${e instanceof Error && e.message !== "encode" ? e.message : "couldn't read this file. Try a JPEG or PNG."}`);
      }
    }
    setBusy(false);
    if (input.current) input.current.value = "";
    start(() => router.refresh());
  }

  return (
    <div className="flex flex-col gap-4">
      <label className={buttonClass("secondary", busy ? "pointer-events-none self-start opacity-60" : "cursor-pointer self-start")}>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple className="sr-only" disabled={busy} onChange={(e) => onFiles(e.target.files)} />
        {busy ? "Uploading…" : "Add photos"}
      </label>
      {error ? <p role="alert" className="text-sm font-medium text-danger">{error}</p> : null}
      {photos.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {photos.map((p, i) => (
            <li key={p.id} className="flex flex-col gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={`Work photo ${i + 1}`} className="aspect-square w-full rounded-lg object-cover" loading="lazy" />
              <form action={deleteProviderPhoto.bind(null, p.id)}>
                <button type="submit" className="min-h-11 text-sm text-danger underline underline-offset-4">Remove</button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-muted">Photos of your work, your logo or your team help owners choose you.</p>
      )}
    </div>
  );
}
