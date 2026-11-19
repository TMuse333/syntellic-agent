#!/usr/bin/env npx tsx
/**
 * Seed the demo client (Sam Rivers) into MongoDB with embeddings.
 * Idempotent: upserts by sourceId; only changed text is re-embedded.
 * Uses Voyage when VOYAGE_API_KEY is set, otherwise mock vectors.
 *
 * Usage: npm run seed:demo
 */
import "dotenv/config";
import { createProviders } from "../src/lib/providers";
import { ingest } from "../src/lib/content/ingest";
import { loadDemo } from "../src/lib/demo/fixtures";

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set");
  const p = await createProviders("live");
  const demo = loadDemo();
  const r = await ingest(p.store, p.embedder, { topics: demo.topics, content: demo.content });
  console.log(`Seeded ${demo.account.name}: ${r.topics} topics/branches, ${r.content} library items, ${r.embedded} embedded (${p.embedder.name})`);
  process.exit(0);
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
