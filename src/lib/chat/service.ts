/**
 * Server-side chat service used by the API route.
 * Providers are created once per server instance. Without MONGODB_URI the
 * store is in-memory and the demo client is seeded on first use, so the chat
 * can be tried on a preview deploy before any keys are set.
 */

import { createProviders } from "../providers";
import type { Providers } from "../providers/types";
import { MockCalendar } from "../providers/calendar";
import { FileNotifier } from "../providers/notifier";
import { ingest } from "../content/ingest";
import { loadDemo } from "../demo/fixtures";
import { getStrategyAccount } from "../account/strategyAccount";
import { startConversation, handleMessage, type TurnResult } from "./engine";
import type { ChatState } from "./types";

let ready: Promise<Providers & { fallbacks: string[] }> | null = null;

/** Shared lazy singleton: same store/embedder instance backs chat and the site pages. */
export async function providers() {
  if (!ready) {
    ready = (async () => {
      const p = await createProviders("live");
      if (p.store.name === "memory") {
        const demo = loadDemo();
        await ingest(p.store, p.embedder, { topics: demo.topics, content: demo.content });
      }
      return p;
    })();
  }
  return ready;
}

export interface ChatRequest {
  accountId: string;
  sessionId: string;
  conversationId?: string;
  message?: string;
  entryPostId?: string;
  utm?: { source?: string; medium?: string; content?: string };
  /** When true, the response includes a retrieval trace + state summary (inspector only). */
  inspect?: boolean;
}

export interface ChatInspect {
  trace?: import("./types").RetrievalTrace;
  rootTopicId?: string;
  branchId?: string;
  topicId?: string;
  servedIds: string[];
  listingIds: string[];
  questionTrail: string[];
  facts: import("./types").Facts;
  events: string[];
}

export interface ChatResponse {
  conversationId: string;
  reply: string;
  phase: string;
  step: string;
  slots?: { index: number; label: string }[];
  /** Buttons to show under the reply; send `value` back as the message. */
  quickReplies?: { label: string; value: string }[];
  booked?: { label: string; kind: "call" | "showing" };
  /** Present only when the request set inspect: true. */
  inspect?: ChatInspect;
}

export async function chat(req: ChatRequest): Promise<ChatResponse> {
  const p = await providers();
  const account = await getStrategyAccount(req.accountId);
  if (!account?.agent) throw new ChatError(404, "Unknown account");
  // Demo accounts never email anyone and use the mock calendar.
  const deps = account.isDemo ? { ...p, notifier: new FileNotifier(), calendar: p.calendar instanceof MockCalendar ? p.calendar : new MockCalendar() } : p;

  let r: TurnResult;
  const existing = req.conversationId ? await p.store.getConversation(req.conversationId) : null;
  if (!existing) {
    r = await startConversation(deps, account, {
      sessionId: req.sessionId,
      conversationId: req.conversationId,
      entryPostId: req.entryPostId,
      utm: req.utm,
    });
    if (req.message) r = await handleMessage(deps, account, r.state, req.message);
  } else {
    if (existing.accountId !== account.slug) throw new ChatError(403, "Conversation belongs to another account");
    if (!req.message?.trim()) throw new ChatError(400, "message is required");
    r = await handleMessage(deps, account, existing.state as ChatState, req.message.trim().slice(0, 1000));
  }

  return {
    conversationId: r.state.conversationId,
    reply: r.reply,
    phase: r.state.phase,
    step: r.action.type,
    quickReplies: r.quickReplies,
    slots: r.action.type === "offer_slots" ? r.action.slots.map((s, i) => ({ index: i + 1, label: s.label })) : undefined,
    booked: r.action.type === "confirm_booking" ? { label: r.action.slot.label, kind: r.action.meeting } : undefined,
    inspect: req.inspect
      ? {
          trace: r.trace,
          rootTopicId: r.state.rootTopicId,
          branchId: r.state.branchId,
          topicId: r.state.topicId,
          servedIds: r.state.servedIds,
          listingIds: r.state.listingIds,
          questionTrail: r.state.questionTrail,
          facts: r.state.facts,
          events: r.events.map((e) => e.event),
        }
      : undefined,
  };
}

export class ChatError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
