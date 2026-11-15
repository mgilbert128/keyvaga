"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { buttonClass } from "@/components/ui/Button";

async function prepare(file: File) {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), "image/jpeg", 0.85));
}

/** Provider's "Add photos" button for proof of work. On phones it offers the camera. */
export function JobPhotoUploader({ jobId }: { jobId: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [, start] = useTransition();

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    const list = [...files];
    for (const [i, f] of list.entries()) {
      setBusy(`Uploading ${i + 1} of ${list.length}…`);
      try {
        const body = new FormData();
        body.set("file", await prepare(f), "photo.jpg");
        const res = await fetch(`/api/jobs/${jobId}/photos`, { method: "POST", body });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Upload failed.");
      } catch (e) {
        setError(`${f.name}: ${e instanceof Error && e.message !== "encode" ? e.message : "couldn't read this file. Try a JPEG or PNG."}`);
      }
    }
    setBusy("");
    if (input.current) input.current.value = "";
    start(() => router.refresh());
  }

  return (
    <div className="flex flex-col gap-2">
      <label className={buttonClass("secondary", busy ? "pointer-events-none self-start opacity-60" : "cursor-pointer self-start")}>
        <input ref={input} type="file" accept="image/*" multiple className="sr-only" disabled={Boolean(busy)} onChange={(e) => onFiles(e.target.files)} />
        {busy || "Add photos"}
      </label>
      {error ? <p role="alert" className="text-sm font-medium text-danger">{error}</p> : null}
    </div>
  );
}
