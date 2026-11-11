import { createHash, randomBytes } from "node:crypto";

export const SESSION_COOKIE = "kv_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** 256 bits of randomness, URL-safe. This value only ever lives in the user's cookie. */
export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/** What we store in the database: a one-way hash of the token. */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
