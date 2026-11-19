/**
 * Trace one persona turn by turn: visitor input → extracted facts →
 * engine decision → the exact prompts sent to Claude → reply.
 *
 * Without an API key, a RecordingLLM captures every prompt and returns an
 * empty answer, which makes the engine fall back to its templates/rules —
 * so the conversation is identical to offline mode, but you see the prompts.
 * With ANTHROPIC_API_KEY (live), the real replies are recorded too.
 */

import type { LLM, LLMMessage } from "../providers/types";
import { createProviders, MockCalendar, FileNotifier, AnthropicLLM } from "../providers";
import { ingest } from "../content/ingest";
import { startConversation, handleMessage } from "../chat/engine";
import { loadDemo } from "./fixtures";
import type { Facts } from "../chat/types";

export interface PromptCall {
  kind: "reply" | "extract" | "brief";
  system: string;
  messages: LLMMessage[];
  output: string;
}

export interface TraceTurn {
  visitor?: string;
  factsAdded: Partial<Facts>;
  factsAfter: Facts;
  phase: string;
  decision: string;
  decisionDetail: Record<string, unknown>;
  questionTrail: string[];
  events: string[];
  prompts: PromptCall[];
  reply: string;
  buttons: string[];
}

class RecordingLLM implements LLM {
  readonly name: string;
  calls: PromptCall[] = [];
  constructor(private inner: LLM | null) {
    this.name = inner ? `recording(${inner.name})` : "recording(no model: templates used)";
  }
  async complete(opts: { system: string; messages: LLMMessage[]; maxTokens?: number }) {
    const kind: PromptCall["kind"] = opts.system.startsWith("You extract facts")
      ? "extract"
      : opts.system.includes("lead brief")
        ? "brief"
        : "reply";
    const output = this.inner ? await this.inner.complete(opts) : kind === "reply" ? "" : "{}";
    this.calls.push({ kind, system: opts.system, messages: opts.messages, output });
    return output;
  }
}

export async function traceConversation(personaId: string, opts: { live?: boolean } = {}) {
  const demo = loadDemo();
  const persona = demo.personas.find((p) => p.id === personaId);
  if (!persona) throw new Error(`Unknown persona ${personaId}`);
  const p = await createProviders(opts.live ? "live" : "offline");
  const inner = opts.live && process.env.ANTHROPIC_API_KEY ? new AnthropicLLM(process.env.ANTHROPIC_API_KEY) : null;
  const llm = new RecordingLLM(inner);
  const notifier = new FileNotifier();
  const deps = { ...p, llm, notifier, calendar: new MockCalendar(() => new Date("2026-10-22T15:00:00Z")) };
  await ingest(deps.store, deps.embedder, { topics: demo.topics, content: demo.content });

  const turns: TraceTurn[] = [];
  const take = () => llm.calls.splice(0);

  let r = await startConversation(deps, demo.account, { sessionId: `trace_${personaId}`, entryPostId: persona.entryPostId, utm: persona.utm });
  turns.push(turnOf(undefined, {}, r, take()));
  for (const msg of persona.scripted) {
    if (["booked", "ended"].includes(r.state.phase)) break;
    const before = { ...r.state.facts };
    const shown = r.quickReplies?.find((q) => q.value === msg)?.label;
    r = await handleMessage(deps, demo.account, r.state, msg);
    const added = Object.fromEntries(
      Object.entries(r.state.facts).filter(([k, v]) => JSON.stringify(before[k as keyof Facts]) !== JSON.stringify(v))
    ) as Partial<Facts>;
    turns.push(turnOf(shown ? `[taps] ${shown}` : msg, added, r, take()));
  }

  return {
    persona,
    model: llm.name,
    embedder: deps.embedder.name,
    turns,
    brief: notifier.sent[0] ?? null,
    lead: (await deps.store.listLeads(demo.account.slug))[0] ?? null,
  };
}

function turnOf(
  visitor: string | undefined,
  added: Partial<Facts>,
  r: Awaited<ReturnType<typeof handleMessage>>,
  prompts: PromptCall[]
): TraceTurn {
  const { type, ...detail } = r.action as { type: string } & Record<string, unknown>;
  return {
    visitor,
    factsAdded: added,
    factsAfter: { ...r.state.facts },
    phase: r.state.phase,
    decision: type,
    decisionDetail: detail,
    questionTrail: [...r.state.questionTrail],
    events: r.events.map((e) => e.event + (e.branchId ? ` [${e.branchId}]` : "")),
    prompts,
    reply: r.reply,
    buttons: (r.quickReplies ?? []).map((q) => q.label),
  };
}
