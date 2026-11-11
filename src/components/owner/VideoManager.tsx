"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadPresigned } from "@vercel/blob/client";
import { attachVideo, removeVideo } from "@/app/actions/listings";
import { buttonClass } from "@/components/ui/Button";
import { VIDEO_MAX_BYTES, VIDEO_MAX_SECONDS, VIDEO_TYPES, isAllowedDuration, isAllowedVideoType, videoPathPrefix } from "@/lib/video";

type Props = {
  listingId: string;
  /** How uploads reach storage: straight to Vercel Blob, or through our server in development. */
  mode: "blob" | "local" | "none";
  access: "public" | "private";
  video: { src: string | null; durationSec: number | null } | null;
};

/** Reads the video's length in the browser before uploading anything. */
function readDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement("video");
    el.preload = "metadata";
    el.muted = true;
    el.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(el.duration);
    };
    el.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("unreadable"));
    };
    el.src = url;
  });
}

function guessType(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ext === "mov" ? "video/quicktime" : ext === "webm" ? "video/webm" : "video/mp4";
}

export function VideoManager({ listingId, mode, access, video }: Props) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError("");
    const type = guessType(file);
    try {
      if (!isAllowedVideoType(type)) throw new Error("Use an MP4, MOV or WebM video.");
      if (file.size > VIDEO_MAX_BYTES) throw new Error("That video is too large (max 100 MB). Try recording at a lower resolution.");
      let duration: number;
      try {
        duration = await readDuration(file);
      } catch {
        throw new Error("This browser can't read that video. Try an MP4 file, or upload from your phone.");
      }
      if (!isAllowedDuration(duration)) {
        throw new Error(`Videos can be up to ${VIDEO_MAX_SECONDS} seconds. This one is ${Math.round(duration)} seconds. Trim it in your phone's Photos app and try again.`);
      }

      setBusy(true);
      setStatus("Uploading video… 0%");
      let pathname: string;
      if (mode === "blob") {
        pathname = `${videoPathPrefix(listingId)}${crypto.randomUUID()}.${VIDEO_TYPES[type]}`;
        await uploadPresigned(pathname, file, {
          access,
          contentType: type,
          handleUploadUrl: `/api/listings/${listingId}/video/upload`,
          onUploadProgress: ({ percentage }) => setStatus(`Uploading video… ${Math.round(percentage)}%`),
        });
      } else if (mode === "local") {
        const body = new FormData();
        body.set("file", file);
        const res = await fetch(`/api/listings/${listingId}/video/local`, { method: "POST", body });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Upload failed.");
        pathname = data.pathname;
      } else {
        throw new Error("Video storage isn't set up yet.");
      }

      setStatus("Saving…");
      const result = await attachVideo(listingId, { pathname, durationSec: duration });
      if (!result.ok) throw new Error(result.error);
      setStatus("Video added.");
      startTransition(() => router.refresh());
    } catch (e) {
      setStatus("");
      setError(e instanceof Error ? e.message : "Upload failed. Please try again.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-4 border-t border-line pt-5">
      <div>
        <h3 className="text-lg font-bold">Video tour (optional)</h3>
        <p className="mt-1 text-ink-muted">One short video, up to {VIDEO_MAX_SECONDS} seconds. It plays on your stay page next to the photos.</p>
      </div>

      {video?.src ? (
        <div className="flex flex-col gap-3 sm:max-w-md">
          <video src={video.src} controls playsInline preload="metadata" className="aspect-video w-full rounded-xl bg-ink object-contain">
            Your browser can&apos;t play this video.
          </video>
          {video.durationSec ? <p className="text-sm text-ink-muted">{Math.round(video.durationSec)} seconds</p> : null}
        </div>
      ) : video ? (
        <p className="text-sm text-ink-muted">A video is saved, but its preview couldn&apos;t be loaded right now.</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <label className={buttonClass(video ? "secondary" : "primary", busy ? "pointer-events-none opacity-60" : "cursor-pointer")}>
          <input
            ref={input}
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            className="sr-only"
            disabled={busy}
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          {busy ? "Uploading…" : video ? "Replace video" : "Add a video"}
        </label>
        {video && !busy ? (
          <form
            action={removeVideo.bind(null, listingId)}
            onSubmit={(e) => {
              if (!confirm("Remove this video?")) e.preventDefault();
            }}
          >
            <button type="submit" className={buttonClass("ghost", "text-danger")}>Remove video</button>
          </form>
        ) : null}
        <p aria-live="polite" className="text-sm text-ink-muted">{status}</p>
      </div>
      {error ? <p role="alert" className="text-sm font-medium text-danger">{error}</p> : null}
    </div>
  );
}
