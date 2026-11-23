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
import { syncAccountContentFromStrategy } from "../src/lib/content/strategyContentSource";

// CMD-01 ruling (2026-11-21): consume strategy-app's content API, not Notion.
// Default stays "notion" until STRAT-B's endpoint ships; flip to "strategy" then.
const CONTENT_SOURCE = (process.env.CONTENT_SOURCE || "notion").toLowerCase();

async function main() {
  const accountId = process.argv[2];
  if (!accountId) throw new Error("Usage: npm run sync:content -- <accountId>");
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set");

  const p = await createProviders("live");
  if (p.store.name !== "mongo") throw new Error("Expected the Mongo store — check MONGODB_URI");

  const r =
    CONTENT_SOURCE === "strategy"
      ? await syncAccountContentFromStrategy(accountId, p)
      : await syncAccountContent(accountId, p);
  console.log(
    `Synced ${r.accountId} via ${CONTENT_SOURCE}: ${r.topics} topics, ${r.posts} posts, ${r.embedded} embedded (${p.embedder.name})`
  );
  process.exit(0);
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
