import { AccountShell } from "@/components/layout/shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { getPosts } from "@/lib/db/queries";
import { ContentLibrary, type LibraryPost } from "@/components/content/ContentLibrary";

interface PageProps {
  params: Promise<{ accountId: string }>;
}

export default async function ContentPage({ params }: PageProps) {
  const { accountId } = await params;
  const posts = await getPosts(accountId);

  // Strip embeddings (huge arrays) and serialize dates for the client grid.
  const rows: LibraryPost[] = posts.map((p) => ({
    sourceId: p.sourceId,
    post: p.post,
    questionAnswered: p.questionAnswered,
    topicTitle: p.topicTitle,
    decisionStage: p.decisionStage,
    level: p.level,
    status: p.status,
    type: p.type,
    cta: p.cta,
    postDate: p.postDate ? new Date(p.postDate).toISOString() : undefined,
    igPostLink: p.igPostLink,
    mediaUrl: p.mediaUrl,
    beliefBefore: p.beliefBefore,
    beliefAfter: p.beliefAfter,
    embedded: !!p.embedding,
    isPublic: p.isPublic,
    botRefs: p.botRefs,
    lastServedAt: p.lastServedAt ? new Date(p.lastServedAt).toISOString() : undefined,
  }));

  const posted = rows.filter((p) => p.status === "Posted").length;
  const embedded = rows.filter((p) => p.embedded).length;
  const eligible = rows.filter((p) => p.isPublic && p.embedded).length;

  return (
    <AccountShell accountId={accountId}>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Content Library</h1>
            <p className="text-slate-500 dark:text-slate-400">
              Posts synced from Notion — the chatbot&apos;s knowledge base
            </p>
          </div>
          <Button variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Sync from Notion
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Stat label="Total posts" value={rows.length} />
          <Stat label="Posted" value={posted} />
          <Stat label="Embedded" value={embedded} />
          <Stat label="Bot-eligible" value={eligible} />
        </div>

        <ContentLibrary posts={rows} />
      </div>
    </AccountShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
      </CardContent>
    </Card>
  );
}
