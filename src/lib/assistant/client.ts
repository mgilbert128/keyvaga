import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * The help assistant talks to Claude through Anthropic's API. ANTHROPIC_API_KEY turns it on;
 * without it the chat bubble is hidden. Tests swap in a fake with setAssistantClient().
 */
let override: Anthropic | null = null;

export function setAssistantClient(c: Anthropic | null) {
  override = c;
}

export function assistantConfigured(): boolean {
  return Boolean(override || process.env.ANTHROPIC_API_KEY);
}

export function assistantClient(): Anthropic {
  return override ?? new Anthropic();
}
