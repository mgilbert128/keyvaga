import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildEnvelope, captureException, findJobFailures, parseDsn, parseStack } from "@/lib/monitoring";

const DSN = "https://abc123@o42.ingest.us.sentry.io/4507";

describe("parseDsn", () => {
  it("builds the envelope endpoint", () => {
    expect(parseDsn(DSN)?.endpoint).toBe("https://o42.ingest.us.sentry.io/api/4507/envelope/?sentry_version=7&sentry_key=abc123");
  });
  it("keeps a path prefix", () => {
    expect(parseDsn("https://k@sentry.example.com/prefix/9")?.endpoint).toBe("https://sentry.example.com/prefix/api/9/envelope/?sentry_version=7&sentry_key=k");
  });
  it("rejects missing or malformed DSNs", () => {
    expect(parseDsn(undefined)).toBeNull();
    expect(parseDsn("")).toBeNull();
    expect(parseDsn("not a url")).toBeNull();
    expect(parseDsn("https://o42.ingest.sentry.io/4507")).toBeNull();
  });
});

describe("buildEnvelope", () => {
  it("has header, item header and event lines", () => {
    const err = new TypeError("boom");
    const [header, item, event] = buildEnvelope(err, { message: "checkout failed", tags: { a: "b" } }, DSN, new Date(0)).split("\n").map((l) => JSON.parse(l));
    expect(header.dsn).toBe(DSN);
    expect(item).toEqual({ type: "event" });
    expect(event.event_id).toBe(header.event_id);
    expect(event.exception.values[0]).toMatchObject({ type: "TypeError", value: "boom" });
    expect(event.exception.values[0].stacktrace.frames.length).toBeGreaterThan(0);
    expect(event.message).toBe("checkout failed");
    expect(event.tags).toEqual({ a: "b" });
  });
});

describe("parseStack", () => {
  it("returns frames oldest first", () => {
    const frames = parseStack("Error: x\n    at inner (/app/a.js:1:2)\n    at /app/node_modules/b.js:3:4");
    expect(frames).toEqual([
      { function: "?", filename: "/app/node_modules/b.js", lineno: 3, colno: 4, in_app: false },
      { function: "inner", filename: "/app/a.js", lineno: 1, colno: 2, in_app: true },
    ]);
  });
});

describe("findJobFailures", () => {
  it("finds errors and failed charges, ignores successes", () => {
    const result = { calendars: { error: "Error: timeout" }, bookings: { balances: { b1: "charged", b2: "failed" }, payouts: { b3: "error: no account" } }, locks: { issued: 2 } };
    expect(findJobFailures(result)).toEqual(["calendars.error: Error: timeout", "bookings.balances.b2: failed", "bookings.payouts.b3: error: no account"]);
  });
});

describe("captureException", () => {
  const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
  beforeEach(() => {
    fetchMock.mockClear();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.SENTRY_DSN;
  });

  it("does nothing without a DSN", async () => {
    await captureException(new Error("x"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends once per error object and never throws", async () => {
    process.env.SENTRY_DSN = DSN;
    const err = new Error("once");
    await captureException(err);
    await captureException(err);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    await expect(captureException(new Error("other"))).resolves.toBeUndefined();
  });
});
