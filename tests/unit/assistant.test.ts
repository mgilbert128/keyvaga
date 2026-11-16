import { describe, expect, it, vi, beforeEach } from "vitest";

const calls: Record<string, unknown>[] = [];
let limited = false;
vi.mock("@/lib/rate-limit", () => ({ clientIp: async () => "203.0.113.1", hit: async () => ({ ok: !limited, retryAfterSeconds: 60 }) }));

const { setAssistantClient } = await import("@/lib/assistant/client");
const { POST } = await import("@/app/api/assistant/route");
const { knowledgeBase } = await import("@/lib/assistant/knowledge");

function fakeClient(parts: string[], stop = "end_turn") {
  return {
    beta: {
      messages: {
        stream(params: Record<string, unknown>) {
          calls.push(params);
          return {
            async *[Symbol.asyncIterator]() {
              for (const t of parts) yield { type: "content_block_delta", delta: { type: "text_delta", text: t } };
            },
            finalMessage: async () => ({ stop_reason: stop }),
          };
        },
      },
    },
  } as never;
}

const ask = (messages: unknown) => POST(new Request("http://x/api/assistant", { method: "POST", body: JSON.stringify({ messages }) }));

describe("help assistant", () => {
  beforeEach(() => {
    calls.length = 0;
    limited = false;
  });

  it("knows the real fees and policies", () => {
    const kb = knowledgeBase();
    expect(kb).toContain("5% guest service fee");
    expect(kb).toContain("30% is paid at booking");
    expect(kb).toContain("Flexible: Full refund if cancelled at least 7 days before check-in");
    expect(kb).toContain("hello@keyvaga.com");
  });

  it("streams the answer, caches the instructions, and trims odd history", async () => {
    setAssistantClient(fakeClient(["Refunds ", "depend on the policy."]));
    const res = await ask([{ role: "assistant", content: "hi" }, { role: "user", content: "How do refunds work?" }]);
    expect(await res.text()).toBe("Refunds depend on the policy.");
    const p = calls[0]!;
    expect(p.model).toBe("claude-opus-5-5");
    expect((p.messages as { role: string }[]).map((m) => m.role)).toEqual(["user"]);
    expect((p.system as { cache_control?: unknown }[])[0]!.cache_control).toEqual({ type: "ephemeral" });
  });

  it("refuses empty questions and over-limit visitors", async () => {
    setAssistantClient(fakeClient(["x"]));
    expect((await ask([])).status).toBe(400);
    expect((await ask([{ role: "user", content: "   " }])).status).toBe(400);
    limited = true;
    expect((await ask([{ role: "user", content: "hi" }])).status).toBe(429);
  });

  it("falls back to a polite message when the model declines", async () => {
    setAssistantClient(fakeClient([], "refusal"));
    expect(await (await ask([{ role: "user", content: "something odd" }])).text()).toContain("hello@keyvaga.com");
  });

  it("is off without a key", async () => {
    setAssistantClient(null);
    delete process.env.ANTHROPIC_API_KEY;
    expect((await ask([{ role: "user", content: "hi" }])).status).toBe(503);
  });
});
