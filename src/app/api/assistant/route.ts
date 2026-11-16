import Anthropic from "@anthropic-ai/sdk";
import { assistantClient, assistantConfigured } from "@/lib/assistant/client";
import { systemPrompt } from "@/lib/assistant/prompt";
import { SUPPORT_EMAIL } from "@/lib/assistant/knowledge";
import { clientIp, hit } from "@/lib/rate-limit";

export const maxDuration = 60;

const MODEL = "claude-opus-5-5";
const MAX_TURNS = 16;
const MAX_CHARS = 1200;

type ChatTurn = { role: "user" | "assistant"; content: string };

function parse(body: unknown): ChatTurn[] | null {
  const raw = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const turns = raw.slice(-MAX_TURNS).map((m) => ({
    role: (m as ChatTurn)?.role === "assistant" ? "assistant" : "user",
    content: String((m as ChatTurn)?.content ?? "").trim().slice(0, MAX_CHARS),
  })) as ChatTurn[];
  // The API needs a user message first and last; drop anything that would break that.
  while (turns.length && turns[0]!.role !== "user") turns.shift();
  if (!turns.length || turns[turns.length - 1]!.role !== "user" || turns.some((t) => !t.content)) return null;
  return turns;
}

const text = (s: string, status = 200) => new Response(s, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

/** Streams a plain-text answer from Claude. Rate-limited per visitor and overall per day. */
export async function POST(request: Request) {
  if (!assistantConfigured()) return text("The assistant isn't available right now.", 503);
  const turns = parse(await request.json().catch(() => null));
  if (!turns) return text("Please type a question.", 400);

  const ip = await clientIp();
  const [hour, day, all] = await Promise.all([hit(`assistant:ip:${ip}:h`, 20, 3600), hit(`assistant:ip:${ip}:d`, 60, 86400), hit("assistant:all:d", 3000, 86400)]);
  if (!hour.ok || !day.ok) return text(`You've asked a lot of questions! Please try again later, or email ${SUPPORT_EMAIL}.`, 429);
  if (!all.ok) return text(`The assistant is very busy right now. Please email ${SUPPORT_EMAIL} and we'll help.`, 429);

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const stream = assistantClient().beta.messages.stream({
          model: MODEL,
          max_tokens: 2000,
          output_config: { effort: "low" },
          // If a safety check declines, the API retries on a suitable model automatically.
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          system: [{ type: "text", text: systemPrompt(), cache_control: { type: "ephemeral" } }],
          messages: turns,
        });
        let sent = false;
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
            sent = true;
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal" || !sent) controller.enqueue(encoder.encode(`Sorry, I can't help with that one. Please email ${SUPPORT_EMAIL}.`));
      } catch (e) {
        if (e instanceof Anthropic.RateLimitError) controller.enqueue(encoder.encode(`The assistant is busy right now. Please try again in a minute, or email ${SUPPORT_EMAIL}.`));
        else {
          console.error("assistant failed", e instanceof Error ? e.message : e);
          controller.enqueue(encoder.encode(`Sorry, something went wrong. Please try again, or email ${SUPPORT_EMAIL}.`));
        }
      } finally {
        controller.close();
      }
    },
  });
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
