/**
 * Legacy Mongo-backed helpers, kept for existing imports.
 * Now delegate to the store/matcher so there is ONE search path
 * (previously these queried a "posts" collection that nothing wrote to).
 */
import type { Topic, Post } from "../db/schemas";
import { getDb } from "../db/mongodb";
import { MongoStore } from "../providers/store";
import { VoyageEmbedder } from "../providers/embedder";
import { matchQuestion } from "./match";

interface SearchResult<T> {
  document: T;
  score: number;
}

async function deps() {
  return { store: new MongoStore(await getDb()), embedder: new VoyageEmbedder() };
}

export async function searchTopics(accountId: string, query: string, limit = 3): Promise<SearchResult<Topic>[]> {
  const { store, embedder } = await deps();
  const v = await embedder.embedQuery(query);
  const rows = await store.searchTopics(v, { accountId, status: { $in: ["Active", "Covered"] } }, limit);
  return rows.map((r) => ({ document: r.doc, score: r.score }));
}

export async function searchPostsInTopic(accountId: string, topicId: string, query: string, limit = 5): Promise<SearchResult<Post>[]> {
  const { store, embedder } = await deps();
  const v = await embedder.embedQuery(query);
  const rows = await store.searchContent(v, { accountId, kind: "post", isPublic: true, rootTopicId: topicId }, limit);
  return rows.map((r) => ({ document: r.doc as Post, score: r.score }));
}

export async function searchAllPosts(accountId: string, query: string, limit = 5): Promise<SearchResult<Post>[]> {
  const { store, embedder } = await deps();
  const v = await embedder.embedQuery(query);
  const rows = await store.searchContent(v, { accountId, kind: "post", isPublic: true }, limit);
  return rows.map((r) => ({ document: r.doc as Post, score: r.score }));
}

export async function matchContent(accountId: string, visitorQuery: string) {
  const { store, embedder } = await deps();
  const m = await matchQuestion({ store, embedder }, accountId, visitorQuery);
  return {
    topic: m.topic,
    topicScore: m.score,
    posts: m.posts.map((p) => ({ document: p.doc as Post, score: p.score })),
  };
}
