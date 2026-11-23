#!/usr/bin/env npx tsx
/**
 * Phase-3 check: run sample buyer/seller questions through the real matcher
 * and print what content_library returns. Proves embeddings + retrieval work.
 *
 * Usage: DOTENV_CONFIG_PATH=.env.local tsx -r dotenv/config scripts/test-retrieval.ts greg-caseley
 */
import { createProviders } from "../src/lib/providers";
import { matchQuestion } from "../src/lib/search/match";

const QUESTIONS = [
  "I'm in Ontario and want to buy a cottage on PEI, where do I start?",
  "Is fall a bad time to sell my house?",
  "I'm moving from Saint John — how do I buy here from away?",
  "What will my home sell for this spring?",
  "Do I need to be there in person to buy a property?",
];

function title(d: Record<string, unknown>): string {
  return String(d.title ?? d.post ?? d.questionAnswered ?? "?").slice(0, 64);
}

async function main() {
  const accountId = process.argv[2] || "greg-caseley";
  const p = await createProviders("live");
  console.log(`store=${p.store.name}  embedder=${p.embedder.name}  account=${accountId}\n`);

  for (const q of QUESTIONS) {
    const m = await matchQuestion({ store: p.store, embedder: p.embedder }, accountId, q);
    console.log(`Q: ${q}`);
    console.log(`   → topic: ${m.topic ? m.topic.topic : "(no topic match)"}   score=${m.score.toFixed(3)}`);
    const posts = m.posts.slice(0, 3);
    if (!posts.length) console.log("   → (no posts returned)");
    for (const s of posts) {
      const doc = (s.doc ?? {}) as unknown as Record<string, unknown>;
      console.log(`     • ${title(doc)}   (${s.score.toFixed(3)})`);
    }
    console.log();
  }
  process.exit(0);
}
main().catch((e) => { console.error(e instanceof Error ? e.stack : e); process.exit(1); });
