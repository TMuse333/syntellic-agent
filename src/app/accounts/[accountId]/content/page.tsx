import { AccountShell } from "@/components/layout/shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  RefreshCw,
  Search,
  ExternalLink,
  Video,
  Image as ImageIcon,
  MoreVertical,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getPosts } from "@/lib/db/queries";

const typeColors: Record<string, string> = {
  "Video explainer": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  Carousel: "bg-green-500/20 text-green-400 border-green-500/30",
  "Listing graphic": "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "Listing video": "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

const statusColors: Record<string, string> = {
  Posted: "bg-green-500/20 text-green-400 border-green-500/30",
  Approved: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "Ready for review": "bg-amber-500/20 text-amber-400 border-amber-500/30",
  Draft: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  Idea: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  Scheduled: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

interface PageProps {
  params: Promise<{ accountId: string }>;
}

export default async function ContentPage({ params }: PageProps) {
  const { accountId } = await params;
  const posts = await getPosts(accountId);

  const posted = posts.filter((p) => p.status === "Posted").length;
  const byType = posts.reduce(
    (acc, p) => {
      acc[p.type] = (acc[p.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <AccountShell accountId={accountId}>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Content Library</h1>
            <p className="text-slate-500 dark:text-slate-400">
              Posts synced from Notion for RAG chatbot context
            </p>
          </div>
          <Button variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Sync from Notion
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{posts.length}</div>
              <div className="text-sm text-slate-500 dark:text-slate-400">Total Posts</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{posted}</div>
              <div className="text-sm text-slate-500 dark:text-slate-400">Posted</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">
                {posts.filter((p) => p.embedding).length}
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Embedded
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">
                {posts.length - posted}
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                In Pipeline
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Content Type Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Content Types</CardTitle>
            <CardDescription>
              Distribution of content by type
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(byType).map(([type, count]) => (
                <Badge
                  key={type}
                  variant="outline"
                  className={`text-sm ${typeColors[type] || ""}`}
                >
                  {type}: {count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
          <Input
            placeholder="Search posts by title, topic, or question..."
            className="pl-9"
          />
        </div>

        {/* Content Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Posts</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">Type</TableHead>
                  <TableHead>Post</TableHead>
                  <TableHead>Topic</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Posted</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.map((post) => (
                  <TableRow key={post.sourceId}>
                    <TableCell>
                      {post.type.includes("video") || post.type.includes("Video") ? (
                        <Video className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                      ) : (
                        <ImageIcon className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                      )}
                    </TableCell>
                    <TableCell className="max-w-[300px]">
                      <p className="font-medium line-clamp-1">{post.post}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1">
                        {post.questionAnswered}
                      </p>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{post.topicTitle || "-"}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{post.decisionStage}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[post.status] || ""}>
                        {post.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-500 dark:text-slate-400">
                      {post.postDate
                        ? new Date(post.postDate).toLocaleDateString()
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {post.igPostLink && (
                            <DropdownMenuItem>
                              <a
                                href={post.igPostLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center"
                              >
                                <ExternalLink className="mr-2 h-4 w-4" />
                                View on Instagram
                              </a>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem>View Details</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AccountShell>
  );
}
