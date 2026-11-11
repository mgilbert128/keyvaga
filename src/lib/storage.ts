import "server-only";
import { mkdir, open, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, get, head, issueSignedToken, presignUrl, put } from "@vercel/blob";

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


// ---------- Video ----------

/**
 * Access level for files uploaded directly from the browser (videos). Newer Vercel Blob stores
 * connected with BLOB_STORE_ID are private; older token-based stores are usually public.
 * KEYVAGA_BLOB_ACCESS overrides the guess if needed.
 */
export function blobUploadAccess(): "public" | "private" {
  const override = process.env.KEYVAGA_BLOB_ACCESS;
  if (override === "public" || override === "private") return override;
  return process.env.BLOB_STORE_ID ? "private" : "public";
}

/** Short-lived permission for the browser to upload one file to exactly this pathname. */
export async function issueUploadToken(pathname: string, opts: { allowedContentTypes: string[]; maximumSizeInBytes: number }) {
  return issueSignedToken({
    pathname,
    operations: ["put"],
    validUntil: Date.now() + 15 * 60 * 1000,
    allowedContentTypes: opts.allowedContentTypes,
    maximumSizeInBytes: opts.maximumSizeInBytes,
  });
}

/** Confirms an uploaded blob exists and returns its size and type. */
export async function describeBlob(pathname: string) {
  const info = await head(pathname);
  return { size: info.size, contentType: info.contentType, url: info.url };
}

/** URL a browser can play. Private stores get a signed link valid for a few hours. */
export async function playableUrl(v: { key: string; url: string | null; access: string | null }): Promise<string | null> {
  if (v.access !== "private") return v.url;
  try {
    const validUntil = Date.now() + 6 * 60 * 60 * 1000;
    const token = await issueSignedToken({ pathname: v.key, operations: ["get"], validUntil });
    const { presignedUrl } = await presignUrl(token, { operation: "get", pathname: v.key, access: "private", validUntil });
    return presignedUrl;
  } catch (e) {
    console.error("could not sign video url", e);
    return null;
  }
}

export async function deleteStored(key: string, access: string | null) {
  if (access === "local") {
    await unlink(safeLocalPath(key)).catch(() => {});
    return;
  }
  if (blobConnected()) await del(key).catch((e) => console.error("delete from storage failed", e));
}

export async function putLocalFile(key: string, body: Buffer): Promise<string> {
  const file = safeLocalPath(key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body);
  return `/api/uploads/${key}`;
}

export async function statLocalFile(key: string): Promise<number | null> {
  try {
    return (await stat(safeLocalPath(key))).size;
  } catch {
    return null;
  }
}

export async function readLocalRange(key: string, start: number, end: number): Promise<Buffer> {
  const fh = await open(safeLocalPath(key), "r");
  try {
    const buf = Buffer.alloc(end - start + 1);
    await fh.read(buf, 0, buf.length, start);
    return buf;
  } finally {
    await fh.close();
  }
}

// ---------- Private documents (deeds, licenses) ----------

const PRIVATE_DIR = path.join(process.cwd(), ".private-uploads");

function safePrivatePath(key: string): string {
  const file = path.resolve(PRIVATE_DIR, key);
  if (!file.startsWith(PRIVATE_DIR + path.sep)) throw new Error("Invalid storage key");
  return file;
}

/**
 * Stores a verification document. Always PRIVATE: in Vercel Blob it uses private access (a public store
 * is refused rather than exposing documents); locally it uses a folder no route serves directly.
 */
export async function putPrivateDocument(key: string, body: Buffer, contentType: string): Promise<string> {
  const mode = storageMode();
  if (mode === "blob") {
    const blob = await put(key, body, { access: "private", contentType, addRandomSuffix: true });
    return blob.pathname;
  }
  if (mode === "local") {
    const file = safePrivatePath(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
    return key;
  }
  throw new Error("Document storage is not configured.");
}

export async function readPrivateDocument(key: string): Promise<ReadableStream<Uint8Array> | Uint8Array | null> {
  if (storageMode() === "blob") {
    const result = await get(key, { access: "private", useCache: false });
    return result && result.statusCode === 200 ? result.stream : null;
  }
  try {
    return new Uint8Array(await readFile(safePrivatePath(key)));
  } catch {
    return null;
  }
}

export async function deletePrivateDocument(key: string) {
  if (storageMode() === "blob") {
    await del(key).catch((e) => console.error("document delete failed", e));
    return;
  }
  await unlink(safePrivatePath(key)).catch(() => {});
}
