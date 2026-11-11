import "server-only";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, get, put } from "@vercel/blob";

/**
 * Photo storage. Uses Vercel Blob when it is connected (production), either via
 * BLOB_STORE_ID (newer stores, signed in automatically with Vercel's OIDC token) or
 * BLOB_READ_WRITE_TOKEN (older stores),
 * otherwise a local folder for development. Keep all storage calls behind this module
 * so the provider can change (e.g. to S3 or R2) without touching the rest of the app.
 */
const LOCAL_DIR = path.join(process.cwd(), ".uploads");

/** Learned on first upload: whether the connected Blob store accepts public files. */
let blobAccess: "public" | "private" | undefined;

/** Streams a privately stored listing photo. Only listing photos are ever served. */
export async function getPrivateBlob(pathname: string) {
  if (!pathname.startsWith("listings/") || pathname.includes("..")) return null;
  const result = await get(pathname, { access: "private" });
  return result && result.statusCode === 200 ? result : null;
}

function blobConnected(): boolean {
  return Boolean(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);
}

export function storageMode(): "blob" | "local" | "none" {
  if (blobConnected()) return "blob";
  if (process.env.NODE_ENV !== "production" || process.env.KEYVAGA_LOCAL_UPLOADS === "true") return "local";
  return "none";
}

export async function putImage(key: string, body: Buffer, contentType: string): Promise<{ url: string; storageKey: string }> {
  const mode = storageMode();
  if (mode === "blob") {
    // Public stores serve photos straight from Vercel's CDN. Private stores (the newer default)
    // reject public uploads, so we fall back to private and serve through /api/photos.
    if (blobAccess !== "private") {
      try {
        const blob = await put(key, body, { access: "public", contentType, addRandomSuffix: true });
        blobAccess = "public";
        return { url: blob.url, storageKey: blob.url };
      } catch (e) {
        if (blobAccess === "public") throw e;
        console.warn("public blob upload failed, retrying as private", e instanceof Error ? e.message : e);
      }
    }
    const blob = await put(key, body, { access: "private", contentType, addRandomSuffix: true });
    blobAccess = "private";
    return { url: `/api/photos/${blob.pathname}`, storageKey: blob.url };
  }
  if (mode === "local") {
    const file = safeLocalPath(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
    return { url: `/api/uploads/${key}`, storageKey: key };
  }
  throw new Error("Photo storage is not configured. Add a Vercel Blob store to the project.");
}

export async function deleteImage(storageKey: string): Promise<void> {
  if (storageKey.startsWith("https://")) {
    if (blobConnected()) await del(storageKey);
    return;
  }
  await unlink(safeLocalPath(storageKey)).catch(() => {});
}

export async function readLocalImage(key: string): Promise<Buffer | null> {
  try {
    return await readFile(safeLocalPath(key));
  } catch {
    return null;
  }
}

function safeLocalPath(key: string): string {
  const file = path.resolve(LOCAL_DIR, key);
  if (!file.startsWith(LOCAL_DIR + path.sep)) throw new Error("Invalid storage key");
  return file;
}
