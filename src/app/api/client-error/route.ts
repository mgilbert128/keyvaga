import { captureException, monitoringEnabled } from "@/lib/monitoring";

const str = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : undefined);

/**
 * Browser crash reports from app/global-error.tsx, forwarded to Sentry so the DSN never ships to the browser.
 * Server-rendering errors arrive here too, but with a `digest` and a redacted message: those were already
 * reported on the server by onRequestError, so they're skipped. Sending is capped per instance in monitoring.ts.
 */
export async function POST(request: Request) {
  if (!monitoringEnabled()) return new Response(null, { status: 204 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object" || body.digest) return new Response(null, { status: 204 });

  const err = new Error(str(body.message, 2000) || "Unknown browser error");
  err.name = str(body.name, 100) || "Error";
  err.stack = str(body.stack, 8000);
  await captureException(err, {
    tags: { source: "browser" },
    request: { url: str(body.url, 500) },
    extra: { userAgent: request.headers.get("user-agent")?.slice(0, 300) },
  });
  return new Response(null, { status: 204 });
}
