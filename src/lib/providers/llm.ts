import type { LLM, LLMMessage } from "./types";

/**
 * Claude via the Messages API (plain fetch, no SDK dependency).
 * Model is configurable: CHAT_MODEL (default: a fast Haiku model for chat).
 */
export class AnthropicLLM implements LLM {
  readonly name: string;
  constructor(
    private apiKey: string,
    private model = process.env.CHAT_MODEL || "claude-haiku-5-5",
    private baseUrl = process.env.ANTHROPIC_API_URL || "https://api.anthropic.com"
  ) {
    this.name = `anthropic:${model}`;
  }

  async complete({ system, messages, maxTokens = 400 }: { system: string; messages: LLMMessage[]; maxTokens?: number }) {
    // The API requires the first message to be from the user.
    const msgs = messages.length && messages[0].role === "assistant"
      ? [{ role: "user" as const, content: "(visitor opened the chat)" }, ...messages]
      : messages;
    const res = await fetch(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model: this.model, max_tokens: maxTokens, system, messages: msgs }),
    });
    if (!res.ok) throw new Error(`Anthropic API error ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = (await res.json()) as { content: { type: string; text?: string }[] };
    return data.content.filter((c) => c.type === "text").map((c) => c.text).join("").trim();
  }
}

/** Pull the first JSON object out of a model reply. */
export function parseJsonReply<T>(text: string): T | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
