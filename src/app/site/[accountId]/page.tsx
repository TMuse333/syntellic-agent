import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getStrategyAccount } from "@/lib/account/strategyAccount";
import { providers } from "@/lib/chat/service";
import type { ContentItem, Listing } from "@/lib/db/schemas";

// Always read content_library fresh — a newly Posted item must show up on the
// next request with no redeploy, so this page can never be statically cached.
export const dynamic = "force-dynamic";

/**
 * /site/[accountId] — throwaway prototype proving the real pipeline end to end:
 * agent persona + recent posts + listings come from strategy.accounts and this
 * app's own content_library (no code deploy needed for new Posted content),
 * with the existing chat widget embedded. Not the scalable home — see
 * Phase 4 of the plan for the real per-client deployment.
 */
export default async function SitePage({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  const account = await getStrategyAccount(accountId);
  if (!account?.agent) notFound();
  const agent = account.agent;

  const p = await providers();
  const [posts, listings] = await Promise.all([
    p.store.listContent(accountId, { kind: "post", isPublic: true }) as Promise<ContentItem[]>,
    p.store.listContent(accountId, { kind: "listing", isPublic: true }) as Promise<Listing[]>,
  ]);
  const recentPosts = [...posts]
    .sort((a, b) => new Date((b as { postDate?: Date }).postDate ?? 0).getTime() - new Date((a as { postDate?: Date }).postDate ?? 0).getTime())
    .slice(0, 6);

  return (
    <main className="mx-auto max-w-5xl space-y-10 px-4 py-10">
      <section className="flex flex-wrap items-start justify-between gap-6 rounded-2xl border bg-muted/30 p-8">
        <div>
          <Badge variant="secondary" className="mb-3">
            {account.isDemo ? "Demo account" : agent.brokerage}
          </Badge>
          <h1 className="text-3xl font-bold">{agent.fullName}</h1>
          <p className="mt-1 text-muted-foreground">
            {agent.title}
            {agent.brokerage ? ` · ${agent.brokerage}` : ""} · serving {agent.region}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <a
            href={`/demo/chat?account=${accountId}`}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            Chat with {agent.displayName}
          </a>
          <a href={`/site/${accountId}/inspect`} className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
            Open knowledge inspector →
          </a>
        </div>
      </section>

      {listings.length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-semibold">Listings</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => (
              <Card key={l.sourceId}>
                <CardHeader>
                  <CardTitle className="text-base">{l.title}</CardTitle>
                  <CardDescription>
                    ${l.price?.toLocaleString()} · {l.beds} bed / {l.baths} bath
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{l.description}</CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-4 text-xl font-semibold">Recent posts</h2>
        {recentPosts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No posts yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recentPosts.map((post) => (
              <Card key={post.sourceId}>
                <CardHeader>
                  <CardTitle className="text-base">{post.title}</CardTitle>
                  {post.answers && <CardDescription>{post.answers}</CardDescription>}
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          This list reads content_library live — a newly Posted item shows up here on reload, no deploy.
        </p>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">Talk to {agent.displayName}</h2>
        <iframe
          src={`/demo/chat?account=${accountId}`}
          className="h-[600px] w-full max-w-md rounded-2xl border"
          title={`Chat with ${agent.displayName}`}
        />
      </section>
    </main>
  );
}
