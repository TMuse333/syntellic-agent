/**
 * Consume strategy-app's public-filtered content read model instead of pulling
 * Notion directly (CMD-01 ruling, 2026-11-21). strategy-app owns Notion access
 * AND permission filtering; syntellic-agent just ingests clean, already-public
 * content — it never filters.
 *
 * GATED behind CONTENT_SOURCE=strategy. The field shape below is PROVISIONAL,
 * pending STRAT-B's `GET /api/accounts/[id]/content` — adjust the mappers when
 * the contract is finalized. Everything downstream (embed → store → serve) is
 * unchanged; only this input adapter differs from notionSource.ts.
 */

import type { Store, Embedder } from "../providers/types";
import type { Topic, ContentItem } from "../db/schemas";
import { ingest } from "./ingest";

const STRATEGY_APP_URL = process.env.STRATEGY_APP_URL;

// --- Provisional response contract (matches the spec handed to STRAT-B) ------
interface ApiPost {
  id: string;
  title: string;
  questionAnswered?: string;
  beliefBefore?: string;
  beliefAfter?: string;
  caption?: string;
  topicId?: string;
  status?: string;
  format?: string;
  decisionStage?: number;
  level?: string;
  cta?: string;
  publishedAt?: string;
  mediaUrl?: string;
  igPostLink?: string;
  updatedAt?: string;
}
interface ApiTopic {
  id: string;
  topic: string;
  parentTopicId?: string;
  audience?: string;
  whyItMatters?: string;
  personalQuestionCta?: string;
  status?: string;
  updatedAt?: string;
}
interface ApiResponse {
  success?: boolean;
  posts?: ApiPost[];
  topics?: ApiTopic[];
}

export interface SyncResult {
  accountId: string;
  topics: number;
  posts: number;
  embedded: number;
}

function toTopic(t: ApiTopic, accountId: string, now: Date): Topic {
  return {
    accountId,
    sourceId: t.id,
    topic: t.topic,
    audience: t.audience ?? "",
    whyItMatters: t.whyItMatters ?? "",
    personalQuestionCta: t.personalQuestionCta ?? "",
    localAngle: "",
    source: "strategy-api",
    status: (t.status as Topic["status"]) ?? "Active",
    priority: "",
    parentTopicId: t.parentTopicId,
    syncedAt: now,
  };
}

function toContent(p: ApiPost, accountId: string, titleFor: (id: string) => string | undefined, now: Date): ContentItem {
  return {
    accountId,
    sourceId: p.id,
    kind: "post",
    title: p.title,
    post: p.title,
    topicId: p.topicId,
    topicTitle: p.topicId ? titleFor(p.topicId) : undefined,
    questionAnswered: p.questionAnswered,
    beliefBefore: p.beliefBefore,
    beliefAfter: p.beliefAfter,
    caption: p.caption,
    status: p.status,
    type: p.format,
    decisionStage: p.decisionStage,
    level: p.level,
    cta: p.cta,
    postDate: p.publishedAt ? new Date(p.publishedAt) : undefined,
    mediaUrl: p.mediaUrl,
    igPostLink: p.igPostLink,
    syncedAt: now,
  } as unknown as ContentItem;
}

export async function syncAccountContentFromStrategy(
  accountId: string,
  deps: { store: Store; embedder: Embedder }
): Promise<SyncResult> {
  if (!STRATEGY_APP_URL) throw new Error("STRATEGY_APP_URL is not set");

  const res = await fetch(`${STRATEGY_APP_URL}/api/accounts/${encodeURIComponent(accountId)}/content`, {
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    throw new Error(
      `strategy content API returned ${res.status} — the endpoint may not be live yet (STRAT-B). ` +
        `Until then, run with CONTENT_SOURCE=notion.`
    );
  }

  const data: ApiResponse = await res.json();
  const now = new Date();
  const topics = (data.topics ?? []).map((t) => toTopic(t, accountId, now));
  const titles = new Map(topics.map((t) => [t.sourceId, t.topic]));
  const content = (data.posts ?? []).map((p) => toContent(p, accountId, (id) => titles.get(id), now));

  const r = await ingest(deps.store, deps.embedder, { topics, content });
  return { accountId, topics: topics.length, posts: content.length, embedded: r.embedded };
}
