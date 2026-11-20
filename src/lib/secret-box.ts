import "server-only";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

/**
 * Encrypts small secrets we must store (e.g. an owner's PriceLabs API key) with AES-256-GCM.
 * The key comes from INTEGRATIONS_SECRET, or if that isn't set, is derived from CRON_SECRET.
 * Changing whichever one is in use makes saved secrets unreadable: owners would need to reconnect.
 */
function key(): Buffer {
  const base = process.env.INTEGRATIONS_SECRET || process.env.CRON_SECRET;
  if (!base) throw new Error("No INTEGRATIONS_SECRET or CRON_SECRET is set, so secrets can't be stored.");
  return Buffer.from(hkdfSync("sha256", base, "keyvaga-secret-box", "integration-keys-v1", 32));
}

export function sealSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), body.toString("base64url")].join(".");
}

export function openSecret(sealed: string): string {
  const [v, iv, tag, body] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || !body) throw new Error("Unreadable secret.");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(body, "base64url")), d.final()]).toString("utf8");
}
