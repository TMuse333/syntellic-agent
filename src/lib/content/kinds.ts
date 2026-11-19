/**
 * Content kinds registry.
 *
 * Every kind declares how it becomes a searchable library item:
 * which text gets embedded and how its core fields are derived.
 * Adding a kind = adding an entry here (plus a source adapter), not new search code.
 */

import type { ContentKind, ContentCore, Post, Listing, Topic } from "../db/schemas";

type AnyItem = ContentCore & Record<string, unknown>;

export interface KindConfig {
  /** Text sent to the embedder. Changing it triggers a re-embed. */
  embeddingText(item: AnyItem): string;
  /** Public = may be served by the chatbot / website. */
  isPublic(item: AnyItem): boolean;
}

const join = (parts: unknown[]) =>
  parts
    .flat()
    .filter((p) => typeof p === "string" || typeof p === "number")
    .map(String)
    .filter((s) => s.trim())
    .join("\n\n");

export const KINDS: Record<ContentKind, KindConfig> = {
  // Spec section 5: Question answered + Topic title + Belief before + Belief after + Caption
  post: {
    embeddingText: (i) => {
      const p = i as unknown as Post;
      return join([p.questionAnswered, p.topicTitle, p.beliefBefore, p.beliefAfter, p.caption]);
    },
    isPublic: (i) => (i as unknown as Post).status === "Posted",
  },
  listing: {
    embeddingText: (i) => {
      const l = i as unknown as Listing;
      return join([
        `${l.beds}-bed ${l.propertyType} in ${l.neighbourhood ? l.neighbourhood + ", " : ""}${l.city}`,
        l.features?.join(", "),
        l.description,
      ]);
    },
    isPublic: (i) => ["active", "pending"].includes(String((i as unknown as Listing).status)),
  },
  guide: {
    embeddingText: (i) => join([i.title, i.answers, i.summary]),
    isPublic: (i) => i.isPublic !== false,
  },
  faq: {
    embeddingText: (i) => join([i.answers ?? i.title, i.answer]),
    isPublic: (i) => i.isPublic !== false,
  },
  blog: {
    embeddingText: (i) => join([i.title, i.answers, i.summary]),
    isPublic: (i) => i.isPublic !== false,
  },
  video: {
    embeddingText: (i) => join([i.title, i.answers, i.transcript]),
    isPublic: (i) => i.isPublic !== false,
  },
};

/** Spec section 5: Topic + Audience + Why it matters + Personal question (CTA) */
export function topicEmbeddingText(t: Topic): string {
  return join([t.topic, t.audience, t.whyItMatters, t.personalQuestionCta]);
}

/** Fill derived core fields (isPublic, embeddingText) for any item. */
export function normalizeItem<T extends AnyItem>(item: T): T {
  const kind = KINDS[item.kind];
  return {
    ...item,
    isPublic: kind.isPublic(item),
    embeddingText: kind.embeddingText(item),
  };
}
