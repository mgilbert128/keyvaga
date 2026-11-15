import "server-only";
import { headers } from "next/headers";
import { db } from "@/lib/db";

/**
 * Fixed-window rate limiting stored in Postgres (works on serverless without Redis).
 * `hit` counts an attempt and says whether it's allowed. Keys look like "login:email:jo@x.com" or "signup:ip:1.2.3.4".
 */
export async function hit(key: string, limit: number, windowSeconds: number): Promise<{ ok: boolean; retryAfterSeconds: number }> {
  const rows = await db.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt")
    VALUES (${key}, 1, now() + make_interval(secs => ${windowSeconds}))
    ON CONFLICT ("key") DO UPDATE SET
      "count"   = CASE WHEN "RateLimit"."resetAt" < now() THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" < now() THEN now() + make_interval(secs => ${windowSeconds}) ELSE "RateLimit"."resetAt" END
    RETURNING "count", "resetAt"`;
  const row = rows[0]!;
  return { ok: row.count <= limit, retryAfterSeconds: Math.max(1, Math.ceil((row.resetAt.getTime() - Date.now()) / 1000)) };
}

/** Clears a key (e.g. a successful login resets the failed-attempt counter for that email). */
export async function clearLimit(key: string) {
  await db.rateLimit.deleteMany({ where: { key } });
}

/** Visitor IP as reported by Vercel's edge (x-real-ip / first x-forwarded-for entry). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0] || "unknown").trim().slice(0, 64);
}

export function waitText(seconds: number): string {
  const m = Math.ceil(seconds / 60);
  return m <= 1 ? "a minute" : m < 60 ? `${m} minutes` : `${Math.ceil(m / 60)} hours`;
}

/** Old counters are useless once their window has passed: the daily cron sweeps them. */
export async function sweepRateLimits() {
  const { count } = await db.rateLimit.deleteMany({ where: { resetAt: { lt: new Date(Date.now() - 3_600_000) } } });
  return count;
}
