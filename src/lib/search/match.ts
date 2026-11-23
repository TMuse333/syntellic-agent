/**
 * Match flow (Spec sections 5 + 7), generalized over the content library.
 *
 *  question ─► embed (query)
 *     ├─► topics (incl. branches)      ┐ best of the two decides the topic
 *     └─► public posts                 ┘
 *  topic ─► public posts in that topic, ranked
 *
 * Listings use exact filters (price, beds, area) first, then similarity.
 */

import type { Topic, ContentItem, Listing } from "../db/schemas";
import { recordServed } from "../db/queries";
import type { Embedder, Store, Scored, Filter } from "../providers/types";

export interface MatchDeps {
  store: Store;
  embedder: Embedder;
}

export interface TopicMatch {
  topic: Topic | null; // the matched topic or branch
  rootTopicId: string | null;
  branchId: string | null;
  score: number;
  posts: Scored<ContentItem>[];
  /** The ranked candidates the matcher weighed, for the inspector (not used by chat logic). */
  candidates?: { topics: Scored<Topic>[]; posts: Scored<ContentItem>[]; threshold: number };
}

/** Minimum similarity to count as a match. Mock vectors score lower than Voyage. */
export function minScore(embedder: Embedder): number {
  if (process.env.MATCH_MIN_SCORE) return Number(process.env.MATCH_MIN_SCORE);
  return embedder.name === "mock" ? 0.3 : 0.45;
}

export async function matchQuestion(deps: MatchDeps, accountId: string, question: string): Promise<TopicMatch> {
  const { store, embedder } = deps;
  const v = await embedder.embedQuery(question);
  const [topics, posts] = await Promise.all([
    store.searchTopics(v, { accountId, status: { $in: ["Active", "Covered"] } }, 3),
    store.searchContent(v, { accountId, kind: "post", isPublic: true }, 5),
  ]);

  const bestTopic = topics[0];
  const bestPost = posts[0];
  const threshold = minScore(embedder);
  const candidates = { topics, posts, threshold };
  const none: TopicMatch = { topic: null, rootTopicId: null, branchId: null, score: Math.max(bestTopic?.score ?? 0, bestPost?.score ?? 0), posts: [], candidates };

  let topic: Topic | null = null;
  let score = 0;
  if (bestPost && bestPost.score >= (bestTopic?.score ?? 0) && bestPost.score >= threshold) {
    // Posts synced from Notion may only carry rootTopicId (topicId/branchId
    // null when they're not filed under a branch). Fall back to it so a strong
    // post match still resolves its topic instead of being dropped.
    const tid = (bestPost.doc.branchId ?? bestPost.doc.topicId ?? bestPost.doc.rootTopicId) as string | undefined;
    topic = tid ? await store.getTopic(accountId, tid) : null;
    score = bestPost.score;
  } else if (bestTopic && bestTopic.score >= threshold) {
    topic = bestTopic.doc;
    score = bestTopic.score;
  }
  if (!topic) return none;

  const rootTopicId = topic.parentTopicId ?? topic.sourceId;
  const branchId = topic.parentTopicId ? topic.sourceId : (bestPost?.doc.branchId as string | undefined) ?? null;
  const inTopic = await store.searchContent(v, { accountId, kind: "post", isPublic: true, rootTopicId }, 3);
  // Track which content the bot actually serves (fire-and-forget).
  void recordServed(accountId, inTopic.map((p) => p.doc.sourceId as string).filter(Boolean)).catch(() => {});
  return { topic, rootTopicId, branchId: branchId ?? null, score, posts: inTopic, candidates };
}

// ---------------------------------------------------------------------------
// Listings
// ---------------------------------------------------------------------------

export interface ListingCriteria {
  bedsMin?: number;
  priceMax?: number;
  priceMin?: number;
  area?: string;
  propertyType?: string;
}

const WORD_NUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };

function parseMoney(n: string, unit?: string): number {
  const v = parseFloat(n.replace(/,/g, ""));
  if (/m/i.test(unit ?? "")) return v * 1_000_000;
  if (/k/i.test(unit ?? "")) return v * 1_000;
  return v < 10_000 ? v * 1_000 : v; // "900" in a price context = 900k
}

/** Rule-based criteria extraction (offline; the live extractor returns the same shape). */
export function extractListingCriteria(text: string, knownAreas: string[] = []): ListingCriteria {
  const t = text.toLowerCase();
  const c: ListingCriteria = {};
  const beds = t.match(/(\d|one|two|three|four|five|six)\s*[- ]?\s*(?:bed|bdr|bedroom|br\b)/);
  if (beds) c.bedsMin = WORD_NUM[beds[1]] ?? Number(beds[1]);
  const under = t.match(/(?:under|below|less than|max(?:imum)?|up to|budget(?: is| of)?|around|about)\s*\$?\s*([\d.,]+)\s*(k|m|million)?/);
  if (under) {
    const v = parseMoney(under[1], under[2]);
    c.priceMax = /around|about/.test(under[0]) ? Math.round(v * 1.1) : v;
  }
  const over = t.match(/(?:over|above|at least|from)\s*\$?\s*([\d.,]+)\s*(k|m|million)?/);
  if (over) c.priceMin = parseMoney(over[1], over[2]);
  for (const a of knownAreas) if (a && t.includes(a.toLowerCase())) c.area = a;
  const type = t.match(/\b(condo|townhouse|townhome|detached|semi|bungalow|cottage|land|lot)\b/);
  if (type) c.propertyType = type[1] === "townhome" ? "townhouse" : type[1];
  return c;
}

export async function listingAreas(store: Store, accountId: string): Promise<string[]> {
  const ls = (await store.listContent(accountId, { kind: "listing", isPublic: true })) as Listing[];
  return [...new Set(ls.flatMap((l) => [l.city, l.neighbourhood].filter(Boolean) as string[]))];
}

export async function searchListings(
  deps: MatchDeps,
  accountId: string,
  query: string,
  criteria: ListingCriteria,
  limit = 3
): Promise<Scored<Listing>[]> {
  const filter: Filter = { accountId, kind: "listing", isPublic: true };
  if (criteria.bedsMin) filter.beds = { $gte: criteria.bedsMin };
  if (criteria.priceMax || criteria.priceMin) {
    const price: { $gte?: number; $lte?: number } = {};
    if (criteria.priceMin) price.$gte = criteria.priceMin;
    if (criteria.priceMax) price.$lte = criteria.priceMax;
    filter.price = price;
  }
  const v = await deps.embedder.embedQuery(query);
  const rows = (await deps.store.searchContent(v, filter, 25)) as Scored<Listing>[];
  return rows
    .filter(({ doc }) => {
      if (criteria.area) {
        const a = criteria.area.toLowerCase();
        if (![doc.city, doc.neighbourhood].some((x) => x?.toLowerCase().includes(a))) return false;
      }
      if (criteria.propertyType && !doc.propertyType.toLowerCase().includes(criteria.propertyType)) return false;
      return true;
    })
    .slice(0, limit);
}
