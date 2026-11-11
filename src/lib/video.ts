/** Rules for the optional listing video tour. Pure so they can be tested and used in the browser. */
export const VIDEO_MAX_SECONDS = 20;
/** Small allowance for phones that record 20.3s when you stop at "20". */
export const VIDEO_DURATION_TOLERANCE = 0.75;
export const VIDEO_MAX_BYTES = 100 * 1024 * 1024; // 100 MB, plenty for 20s of 4K phone video

export const VIDEO_TYPES = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
} as const;
export type VideoType = keyof typeof VIDEO_TYPES;

export function isAllowedVideoType(t: string): t is VideoType {
  return t in VIDEO_TYPES;
}

export function isAllowedDuration(seconds: number): boolean {
  return Number.isFinite(seconds) && seconds > 0 && seconds <= VIDEO_MAX_SECONDS + VIDEO_DURATION_TOLERANCE;
}

export function videoPathPrefix(listingId: string): string {
  return `listings/${listingId}/video-`;
}

/** A storage pathname may only be attached to the listing whose folder it lives in. */
export function isVideoPathForListing(pathname: string, listingId: string): boolean {
  const prefix = videoPathPrefix(listingId);
  return pathname.startsWith(prefix) && /^[A-Za-z0-9._-]+$/.test(pathname.slice(prefix.length)) && !pathname.includes("..");
}

/** Detects common video containers from their first bytes. */
export function sniffVideoType(bytes: Uint8Array): VideoType | null {
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(4, 8)) === "ftyp") {
    const brand = String.fromCharCode(...bytes.slice(8, 12));
    return brand === "qt  " ? "video/quicktime" : "video/mp4";
  }
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return "video/webm";
  return null;
}
