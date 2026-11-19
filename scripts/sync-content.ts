#!/usr/bin/env npx tsx
/**
 * Sync one account's Notion Posts + Topics into content_library/topics (embedded).
 *
 * Usage: npm run sync:content -- <accountId>     e.g. npm run sync:content -- greg-caseley
 *
 * Needs MONGODB_URI, NOTION_API_KEY (Syntellic integration token), and the
 * account present in strategy.accounts with its Notion data-source ids.
 * Uses Voyage when VOYAGE_API_KEY is set, otherwise mock vectors.
 */
// Env is preloaded via `-r dotenv/config` (DOTENV_CONFIG_PATH=.env.local) in the
// npm script, so it's set before the provider modules capture it at import time.
import { createProviders } from "../src/lib/providers";
import { syncAccountContent } from "../src/lib/content/notionSource";

async function main() {
  const accountId = process.argv[2];
  if (!accountId) throw new Error("Usage: npm run sync:content -- <accountId>");
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set");

  const p = await createProviders("live");
  if (p.store.name !== "mongo") throw new Error("Expected the Mongo store — check MONGODB_URI");

  const r = await syncAccountContent(accountId, p);
  console.log(`Synced ${r.accountId}: ${r.topics} topics, ${r.posts} posts, ${r.embedded} embedded (${p.embedder.name})`);
  process.exit(0);
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
