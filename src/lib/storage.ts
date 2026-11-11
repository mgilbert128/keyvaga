import "server-only";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, put } from "@vercel/blob";

/**
 * Photo storage. Uses Vercel Blob when BLOB_READ_WRITE_TOKEN is set (production),
 * otherwise a local folder for development. Keep all storage calls behind this module
 * so the provider can change (e.g. to S3 or R2) without touching the rest of the app.
 */
const LOCAL_DIR = path.join(process.cwd(), ".uploads");

export function storageMode(): "blob" | "local" | "none" {
  if (process.env.BLOB_READ_WRITE_TOKEN) return "blob";
  if (process.env.NODE_ENV !== "production" || process.env.KEYVAGA_LOCAL_UPLOADS === "true") return "local";
  return "none";
}

export async function putImage(key: string, body: Buffer, contentType: string): Promise<{ url: string; storageKey: string }> {
  const mode = storageMode();
  if (mode === "blob") {
    const blob = await put(key, body, { access: "public", contentType, addRandomSuffix: true });
    return { url: blob.url, storageKey: blob.url };
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
    if (process.env.BLOB_READ_WRITE_TOKEN) await del(storageKey);
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
