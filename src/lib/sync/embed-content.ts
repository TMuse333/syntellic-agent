/**
 * Legacy upsert helpers, kept for existing imports. They now write to the
 * content_library collection via the shared ingest path (previously they
 * wrote to a "posts" collection the rest of the app never read).
 */
import type { Topic, Post, ContentItem } from "../db/schemas";
import { getDb } from "../db/mongodb";
import { MongoStore } from "../providers/store";
import { VoyageEmbedder } from "../providers/embedder";
import { ingest } from "../content/ingest";

async function deps() {
  return { store: new MongoStore(await getDb()), embedder: new VoyageEmbedder() };
}

export async function upsertTopic(
  accountId: string,
  sourceId: string,
  data: Omit<Topic, "_id" | "accountId" | "sourceId" | "embedding" | "embeddingText" | "syncedAt">
): Promise<{ embedded: boolean }> {
  const { store, embedder } = await deps();
  const r = await ingest(store, embedder, { topics: [{ ...data, accountId, sourceId, syncedAt: new Date() }] });
  return { embedded: r.embedded > 0 };
}

export async function upsertPost(
  accountId: string,
  sourceId: string,
  data: Omit<Post, "_id" | "accountId" | "sourceId" | "embedding" | "embeddingText" | "syncedAt">
): Promise<{ embedded: boolean }> {
  const { store, embedder } = await deps();
  const item = { ...data, kind: "post", title: data.post, accountId, sourceId, syncedAt: new Date() } as unknown as ContentItem;
  const r = await ingest(store, embedder, { content: [item] });
  return { embedded: r.embedded > 0 };
}

/** Re-ingest everything for an account (only items whose text changed get re-embedded). */
export async function embedMissingTopics(accountId: string): Promise<number> {
  const { store, embedder } = await deps();
  const topics = await store.listTopics(accountId);
  return (await ingest(store, embedder, { topics: topics.filter((t) => !t.embedding) })).embedded;
}

export async function embedMissingPosts(accountId: string): Promise<number> {
  const { store, embedder } = await deps();
  const items = await store.listContent(accountId);
  return (await ingest(store, embedder, { content: items.filter((c) => !c.embedding) })).embedded;
}
