"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteDocument } from "@/app/actions/documents";
import { buttonClass } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";

type Doc = { id: string; fileName: string; status: "PENDING" | "APPROVED" | "REJECTED"; reviewNote: string | null; documentNumber: string; expiresAt: string | null; expired: boolean; expiringSoon: boolean; uploadedAt: string };

const STATUS: Record<Doc["status"], { label: string; cls: string }> = {
  PENDING: { label: "Waiting for review", cls: "bg-warn-soft text-on-warn-soft" },
  APPROVED: { label: "Approved", cls: "bg-soft text-on-soft" },
  REJECTED: { label: "Needs a new upload", cls: "bg-danger/10 text-danger" },
};

/** Shrinks big phone photos so documents stay legible but under the 4 MB upload limit. */
async function shrinkImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.size < 1.5 * 1024 * 1024) return file;
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.88));
}

export function DocumentSlot({
  listingId, type, label, help, needsNumber, needsExpiry, doc, defaultNumber,
}: {
  listingId: string; type: string; label: string; help: string; needsNumber: boolean; needsExpiry: boolean; doc: Doc | null; defaultNumber?: string;
}) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const showUpload = !doc || doc.status === "REJECTED" || doc.expired || doc.expiringSoon;
  const id = (s: string) => `${type}-${s}`;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    const file = fd.get("file");
    if (!(file instanceof File) || !file.size) return setError("Choose a file to upload.");
    setBusy(true);
    try {
      const body = new FormData();
      const blob = await shrinkImage(file);
      body.set("file", blob, blob === file ? file.name : file.name.replace(/\.\w+$/, "") + ".jpg");
      body.set("type", type);
      body.set("documentNumber", String(fd.get("documentNumber") ?? ""));
      body.set("expiresAt", String(fd.get("expiresAt") ?? ""));
      const res = await fetch(`/api/listings/${listingId}/documents`, { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");
      form.current?.reset();
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-control border border-line p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-bold">{label}</h3>
          <p className="text-sm text-ink-muted">{help}</p>
        </div>
        {doc ? <span className={`rounded-full px-3 py-1 text-sm font-semibold ${doc.expired ? "bg-danger/10 text-danger" : STATUS[doc.status].cls}`}>{doc.expired ? "Expired" : STATUS[doc.status].label}</span> : <span className="rounded-full bg-line px-3 py-1 text-sm font-semibold">Not uploaded</span>}
      </div>

      {doc ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <a href={`/api/documents/${doc.id}`} target="_blank" rel="noopener" className="font-semibold text-brand underline underline-offset-4">{doc.fileName}</a>
          {doc.documentNumber ? <span>No. {doc.documentNumber}</span> : null}
          {doc.expiresAt ? <span className={doc.expired || doc.expiringSoon ? "font-semibold text-danger" : ""}>Expires {doc.expiresAt}</span> : null}
          <span className="text-ink-muted">Uploaded {doc.uploadedAt}</span>
          {doc.status !== "APPROVED" ? (
            <form action={deleteDocument.bind(null, listingId, doc.id)} onSubmit={(e) => { if (!confirm("Remove this document?")) e.preventDefault(); }}>
              <button type="submit" className="min-h-11 px-2 text-danger underline underline-offset-4">Remove</button>
            </form>
          ) : null}
        </div>
      ) : null}
      {doc?.status === "REJECTED" && doc.reviewNote ? <p role="note" className="rounded-control bg-danger/5 px-3 py-2 text-sm text-danger">Keyvaga: {doc.reviewNote}</p> : null}
      {doc?.expiringSoon && !doc.expired ? <p className="text-sm font-medium text-danger">This expires soon. Upload the renewed document to keep your listing live.</p> : null}

      {showUpload ? (
        <form ref={form} onSubmit={onSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1 sm:col-span-3">
              <label htmlFor={id("file")} className="text-sm font-semibold">File (PDF or photo, up to 4 MB)</label>
              <input id={id("file")} name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif" required className="block min-h-11 w-full text-sm file:mr-3 file:min-h-11 file:rounded-control file:border-0 file:bg-soft file:px-4 file:font-semibold file:text-on-soft" />
            </div>
            {needsNumber ? (
              <div className="flex flex-col gap-1">
                <label htmlFor={id("num")} className="text-sm font-semibold">License / permit number</label>
                <input id={id("num")} name="documentNumber" required maxLength={60} defaultValue={defaultNumber} className={inputClass} />
              </div>
            ) : null}
            {needsExpiry ? (
              <div className="flex flex-col gap-1">
                <label htmlFor={id("exp")} className="text-sm font-semibold">Expiration date</label>
                <input id={id("exp")} name="expiresAt" type="date" required className={inputClass} />
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={busy} className={buttonClass(doc ? "secondary" : "primary")}>{busy ? "Uploading…" : doc ? "Upload a new version" : "Upload"}</button>
            {error ? <p role="alert" className="text-sm font-medium text-danger">{error}</p> : null}
          </div>
        </form>
      ) : null}
    </div>
  );
}
