"use client";

/**
 * /site/[accountId]/inspect — glass-box view of the chatbot.
 * Left: the chat, running with inspect:true. Right: what the engine retrieved
 * this turn (ranked candidates + scores, what it served, what it decided) and
 * the full knowledge corpus with matched/served items lit up.
 */
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Play, Images, FileText } from "lucide-react";

type Msg = { role: "bot" | "you"; text: string };
type Quick = { label: string; value: string };

interface Trace {
  query: string;
  mode: "topic" | "listings";
  threshold?: number;
  topicCandidates?: { id: string; title: string; score: number; picked: boolean }[];
  postCandidates?: { id: string; title: string; score: number }[];
  matchedTopicId?: string | null;
  matchedScore?: number | null;
  servedPostId?: string;
  listingCriteria?: Record<string, unknown>;
  listingResults?: { id: string; title: string; score: number }[];
  decision: string;
}
interface Inspect {
  trace?: Trace;
  rootTopicId?: string;
  branchId?: string;
  topicId?: string;
  servedIds: string[];
  listingIds: string[];
  questionTrail: string[];
  facts: Record<string, unknown>;
  events: string[];
}
interface Knowledge {
  counts: { topics: number; posts: number; listings: number; other: number };
  topicTree: { id: string; title: string; audience?: string; personalQuestion?: string; branches: { id: string; title: string }[] }[];
  posts: { id: string; title: string; answers?: string; rootTopicId?: string; branchId?: string; mediaUrl?: string; type?: string }[];
  listings: { id: string; title: string; price?: number; beds?: number; area?: string }[];
}

export default function Inspector() {
  const params = useParams();
  const accountId = (params.accountId as string) || "demo";

  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [conv, setConv] = useState<string | null>(null);
  const [quick, setQuick] = useState<Quick[]>([]);
  const [inspect, setInspect] = useState<Inspect | null>(null);
  const [meta, setMeta] = useState<{ phase?: string; step?: string }>({});
  const [kb, setKb] = useState<Knowledge | null>(null);
  const session = useRef(`sess_${Math.random().toString(36).slice(2, 10)}`);
  const end = useRef<HTMLDivElement>(null);

  async function send(message?: string, label?: string) {
    setBusy(true);
    setQuick([]);
    if (message) setMsgs((m) => [...m, { role: "you", text: label ?? message }]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accountId, sessionId: session.current, conversationId: conv ?? undefined, message, inspect: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setConv(data.conversationId);
      setMsgs((m) => [...m, { role: "bot", text: data.reply }]);
      setQuick(data.quickReplies ?? []);
      setMeta({ phase: data.phase, step: data.step });
      if (data.inspect) setInspect(data.inspect);
    } catch (e) {
      setMsgs((m) => [...m, { role: "bot", text: `(error: ${e instanceof Error ? e.message : "failed"})` }]);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    send();
    fetch(`/api/knowledge?accountId=${accountId}`).then((r) => r.json()).then(setKb).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth" }), [msgs]);

  const servedPosts = new Set(inspect?.servedIds ?? []);
  const servedListings = new Set(inspect?.listingIds ?? []);
  const activeRoot = inspect?.rootTopicId;
  const activeBranch = inspect?.branchId;
  const t = inspect?.trace;
  const facts = (inspect?.facts ?? {}) as Record<string, unknown>;
  const matchedCta = kb?.topicTree.find((r) => r.id === activeRoot)?.personalQuestion;
  const asked = inspect?.questionTrail?.at(-1);
  const anchors: { label: string; on: boolean }[] = [
    { label: "personal", on: !!facts.personal },
    { label: "in area", on: facts.inServiceArea !== false },
    { label: "area", on: !!facts.area },
    { label: "property", on: !!(facts.beds || facts.propertyType) },
    { label: "timeline", on: !!facts.timeline },
    { label: "reason", on: !!(facts.motivation || facts.worry) },
  ];

  return (
    <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[minmax(0,360px)_1fr]">
      {/* Left: chat */}
      <div className="flex h-[78vh] flex-col rounded-2xl border bg-background">
        <header className="border-b px-4 py-3">
          <p className="text-sm font-semibold">Chat · {accountId}</p>
          <p className="text-xs text-muted-foreground">Running with retrieval inspection on</p>
        </header>
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {msgs.map((m, i) => (
            <div key={i} className={m.role === "you" ? "flex justify-end" : "flex justify-start"}>
              <p className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${m.role === "you" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                {m.text}
              </p>
            </div>
          ))}
          {busy && <p className="text-xs text-muted-foreground">typing…</p>}
          {!busy && quick.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {quick.map((q) => (
                <button key={q.value} type="button" onClick={() => send(q.value, q.label)}
                  className="rounded-full border border-primary px-3 py-1.5 text-left text-sm text-primary hover:bg-primary hover:text-primary-foreground">
                  {q.label}
                </button>
              ))}
            </div>
          )}
          <div ref={end} />
        </div>
        <form className="flex gap-2 border-t p-3" onSubmit={(e) => { e.preventDefault(); const v = input.trim(); if (!v || busy) return; setInput(""); send(v); }}>
          <input className="flex-1 rounded-full border px-4 py-2 text-base outline-none" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask something…" autoComplete="off" />
          <button className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50" disabled={busy || !input.trim()}>Send</button>
        </form>
      </div>

      {/* Right: decision + retrieval + corpus */}
      <div className="space-y-6">
        {/* Decision / strategy */}
        <section className="rounded-2xl border p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Decision</h2>
            {meta.phase && (
              <span className="text-xs text-muted-foreground">
                phase <code className="rounded bg-muted px-1">{meta.phase}</code>
                {meta.step && <> · <code className="rounded bg-muted px-1">{meta.step}</code></>}
              </span>
            )}
          </div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {anchors.map((a) => (
              <span key={a.label} className={`rounded-full px-2 py-0.5 text-xs ${a.on ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground line-through opacity-60"}`}>
                {a.label}
              </span>
            ))}
          </div>
          <div className="space-y-1.5 text-sm">
            <div>
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Curated CTA (library)</span>
              <p className={matchedCta ? "" : "text-muted-foreground"}>{matchedCta ?? "— no topic matched yet —"}</p>
            </div>
            <div>
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Question the bot asked</span>
              <p className={asked ? "" : "text-muted-foreground"}>{asked ?? "— none yet —"}</p>
            </div>
            {matchedCta && asked && (
              <p className={`text-xs ${asked === matchedCta ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                {asked === matchedCta ? "✓ asking the agent's curated question" : "asking a composed question, not the curated CTA"}
              </p>
            )}
          </div>
        </section>

        {/* This turn */}
        <section className="rounded-2xl border p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">What the bot pulled this turn</h2>
          {!t ? (
            <p className="text-sm text-muted-foreground">No retrieval yet — retrieval runs while the bot is exploring a question. Ask something like &ldquo;thinking of selling my 3-bed in Etobicoke&rdquo;.</p>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                <span><span className="text-muted-foreground">query:</span> &ldquo;{t.query}&rdquo;</span>
                <span><span className="text-muted-foreground">mode:</span> {t.mode}</span>
                {t.threshold !== undefined && <span><span className="text-muted-foreground">threshold:</span> {t.threshold}</span>}
                <span><span className="text-muted-foreground">decision:</span> <code className="rounded bg-muted px-1">{t.decision}</code></span>
              </div>

              {t.mode === "topic" && (
                <>
                  <Ranked title="Topic candidates" rows={(t.topicCandidates ?? []).map((c) => ({ id: c.id, title: c.title, score: c.score, flag: c.picked ? "picked" : undefined }))} threshold={t.threshold} />
                  <Ranked title="Post candidates" rows={(t.postCandidates ?? []).map((c) => ({ id: c.id, title: c.title, score: c.score, flag: c.id === t.servedPostId ? "served" : undefined }))} threshold={t.threshold} />
                </>
              )}
              {t.mode === "listings" && (
                <>
                  <div className="text-xs text-muted-foreground">filters: {JSON.stringify(t.listingCriteria)}</div>
                  <Ranked title="Listing results" rows={(t.listingResults ?? []).map((c) => ({ id: c.id, title: c.title, score: c.score }))} />
                </>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                {inspect?.events.map((e, i) => (
                  <span key={i} className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-600 dark:text-emerald-400">{e}</span>
                ))}
              </div>
              {inspect && inspect.questionTrail.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  question trail: {inspect.questionTrail.map((q, i) => `${i + 1}. ${q}`).join("  →  ")}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Corpus */}
        <section className="rounded-2xl border p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Knowledge library</h2>
            {kb && <span className="text-xs text-muted-foreground">{kb.counts.topics} topics · {kb.counts.posts} posts · {kb.counts.listings} listings</span>}
          </div>
          {!kb ? (
            <p className="text-sm text-muted-foreground">Loading corpus…</p>
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <h3 className="mb-2 text-xs font-semibold text-muted-foreground">Topics</h3>
                <ul className="space-y-2">
                  {kb.topicTree.map((root) => (
                    <li key={root.id}>
                      <span className={`rounded px-1.5 py-0.5 text-sm ${root.id === activeRoot ? "bg-amber-400/25 font-medium" : ""}`}>{root.title}</span>
                      {root.branches.length > 0 && (
                        <ul className="ml-4 mt-1 space-y-0.5 border-l pl-3">
                          {root.branches.map((b) => (
                            <li key={b.id} className={`text-sm ${b.id === activeBranch ? "rounded bg-amber-400/25 px-1.5 font-medium" : "text-muted-foreground"}`}>{b.title}</li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-5">
                <div>
                  <h3 className="mb-2 text-xs font-semibold text-muted-foreground">Posts</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {kb.posts.map((p) => {
                      const served = servedPosts.has(p.id);
                      const matched = !served && p.rootTopicId === activeRoot;
                      return (
                        <div
                          key={p.id}
                          className={`overflow-hidden rounded-lg border ${served ? "border-emerald-500 ring-1 ring-emerald-500/40" : matched ? "border-amber-400/60" : "border-border"}`}
                        >
                          <PostThumb url={p.mediaUrl} type={p.type} />
                          <div className="p-2">
                            <p className="line-clamp-2 text-xs font-medium leading-snug">{p.title}</p>
                            <div className="mt-1 flex items-center gap-1">
                              {p.type && <span className="text-[10px] text-muted-foreground">{p.type}</span>}
                              {served && <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">· served</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {kb.listings.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-xs font-semibold text-muted-foreground">Listings</h3>
                    <ul className="space-y-1">
                      {kb.listings.map((l) => (
                        <li key={l.id} className={`rounded px-1.5 py-0.5 text-sm ${servedListings.has(l.id) ? "bg-emerald-400/25 font-medium" : ""}`}>
                          {l.title} <span className="text-xs text-muted-foreground">{l.price ? `· $${l.price.toLocaleString()}` : ""} {l.beds ? `· ${l.beds}bd` : ""}</span>
                          {servedListings.has(l.id) && <span className="ml-1 text-xs text-emerald-600 dark:text-emerald-400">· shown</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
          <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
            <span className="rounded bg-amber-400/25 px-1.5">amber</span> = matched this conversation ·
            <span className="ml-1 rounded bg-emerald-400/25 px-1.5">green</span> = served to the visitor
          </p>
        </section>
      </div>
    </main>
  );
}

function PostThumb({ url, type }: { url?: string; type?: string }) {
  const [broken, setBroken] = useState(false);
  const isVideo = /video/i.test(type ?? "");
  const Icon = isVideo ? Play : /carousel/i.test(type ?? "") ? Images : FileText;
  if (url && !broken) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" onError={() => setBroken(true)} className="aspect-[4/3] w-full object-cover" />;
  }
  return (
    <div className="flex aspect-[4/3] w-full items-center justify-center bg-gradient-to-br from-muted to-secondary">
      <Icon className="h-6 w-6 text-muted-foreground/60" />
    </div>
  );
}

function Ranked({ title, rows, threshold }: { title: string; rows: { id: string; title: string; score: number; flag?: string }[]; threshold?: number }) {
  if (rows.length === 0) return <div className="text-xs text-muted-foreground">{title}: none</div>;
  const max = Math.max(...rows.map((r) => r.score), threshold ?? 0, 0.0001);
  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold text-muted-foreground">{title}</h3>
      <ul className="space-y-1">
        {rows.map((r) => {
          const below = threshold !== undefined && r.score < threshold;
          return (
            <li key={r.id} className="flex items-center gap-2">
              <div className="h-4 flex-1 overflow-hidden rounded bg-muted">
                <div className={`h-full ${r.flag === "picked" || r.flag === "served" ? "bg-emerald-500" : below ? "bg-muted-foreground/30" : "bg-primary/60"}`} style={{ width: `${Math.round((r.score / max) * 100)}%` }} />
              </div>
              <span className="w-10 shrink-0 text-right font-mono text-xs tabular-nums">{r.score.toFixed(2)}</span>
              <span className={`flex-1 truncate text-xs ${below ? "text-muted-foreground" : ""}`}>{r.title}{r.flag && <em className="ml-1 not-italic text-emerald-600 dark:text-emerald-400">· {r.flag}</em>}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
