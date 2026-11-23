"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  LayoutGrid,
  List as ListIcon,
  Search,
  Video,
  Image as ImageIcon,
  ExternalLink,
  Bot,
  ChevronDown,
  ChevronUp,
  Globe,
  EyeOff,
} from "lucide-react";

// Serializable post shape for the library grid (embeddings stripped server-side).
export interface LibraryPost {
  sourceId: string;
  post: string;
  questionAnswered?: string;
  topicTitle?: string;
  decisionStage?: number;
  level?: string;
  status: string;
  type?: string;
  cta?: string;
  postDate?: string;
  igPostLink?: string;
  mediaUrl?: string;
  beliefBefore?: string;
  beliefAfter?: string;
  embedded: boolean;
  isPublic?: boolean;
  botRefs?: number;
  lastServedAt?: string;
}

const statusColors: Record<string, string> = {
  Posted: "bg-green-500/20 text-green-400 border-green-500/30",
  Approved: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "Ready for review": "bg-amber-500/20 text-amber-400 border-amber-500/30",
  Draft: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  Idea: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  Scheduled: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

const isVideo = (t?: string) => (t || "").toLowerCase().includes("video");
const eligible = (p: LibraryPost) => !!p.isPublic && p.embedded;

function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

/** Thumbnail with graceful fallback (mediaUrl is a Notion URL until re-hosted to Blob). */
function Thumb({ post, className }: { post: LibraryPost; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (post.mediaUrl && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={post.mediaUrl}
        alt={post.post}
        onError={() => setFailed(true)}
        className={`object-cover ${className ?? ""}`}
      />
    );
  }
  return (
    <div className={`flex items-center justify-center bg-slate-800/60 text-slate-500 ${className ?? ""}`}>
      {isVideo(post.type) ? <Video className="h-6 w-6" /> : <ImageIcon className="h-6 w-6" />}
    </div>
  );
}

function BotLine({ post }: { post: LibraryPost }) {
  const el = eligible(post);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="flex items-center gap-1 text-slate-400">
        <Bot className="h-3.5 w-3.5" /> {post.botRefs ?? 0}×
      </span>
      <span className={el ? "text-green-400" : "text-slate-500"}>
        {el ? "✓ eligible" : post.isPublic ? "⨯ not embedded" : "⨯ not public"}
      </span>
    </div>
  );
}

function Details({ post }: { post: LibraryPost }) {
  return (
    <div className="space-y-3 border-t border-slate-700/50 pt-3 text-sm">
      {post.questionAnswered && (
        <Row label="Q answered" value={post.questionAnswered} />
      )}
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-slate-400">
        {post.topicTitle && <span>Topic: {post.topicTitle}</span>}
        {post.decisionStage != null && <span>Stage: {post.decisionStage}</span>}
        {post.level && <span>Level: {post.level}</span>}
        {post.type && <span>Type: {post.type}</span>}
        {post.cta && <span>CTA: {post.cta}</span>}
        <span>Posted: {fmtDate(post.postDate)}</span>
      </div>
      {(post.beliefBefore || post.beliefAfter) && (
        <Row label="Belief" value={`${post.beliefBefore || "—"}  →  ${post.beliefAfter || "—"}`} />
      )}
      <div className="rounded-md bg-slate-800/40 p-3">
        <div className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-300">
          <Bot className="h-3.5 w-3.5" /> Bot usage
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-400">
          <span>Referenced: {post.botRefs ?? 0}×</span>
          <span>Last served: {fmtDate(post.lastServedAt)}</span>
          <span className={eligible(post) ? "text-green-400" : "text-slate-500"}>
            Eligible: {eligible(post) ? "✓ public + embedded" : "✗"}
          </span>
        </div>
        {post.questionAnswered && (
          <div className="mt-1 text-xs text-slate-500">Usable when a visitor asks: “{post.questionAnswered}”</div>
        )}
      </div>
      {post.igPostLink && (
        <a
          href={post.igPostLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" /> View on Instagram
        </a>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
      <p className="text-slate-300">{value}</p>
    </div>
  );
}

export function ContentLibrary({ posts }: { posts: LibraryPost[] }) {
  const [view, setView] = useState<"grid" | "table">("grid");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const filtered = useMemo(() => {
    const s = query.toLowerCase().trim();
    if (!s) return posts;
    return posts.filter((p) =>
      [p.post, p.topicTitle, p.questionAnswered].filter(Boolean).some((x) => x!.toLowerCase().includes(s))
    );
  }, [query, posts]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            placeholder="Search by title, topic, or question…"
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-slate-700 p-1">
          <Button variant={view === "grid" ? "default" : "ghost"} size="sm" onClick={() => setView("grid")}>
            <LayoutGrid className="mr-1 h-4 w-4" /> Grid
          </Button>
          <Button variant={view === "table" ? "default" : "ghost"} size="sm" onClick={() => setView("table")}>
            <ListIcon className="mr-1 h-4 w-4" /> Table
          </Button>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        {filtered.length} of {posts.length} posts
      </p>

      {view === "grid" ? (
        <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((post) => {
            const expanded = open.has(post.sourceId);
            return (
              <Card key={post.sourceId} className="overflow-hidden">
                <Thumb post={post} className="h-36 w-full" />
                <CardContent className="space-y-2 p-4">
                  <p className="line-clamp-2 font-medium">{post.post}</p>
                  <div className="flex flex-wrap items-center gap-1">
                    <Badge className={statusColors[post.status] || ""}>{post.status}</Badge>
                    {post.topicTitle && (
                      <Badge variant="outline" className="max-w-full truncate">
                        {post.topicTitle}
                      </Badge>
                    )}
                    {post.decisionStage != null && <Badge variant="outline">Stage {post.decisionStage}</Badge>}
                  </div>
                  <BotLine post={post} />
                  <div className="flex items-center justify-between">
                    <Button variant="ghost" size="sm" onClick={() => toggle(post.sourceId)}>
                      {expanded ? (
                        <>
                          <ChevronUp className="mr-1 h-4 w-4" /> Less
                        </>
                      ) : (
                        <>
                          <ChevronDown className="mr-1 h-4 w-4" /> Details
                        </>
                      )}
                    </Button>
                    {post.isPublic ? (
                      <Globe className="h-4 w-4 text-green-500/70" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-slate-500" />
                    )}
                  </div>
                  {expanded && <Details post={post} />}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-700/50">
              {filtered.map((post) => {
                const expanded = open.has(post.sourceId);
                return (
                  <div key={post.sourceId} className="p-3">
                    <button
                      className="flex w-full items-center gap-3 text-left"
                      onClick={() => toggle(post.sourceId)}
                    >
                      <Thumb post={post} className="h-10 w-10 shrink-0 rounded" />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 font-medium">{post.post}</p>
                        <p className="line-clamp-1 text-xs text-slate-500">{post.topicTitle || "—"}</p>
                      </div>
                      <Badge className={statusColors[post.status] || ""}>{post.status}</Badge>
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Bot className="h-3.5 w-3.5" /> {post.botRefs ?? 0}×
                      </span>
                      {expanded ? (
                        <ChevronUp className="h-4 w-4 text-slate-500" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-500" />
                      )}
                    </button>
                    {expanded && (
                      <div className="pl-13 pt-3">
                        <Details post={post} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
