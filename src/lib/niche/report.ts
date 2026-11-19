/**
 * Niche signals from the chatbot, per branch.
 *
 * This is the website session's side of the niche engine: it turns chat
 * events into per-branch numbers the Reports session's engine (CT-17) can
 * score. The scoring here is a stand-in so the demo has an end-to-end answer;
 * CT-17 owns the real formula.
 *
 *   signal = (3·bookings + 2·contacts + 1·went-specific) / chats
 *   priority = signal + C·sqrt(ln N / n)        (UCB1 exploration bonus)
 */

import type { EventRecord, Topic } from "../db/schemas";

export const WEIGHTS = { booking: 3, contact: 2, specific: 1 } as const;
export const EXPLORE_C = 0.5;
export const MIN_SAMPLE = 3;

export interface BranchRow {
  branchId: string;
  title: string;
  parentTitle?: string;
  status?: string;
  chats: number;
  wentSpecific: number;
  offered: number;
  booked: number;
  contacts: number;
  signal: number;
  priority: number;
  advice: "exploit" | "promising (small sample)" | "keep testing" | "pause" | "too early";
}

export interface NicheReport {
  rows: BranchRow[];
  /** Posts that brought people to the chat: by link, or because the visitor said so. */
  postsSeen: { postId: string; title: string; visitors: number; byLink: number; saidSo: number; booked: number }[];
  unanswered: string[];
  totals: { conversations: number; matched: number; booked: number; contacts: number; outOfArea: number };
  nextRound: string[];
}

export function buildNicheReport(events: EventRecord[], topics: Topic[], postTitles: Record<string, string> = {}): NicheReport {
  const byConv = new Map<string, EventRecord[]>();
  for (const e of events) {
    if (!e.conversationId) continue;
    (byConv.get(e.conversationId) ?? byConv.set(e.conversationId, []).get(e.conversationId)!).push(e);
  }
  const topicById = new Map(topics.map((t) => [t.sourceId, t]));
  const rows = new Map<string, BranchRow>();
  const unanswered: string[] = [];
  let matched = 0, booked = 0, contacts = 0;

  const seen = new Map<string, NicheReport["postsSeen"][number]>();
  for (const evs of byConv.values()) {
    const entry = evs.find((e) => e.event === "entry_post" && e.data?.postId);
    if (entry) {
      const pid = String(entry.data!.postId);
      const row = seen.get(pid) ?? seen.set(pid, { postId: pid, title: postTitles[pid] ?? pid, visitors: 0, byLink: 0, saidSo: 0, booked: 0 }).get(pid)!;
      row.visitors++;
      if (entry.data!.source === "visitor") row.saidSo++;
      else row.byLink++;
      if (evs.some((e) => e.event === "booking_made")) row.booked++;
    }
  }
  for (const evs of byConv.values()) {
    if (!evs.some((e) => e.event === "chat_start")) continue;
    const has = (n: string) => evs.some((e) => e.event === n);
    for (const e of evs) if (e.event === "unanswered_question" && e.data?.question) unanswered.push(String(e.data.question));
    const last = [...evs].reverse();
    const branchId = last.find((e) => e.branchId)?.branchId ?? last.find((e) => e.topicId)?.topicId ?? "unmatched";
    if (branchId !== "unmatched") matched++;
    const t = topicById.get(branchId);
    const parent = t?.parentTopicId ? topicById.get(t.parentTopicId) : undefined;
    const row =
      rows.get(branchId) ??
      rows
        .set(branchId, {
          branchId,
          title: branchId === "listings" ? "Listings (buyers)" : branchId === "unmatched" ? "Unmatched questions" : t?.topic ?? branchId,
          parentTitle: parent?.topic,
          status: t?.branchStatus,
          chats: 0, wentSpecific: 0, offered: 0, booked: 0, contacts: 0, signal: 0, priority: 0, advice: "too early",
        })
        .get(branchId)!;
    row.chats++;
    if (has("shift_to_personal")) row.wentSpecific++;
    if (has("booking_offered")) row.offered++;
    if (has("booking_made")) { row.booked++; booked++; }
    if (has("lead_captured")) { row.contacts++; contacts++; }
  }

  // Branches with no chats still show up (so "no signal yet" is visible).
  for (const t of topics) if (t.parentTopicId && !rows.has(t.sourceId))
    rows.set(t.sourceId, {
      branchId: t.sourceId, title: t.topic, parentTitle: topicById.get(t.parentTopicId)?.topic, status: t.branchStatus,
      chats: 0, wentSpecific: 0, offered: 0, booked: 0, contacts: 0, signal: 0, priority: 0, advice: "too early",
    });

  const all = [...rows.values()].filter((r) => r.branchId !== "unmatched");
  const N = Math.max(1, all.reduce((a, r) => a + r.chats, 0));
  for (const r of all) {
    r.signal = r.chats ? (WEIGHTS.booking * r.booked + WEIGHTS.contact * r.contacts + WEIGHTS.specific * r.wentSpecific) / r.chats : 0;
    r.priority = r.signal + (r.chats ? EXPLORE_C * Math.sqrt(Math.log(N) / r.chats) : EXPLORE_C * 2);
  }
  // Small samples lie: only call a branch a winner with MIN_SAMPLE chats behind it.
  const top = all.filter((r) => r.chats >= MIN_SAMPLE && r.booked > 0).sort((a, b) => b.signal - a.signal)[0];
  for (const r of all) {
    if (r.chats === 0) r.advice = "too early";
    else if (r === top) r.advice = "exploit";
    else if (r.chats < MIN_SAMPLE && r.signal >= (top?.signal ?? 1)) r.advice = "promising (small sample)";
    else if (r.chats >= MIN_SAMPLE && r.signal === 0) r.advice = "pause";
    else r.advice = "keep testing";
  }

  const nextRound: string[] = [];
  if (top?.booked) nextRound.push(`Exploit: most posts into "${top.title}" (${top.booked} booking${top.booked > 1 ? "s" : ""} from ${top.chats} chat${top.chats > 1 ? "s" : ""}).`);
  for (const r of all.filter((x) => x.advice.startsWith("promising"))) nextRound.push(`Watch "${r.title}": strong early signal from only ${r.chats} chat(s).`);
  const testing = all.filter((r) => r.advice === "keep testing" && r !== top).sort((a, b) => b.priority - a.priority).slice(0, 2);
  for (const r of testing) nextRound.push(`Keep 1 test post in "${r.title}".`);
  const untested = all.filter((r) => r.chats === 0).slice(0, 2);
  for (const r of untested) nextRound.push(`No chat signal yet for "${r.title}" — needs a post that sends people to the site.`);
  const ideas = [...new Set(unanswered)];
  if (ideas.length) nextRound.push(`${ideas.length} unanswered question(s) → new post ideas.`);

  const sorted = [...rows.values()].sort((a, b) => b.signal - a.signal || b.chats - a.chats);
  return {
    rows: sorted,
    postsSeen: [...seen.values()].sort((a, b) => b.booked - a.booked || b.visitors - a.visitors),
    unanswered: [...new Set(unanswered)],
    totals: {
      conversations: [...byConv.values()].filter((e) => e.some((x) => x.event === "chat_start")).length,
      matched,
      booked,
      contacts,
      outOfArea: 0,
    },
    nextRound,
  };
}

export function nicheTable(r: NicheReport): string {
  const head = "| Branch | Status | Chats | Went specific | Booked | Contacts | Signal | Advice |\n|---|---|---:|---:|---:|---:|---:|---|";
  const lines = r.rows.map(
    (x) => `| ${x.title}${x.parentTitle ? ` *(${x.parentTitle})*` : ""} | ${x.status ?? "–"} | ${x.chats} | ${x.wentSpecific} | ${x.booked} | ${x.contacts} | ${x.signal.toFixed(2)} | ${x.advice} |`
  );
  return [head, ...lines].join("\n");
}
