/**
 * GET /api/knowledge?accountId=demo
 *
 * The full corpus the chatbot can draw from for one account: the topic tree
 * (roots + branches) and every public content item (posts, listings, …).
 * Read-only; backs the knowledge inspector so you can see what retrieval
 * is choosing *from*.
 */
import { NextRequest, NextResponse } from "next/server";
import { providers } from "@/lib/chat/service";
import type { ContentItem, Topic } from "@/lib/db/schemas";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const accountId = request.nextUrl.searchParams.get("accountId");
  if (!accountId) return NextResponse.json({ error: "accountId is required" }, { status: 400 });

  const p = await providers();
  const [topics, content] = await Promise.all([
    p.store.listTopics(accountId),
    p.store.listContent(accountId, { isPublic: true }),
  ]);

  // Topic tree: roots with their branches nested underneath.
  const byId = new Map<string, Topic>(topics.map((t) => [t.sourceId, t]));
  const roots = topics.filter((t) => !t.parentTopicId);
  const topicTree = roots.map((root) => ({
    id: root.sourceId,
    title: root.topic,
    audience: root.audience,
    personalQuestion: root.personalQuestionCta,
    status: root.status,
    branches: topics
      .filter((t) => t.parentTopicId === root.sourceId)
      .map((b) => ({ id: b.sourceId, title: b.topic, branchStatus: b.branchStatus })),
  }));
  // Branches whose parent isn't in the set (defensive) still get listed.
  const orphanBranches = topics
    .filter((t) => t.parentTopicId && !byId.has(t.parentTopicId))
    .map((b) => ({ id: b.sourceId, title: b.topic, branches: [] as unknown[], orphanOf: b.parentTopicId }));

  const posts = (content as ContentItem[])
    .filter((c) => c.kind === "post")
    .map((c) => {
      const p = c as ContentItem & { mediaUrl?: string; type?: string };
      return {
        id: c.sourceId,
        title: c.title,
        answers: c.answers,
        topicId: c.topicId,
        rootTopicId: c.rootTopicId,
        branchId: c.branchId,
        mediaUrl: p.mediaUrl,
        type: p.type,
        url: c.url,
      };
    });

  const listings = (content as ContentItem[])
    .filter((c) => c.kind === "listing")
    .map((c) => {
      const l = c as ContentItem & { price?: number; beds?: number; baths?: number; city?: string; neighbourhood?: string };
      return { id: c.sourceId, title: c.title, price: l.price, beds: l.beds, baths: l.baths, area: l.neighbourhood ?? l.city };
    });

  const otherKinds = (content as ContentItem[])
    .filter((c) => c.kind !== "post" && c.kind !== "listing")
    .map((c) => ({ id: c.sourceId, title: c.title, kind: c.kind, answers: c.answers }));

  return NextResponse.json({
    accountId,
    counts: { topics: topics.length, posts: posts.length, listings: listings.length, other: otherKinds.length },
    topicTree: [...topicTree, ...orphanBranches],
    posts,
    listings,
    other: otherKinds,
  });
}
