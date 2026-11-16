/**
 * Error monitoring. When SENTRY_DSN is set, errors are sent to Sentry; without it, nothing happens.
 *
 * Deliberately dependency-free: it talks to Sentry's envelope HTTP API with fetch, so it runs in both
 * the Node and Edge runtimes and adds nothing to the bundle. What gets reported:
 *   - uncaught errors in pages, server actions and route handlers (instrumentation.ts → onRequestError)
 *   - every server-side console.error that includes an Error (installConsoleCapture, from instrumentation.ts)
 *   - browser crashes caught by app/global-error.tsx (via /api/client-error)
 *   - failed balance charges / payouts / lock and calendar tasks in the daily cron (reportJobFailures)
 * Only error names, messages, stack traces and short string context are sent: never request bodies,
 * cookies or headers.
 */

export type ErrorContext = {
  /** Short description of what was happening, e.g. "webhook handling failed". */
  message?: string;
  level?: "fatal" | "error" | "warning";
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  request?: { url?: string; method?: string };
};

type ParsedDsn = { dsn: string; endpoint: string };

/** Turns https://<key>@<host>/<project> into Sentry's envelope endpoint. Returns null for a missing or malformed DSN. */
export function parseDsn(dsn: string | undefined): ParsedDsn | null {
  if (!dsn) return null;
  try {
    const u = new URL(dsn.trim());
    const parts = u.pathname.split("/").filter(Boolean);
    const project = parts.pop();
    if (!u.username || !project) return null;
    const prefix = parts.length ? `/${parts.join("/")}` : "";
    return {
      dsn: dsn.trim(),
      endpoint: `${u.protocol}//${u.host}${prefix}/api/${project}/envelope/?sentry_version=7&sentry_key=${encodeURIComponent(u.username)}`,
    };
  } catch {
    return null;
  }
}

type Frame = { function?: string; filename?: string; lineno?: number; colno?: number; in_app?: boolean };

/** V8 stack lines ("at fn (file:12:3)" / "at file:12:3") → Sentry frames, oldest call first as Sentry expects. */
export function parseStack(stack: string | undefined): Frame[] {
  if (!stack) return [];
  const frames: Frame[] = [];
  for (const line of stack.split("\n").slice(1, 51)) {
    const m = line.match(/^\s*at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?\s*$/);
    if (!m) continue;
    const filename = m[2]!;
    frames.push({
      function: m[1] || "?",
      filename,
      lineno: Number(m[3]),
      colno: Number(m[4]),
      in_app: !filename.includes("node_modules") && !filename.startsWith("node:"),
    });
  }
  return frames.reverse();
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

function eventId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

/** Builds the newline-delimited envelope Sentry's /envelope/ endpoint accepts. Exported for tests. */
export function buildEnvelope(err: unknown, ctx: ErrorContext, dsn: string, now = new Date()): string {
  const id = eventId();
  const isError = err instanceof Error;
  const type = isError ? err.name || "Error" : "Error";
  const value = clip(isError ? err.message : typeof err === "string" ? err : safeString(err), 2000);
  const frames = isError ? parseStack(err.stack) : [];
  const env = typeof process !== "undefined" ? process.env : ({} as Record<string, string | undefined>);
  const event = {
    event_id: id,
    timestamp: now.getTime() / 1000,
    platform: "javascript",
    level: ctx.level ?? "error",
    logger: "keyvaga",
    environment: env.VERCEL_ENV || env.NODE_ENV || "development",
    release: env.VERCEL_GIT_COMMIT_SHA || undefined,
    message: ctx.message ? clip(ctx.message, 500) : undefined,
    exception: { values: [{ type, value, ...(frames.length ? { stacktrace: { frames } } : {}) }] },
    tags: ctx.tags,
    extra: ctx.extra,
    request: ctx.request?.url ? { url: clip(ctx.request.url, 500), method: ctx.request.method } : undefined,
  };
  return [
    JSON.stringify({ event_id: id, sent_at: now.toISOString(), dsn }),
    JSON.stringify({ type: "event" }),
    JSON.stringify(event),
  ].join("\n");
}

function safeString(v: unknown): string {
  try {
    return typeof v === "object" ? JSON.stringify(v) : String(v);
  } catch {
    return String(v);
  }
}

// Per-instance guards: report each Error object once (Next also logs errors it passes to onRequestError),
// and cap the rate so a crash loop or junk posts to /api/client-error can't burn the Sentry quota.
const seen = new WeakSet<object>();
const MAX_PER_MINUTE = 30;
let windowStart = 0;
let sentInWindow = 0;

function allowed(): boolean {
  const now = Date.now();
  if (now - windowStart > 60_000) {
    windowStart = now;
    sentInWindow = 0;
  }
  return ++sentInWindow <= MAX_PER_MINUTE;
}

/** True when SENTRY_DSN is set to a valid DSN. */
export function monitoringEnabled(): boolean {
  return parseDsn(process.env.SENTRY_DSN) !== null;
}

/** Sends an error to Sentry. Never throws, never logs (so it can't loop through console.error). */
export async function captureException(err: unknown, ctx: ErrorContext = {}): Promise<void> {
  try {
    const parsed = parseDsn(process.env.SENTRY_DSN);
    if (!parsed) return;
    if (err && typeof err === "object") {
      if (seen.has(err)) return;
      seen.add(err);
    }
    if (!allowed()) return;
    await fetch(parsed.endpoint, {
      method: "POST",
      headers: { "content-type": "application/x-sentry-envelope" },
      body: buildEnvelope(err, ctx, parsed.dsn),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Monitoring must never break the request it's reporting on.
  }
}

/** Sends a message-only event (no thrown error), e.g. a summary of failed cron tasks. */
export function captureMessage(message: string, ctx: Omit<ErrorContext, "message"> = {}): Promise<void> {
  const e = new Error(message);
  e.name = "Report";
  e.stack = undefined;
  return captureException(e, { level: "warning", ...ctx, message });
}

let consoleInstalled = false;

/**
 * Forwards server-side console.error calls that include an Error to Sentry, so the many existing
 * `.catch((e) => console.error("…failed", e))` spots are monitored without touching each one.
 * The original console.error still runs, so Vercel logs are unchanged.
 */
export function installConsoleCapture(): void {
  if (consoleInstalled || !monitoringEnabled()) return;
  consoleInstalled = true;
  const original = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    original(...args);
    const err = args.find((a): a is Error => a instanceof Error);
    if (!err) return;
    const message = args
      .filter((a) => typeof a === "string")
      .map((a) => clip(a as string, 300))
      .join(" ");
    void captureException(err, { message: message || undefined, tags: { source: "console.error" } });
  };
}

/** Collects "path: value" for every string in the daily-cron result that reports an error or a failed charge/payout. */
export function findJobFailures(result: unknown, path = ""): string[] {
  if (typeof result === "string") {
    return /^error\b|^failed$/i.test(result) ? [`${path}: ${clip(result, 300)}`] : [];
  }
  if (result && typeof result === "object") {
    return Object.entries(result as Record<string, unknown>).flatMap(([k, v]) => findJobFailures(v, path ? `${path}.${k}` : k));
  }
  return [];
}

/** Reports one Sentry event listing every failure in a cron run (nothing is sent if all went well). */
export async function reportJobFailures(job: string, result: unknown): Promise<void> {
  const failures = findJobFailures(result);
  if (failures.length === 0) return;
  await captureMessage(`${job}: ${failures.length} task(s) failed`, {
    level: "error",
    tags: { source: "cron", job },
    extra: { failures: failures.slice(0, 100) },
  });
}
