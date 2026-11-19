/**
 * Ingest content + topics into the library: derive core fields, embed only
 * what changed (Spec section 5: re-embed when the embedding text changes).
 * Source adapters (Notion, listings feed, fixtures) all end up here.
 */

import type { ContentItem, Topic } from "../db/schemas";
import type { Embedder, Store } from "../providers/types";
import { normalizeItem, topicEmbeddingText } from "./kinds";

export interface IngestResult {
  topics: number;
  content: number;
  embedded: number;
}

export async function ingest(
  store: Store,
  embedder: Embedder,
  input: { topics?: Topic[]; content?: ContentItem[] }
): Promise<IngestResult> {
  const now = new Date();
  const todo: { text: string; apply: (v: number[]) => void }[] = [];

  const topics = (input.topics ?? []).map((t) => ({ ...t, embeddingText: topicEmbeddingText(t), syncedAt: now }));
  for (const t of topics) {
    const existing = await store.getTopic(t.accountId, t.sourceId);
    if (existing?.embedding && existing.embeddingText === t.embeddingText) t.embedding = existing.embedding;
    else if (t.embeddingText) todo.push({ text: t.embeddingText, apply: (v) => (t.embedding = v) });
  }

  // Niche tree lookup: incoming topics first, then what's already stored.
  const accountIds = new Set((input.content ?? []).map((c) => c.accountId));
  const parentOf = new Map<string, string | undefined>();
  for (const id of accountIds) for (const t of await store.listTopics(id)) parentOf.set(t.sourceId, t.parentTopicId);
  for (const t of topics) parentOf.set(t.sourceId, t.parentTopicId);

  const content = (input.content ?? []).map((c) => {
    const parent = c.topicId ? parentOf.get(c.topicId) : undefined;
    const tree = c.topicId
      ? { rootTopicId: parent ?? c.topicId, branchId: parent ? c.topicId : undefined }
      : {};
    return normalizeItem({ ...(c as unknown as Record<string, unknown>), ...tree, syncedAt: now } as never) as ContentItem;
  });
  for (const c of content) {
    const existing = await store.getContent(c.accountId, c.sourceId);
    if (existing?.embedding && existing.embeddingText === c.embeddingText) c.embedding = existing.embedding;
    else if (c.embeddingText) todo.push({ text: c.embeddingText, apply: (v) => (c.embedding = v) });
  }

  if (todo.length) {
    const vectors = await embedder.embedDocuments(todo.map((t) => t.text));
    vectors.forEach((v, i) => todo[i].apply(v));
  }

  for (const t of topics) await store.upsertTopic(t);
  for (const c of content) await store.upsertContent(c);
  return { topics: topics.length, content: content.length, embedded: todo.length };
}
