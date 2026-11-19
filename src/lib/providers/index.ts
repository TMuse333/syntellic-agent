import type { Providers } from "./types";
import { MockEmbedder, VoyageEmbedder } from "./embedder";
import { MemoryStore, MongoStore } from "./store";
import { AnthropicLLM } from "./llm";
import { MockCalendar } from "./calendar";
import { FileNotifier, ResendNotifier } from "./notifier";
import { getDb } from "../db/mongodb";

export * from "./types";
export { MockEmbedder, VoyageEmbedder } from "./embedder";
export { MemoryStore, MongoStore } from "./store";
export { AnthropicLLM } from "./llm";
export { MockCalendar } from "./calendar";
export { FileNotifier, ResendNotifier } from "./notifier";

export type Mode = "offline" | "live";

/** Which live services have credentials in the environment (never returns the values). */
export function liveAvailability() {
  return {
    mongo: !!process.env.MONGODB_URI,
    voyage: !!process.env.VOYAGE_API_KEY,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    resend: !!process.env.RESEND_API_KEY,
  };
}

/**
 * offline: every service mocked (no keys needed).
 * live:    real Voyage + Claude + Mongo when their keys exist; each missing
 *          one falls back to its mock and is reported in `fallbacks`.
 *          Calendar stays mock until a real calendar is connected.
 */
export async function createProviders(
  mode: Mode,
  opts: { briefsDir?: string } = {}
): Promise<Providers & { fallbacks: string[] }> {
  const fallbacks: string[] = [];
  const has = liveAvailability();
  if (mode === "offline") {
    return {
      embedder: new MockEmbedder(),
      store: new MemoryStore(),
      llm: null,
      calendar: new MockCalendar(),
      notifier: new FileNotifier(opts.briefsDir),
      fallbacks: ["all services mocked (offline mode)"],
    };
  }
  if (!has.voyage) fallbacks.push("embeddings: mock (no VOYAGE_API_KEY)");
  if (!has.anthropic) fallbacks.push("LLM: scripted (no ANTHROPIC_API_KEY)");
  if (!has.mongo) fallbacks.push("database: in-memory (no MONGODB_URI)");
  fallbacks.push("calendar: mock (no calendar connected yet)");
  if (!has.resend) fallbacks.push("email: written to files (no RESEND_API_KEY)");
  return {
    embedder: has.voyage ? new VoyageEmbedder() : new MockEmbedder(),
    store: has.mongo ? new MongoStore(await getDb()) : new MemoryStore(),
    llm: has.anthropic ? new AnthropicLLM(process.env.ANTHROPIC_API_KEY!) : null,
    calendar: new MockCalendar(),
    notifier: has.resend ? new ResendNotifier(process.env.RESEND_API_KEY!) : new FileNotifier(opts.briefsDir),
    fallbacks,
  };
}
