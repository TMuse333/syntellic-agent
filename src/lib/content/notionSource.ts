/**
 * Notion → content_library sync (Spec §5).
 *
 * Reads an account's Posts + Topics data sources from Notion, flattens each
 * page's properties into the flat shape the existing mappers expect, then runs
 * them through mapNotionTopic / mapNotionPost + ingest() (which embeds and
 * upserts). The chatbot/website still read Mongo only — this is the background
 * sync that fills it.
 *
 * Property extraction mirrors strategy-app's proven pattern; the data-source
 * query uses the same `dataSources.query` API against the account's
 * `collection://<id>` ids (from strategy.accounts, read via getStrategyAccount).
 */

import { Client } from "@notionhq/client";
import { getStrategyAccount } from "../account/strategyAccount";
import { mapNotionTopic, mapNotionPost } from "../demo/fixtures";
import { ingest } from "./ingest";
import { rehostToBlob } from "../media/rehost";
import type { Embedder, Store } from "../providers/types";

type Raw = Record<string, unknown>;

function getNotionClient(): Client {
  const key = process.env.NOTION_API_KEY || process.env.NOTION_TOKEN;
  if (!key) throw new Error("NOTION_API_KEY (or NOTION_TOKEN) is not set — add the Syntellic Notion integration token to .env.local");
  return new Client({ auth: key });
}

const MEDIA_EXT = /\.(mp4|mov|m4v|webm|jpe?g|png|gif|webp|avif)$/i;

function firstFileUrl(prop: { url?: string; files?: Array<{ name?: string; file?: { url?: string }; external?: { url?: string } }> }): string | undefined {
  if (prop.url) return prop.url;
  const first = prop.files?.[0];
  const url = first?.file?.url ?? first?.external?.url;
  if (!url) return undefined;
  const pathname = url.split("?")[0].split("#")[0];
  const nameExt = first?.name?.match(MEDIA_EXT)?.[0];
  if (!MEDIA_EXT.test(pathname) && nameExt) return `${url}#preview${nameExt.toLowerCase()}`;
  return url;
}

/** One Notion property object → the primitive the mappers read. */
function flattenProp(prop: unknown): unknown {
  if (!prop || typeof prop !== "object") return undefined;
  const p = prop as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  switch (p.type) {
    case "title":
      return (p.title ?? []).map((t: { plain_text?: string }) => t.plain_text ?? "").join("");
    case "rich_text":
      return (p.rich_text ?? []).map((t: { plain_text?: string }) => t.plain_text ?? "").join("");
    case "select":
      return p.select?.name;
    case "status":
      return p.status?.name;
    case "multi_select":
      return (p.multi_select ?? []).map((s: { name: string }) => s.name).join(", ");
    case "number":
      return p.number ?? undefined;
    case "date":
      return p.date?.start ?? undefined;
    case "checkbox":
      return p.checkbox ?? false;
    case "url":
      return p.url ?? undefined;
    case "email":
      return p.email ?? undefined;
    case "phone_number":
      return p.phone_number ?? undefined;
    case "files":
      return firstFileUrl(p);
    case "relation":
      return (p.relation ?? []).map((r: { id: string }) => r.id);
    default:
      return undefined; // rollups, formulas, people — derived/irrelevant to the mappers
  }
}

/** A Notion page → { id, <PropertyName>: primitive, ... }. */
function flattenPage(page: unknown): Raw {
  const pg = page as { id: string; properties?: Record<string, unknown> };
  const raw: Raw = { id: pg.id };
  for (const [name, prop] of Object.entries(pg.properties ?? {})) {
    raw[name] = flattenProp(prop);
  }
  return raw;
}

const firstId = (v: unknown): string | undefined => (Array.isArray(v) ? v[0] : (v as string | undefined)) || undefined;

async function queryDataSource(notion: Client, collectionUrl: string): Promise<unknown[]> {
  const dataSourceId = collectionUrl.replace("collection://", "");
  const out: unknown[] = [];
  let cursor: string | undefined;
  do {
    // dataSources is present in @notionhq/client v5 but not in its types yet.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (notion as any).dataSources.query({ data_source_id: dataSourceId, page_size: 100, start_cursor: cursor });
    out.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return out;
}

export interface SyncResult {
  accountId: string;
  topics: number;
  posts: number;
  embedded: number;
}

/**
 * Pull one account's Topics + Posts from Notion into content_library/topics.
 * Posts/Topics link by Notion page id: a Post's Topic relation id equals the
 * Topic page's id, so ingest() can derive rootTopicId/branchId from the tree.
 */
export async function syncAccountContent(accountId: string, deps: { store: Store; embedder: Embedder }): Promise<SyncResult> {
  const account = await getStrategyAccount(accountId);
  const notionCfg = account?.notion;
  if (!notionCfg?.postsDataSourceId || !notionCfg?.topicsDataSourceId) {
    throw new Error(`Account "${accountId}" has no Notion postsDataSourceId/topicsDataSourceId in strategy.accounts`);
  }
  const notion = getNotionClient();

  const rawTopics = await queryDataSource(notion, notionCfg.topicsDataSourceId);
  const topics = rawTopics.map((page) => {
    const raw = flattenPage(page);
    raw["Parent topic"] = firstId(raw["Parent topic"]); // single-relation
    return mapNotionTopic(raw, accountId);
  });
  const titles = new Map(topics.map((t) => [t.sourceId, t.topic]));

  const rawPosts = await queryDataSource(notion, notionCfg.postsDataSourceId);
  const content = rawPosts.map((page) => {
    const raw = flattenPage(page);
    raw.Topic = firstId(raw.Topic); // single-relation → the post's topic/branch
    return mapNotionPost(raw, accountId, (id) => titles.get(id));
  });

  // Re-host each post's media to Blob so thumbnails don't rot when Notion's
  // pre-signed URLs expire. No-op (keeps the Notion URL) without BLOB_READ_WRITE_TOKEN.
  for (const post of content) {
    const p = post as { mediaUrl?: string; sourceId: string };
    if (p.mediaUrl) p.mediaUrl = await rehostToBlob(p.mediaUrl, `accounts/${accountId}/posts/${p.sourceId}`);
  }

  const r = await ingest(deps.store, deps.embedder, { topics, content });
  return { accountId, topics: topics.length, posts: content.length, embedded: r.embedded };
}
