/**
 * End-to-end demo run on the mock client (Sam Rivers):
 *
 *   seed → embed → match check (20 eval questions) → simulated visitors
 *   → bookings + briefs → niche report
 *
 * offline: everything mocked, deterministic (used by the test).
 * live:    real Voyage / Claude / Mongo where keys exist; visitors are
 *          played by Claude (prompt 4). Briefs are always written to files
 *          for the demo — the demo never emails anyone.
 */

import * as fs from "fs";
import * as path from "path";
import type { EventRecord } from "../db/schemas";
import { createProviders, FileNotifier, MockCalendar, type Mode } from "../providers";
import { ingest } from "../content/ingest";
import { matchQuestion } from "../search/match";
import { startConversation, handleMessage, type TurnResult } from "../chat/engine";
import { visitorPrompt } from "../chat/prompts";
import { buildNicheReport, nicheTable, type NicheReport } from "../niche/report";
import { loadDemo, type Persona } from "./fixtures";

export interface PersonaResult {
  persona: Persona;
  transcript: { role: "bot" | "visitor"; text: string; step?: string }[];
  finalPhase: string;
  booked: boolean;
  meetingKind?: "call" | "showing";
  leadType?: "booking" | "nurture";
  questionTrail: string[];
  unanswered: boolean;
  pass: boolean;
  why: string;
}

export interface DemoResult {
  mode: Mode;
  services: string[];
  match: { correct: number; total: number; rows: { id: string; question: string; expected: string | null; got: string | null; branch: string | null; score: number; pass: boolean }[] };
  personas: PersonaResult[];
  briefs: { subject: string; text: string }[];
  niche: NicheReport;
  checks: { name: string; pass: boolean; detail: string }[];
  pass: boolean;
  reportPath?: string;
}

const now = () => new Date("2026-10-22T15:00:00Z");

export async function runDemo(opts: { mode: Mode; outDir?: string; backgroundTraffic?: boolean; log?: (s: string) => void }): Promise<DemoResult> {
  const log = opts.log ?? (() => {});
  const demo = loadDemo();
  const p = await createProviders(opts.mode);
  // Demo safety: never email anyone; fixed clock so slots are stable.
  const notifier = new FileNotifier(opts.outDir ? path.join(opts.outDir, "briefs") : undefined);
  const deps = { ...p, notifier, calendar: new MockCalendar(now) };
  const services = [
    `embeddings: ${p.embedder.name}`,
    `database: ${p.store.name}`,
    `LLM: ${p.llm?.name ?? "scripted (templates + rules)"}`,
    `calendar: mock`,
    `email: files only (demo)`,
  ];
  const runId = `run_${Date.now().toString(36)}`;

  // 1. Seed + embed
  log("Seeding demo client and embedding content…");
  const ing = await ingest(deps.store, deps.embedder, { topics: demo.topics, content: demo.content });
  log(`  ${ing.topics} topics/branches, ${ing.content} library items, ${ing.embedded} embedded`);

  // 2. Match check
  log("Match check (20 eval questions)…");
  const rows: DemoResult["match"]["rows"] = [];
  for (const q of demo.evalQuestions) {
    const m = await matchQuestion(deps, demo.account.slug, q.question);
    const expected = q.should_log_as_idea ? null : q.expected_topic_id;
    rows.push({ id: q.id, question: q.question, expected, got: m.rootTopicId, branch: m.branchId, score: m.score, pass: m.rootTopicId === expected });
  }
  const correct = rows.filter((r) => r.pass).length;
  log(`  ${correct}/${rows.length} matched the right topic`);

  // 3. Simulated visitors
  const allEvents: EventRecord[] = [];
  const personas: PersonaResult[] = [];
  for (const persona of demo.personas) {
    log(`Visitor: ${persona.label}`);
    personas.push(await runPersona(deps, demo.account, persona, `${runId}_${persona.id}`, allEvents, opts.mode));
  }

  // 3b. Background traffic: each eval question as a visitor who doesn't convert,
  //     so the niche table has chats spread across branches (labelled in the report).
  if (opts.backgroundTraffic) {
    for (const q of demo.evalQuestions) {
      let r: TurnResult = await startConversation(deps, demo.account, { sessionId: `${runId}_bg_${q.id}` });
      allEvents.push(...r.events);
      for (const msg of [q.question, "Just curious, thanks", "No thanks"]) {
        if (["booked", "ended"].includes(r.state.phase)) break;
        r = await handleMessage(deps, demo.account, r.state, msg);
        allEvents.push(...r.events);
      }
    }
  }

  // 4. Niche report
  const titles = Object.fromEntries(demo.content.map((c) => [c.sourceId, c.title]));
  const niche = buildNicheReport(allEvents, demo.topics, titles);
  niche.totals.outOfArea = personas.filter((x) => x.transcript.some((t) => t.step === "out_of_area")).length;

  // 5. Checks
  const booked = personas.filter((x) => x.booked);
  const fullBrief = notifier.sent.some((s) => /THE QUESTION/.test(s.text) && /Suggested opener/.test(s.text));
  const ooa = personas.find((x) => x.persona.id === "persona-out-of-area");
  const checks = [
    { name: "Match accuracy ≥ 17/20", pass: correct >= 17, detail: `${correct}/20` },
    { name: "At least one booking with a full brief", pass: booked.length > 0 && fullBrief, detail: `${booked.length} booked, ${notifier.sent.length} brief(s)` },
    { name: "Out-of-area visitor not booked", pass: !!ooa && !ooa.booked, detail: ooa ? ooa.finalPhase : "persona missing" },
    { name: "Niche report produced", pass: niche.rows.length > 0, detail: `${niche.rows.length} branch rows` },
    { name: "Every persona behaved as expected", pass: personas.every((x) => x.pass), detail: personas.filter((x) => !x.pass).map((x) => `${x.persona.label}: ${x.why}`).join("; ") || "all" },
  ];

  const result: DemoResult = {
    mode: opts.mode,
    services: [...services, ...p.fallbacks.filter((f) => opts.mode === "live" && !f.startsWith("calendar") && !f.startsWith("email"))],
    match: { correct, total: rows.length, rows },
    personas,
    briefs: notifier.sent.map(({ subject, text }) => ({ subject, text })),
    niche,
    checks,
    pass: checks.every((c) => c.pass),
  };

  if (opts.outDir) {
    fs.mkdirSync(opts.outDir, { recursive: true });
    result.reportPath = path.join(opts.outDir, "report.md");
    fs.writeFileSync(result.reportPath, renderReport(result, !!opts.backgroundTraffic));
  }
  return result;
}

async function runPersona(
  deps: Parameters<typeof startConversation>[0],
  account: Parameters<typeof startConversation>[1],
  persona: Persona,
  sessionId: string,
  sink: EventRecord[],
  mode: Mode
): Promise<PersonaResult> {
  const transcript: PersonaResult["transcript"] = [];
  let r = await startConversation(deps, account, { sessionId, entryPostId: persona.entryPostId, utm: persona.utm });
  sink.push(...r.events);
  transcript.push({ role: "bot", text: r.reply, step: r.action.type });

  const live = mode === "live" && deps.llm;
  const entryTitle = persona.entryPostId ? (await deps.store.getContent(account.slug, persona.entryPostId))?.title : undefined;
  const maxTurns = live ? 12 : persona.scripted.length;
  for (let i = 0; i < maxTurns; i++) {
    if (["booked", "ended"].includes(r.state.phase)) break;
    let msg: string;
    if (live) {
      msg = (
        await deps.llm!.complete({
          system: visitorPrompt(persona.persona, entryTitle),
          // roles flipped: the bot is the "user" talking to the simulated visitor
          messages: transcript.map((t) => ({ role: t.role === "bot" ? ("user" as const) : ("assistant" as const), content: t.text })),
          maxTokens: 120,
        })
      ).trim();
      if (msg.includes("[END]")) break;
    } else {
      msg = persona.scripted[i];
    }
    transcript.push({ role: "visitor", text: r.quickReplies?.find((q) => q.value === msg)?.label ?? msg });
    r = await handleMessage(deps, account, r.state, msg);
    sink.push(...r.events);
    transcript.push({ role: "bot", text: r.reply, step: r.action.type });
  }

  const booked = r.state.phase === "booked";
  const leads = await deps.store.listLeads(account.slug);
  const lead = leads.find((l) => l.conversationId === r.state.conversationId);
  const unanswered = r.state.flags.unansweredLogged === true;
  const e = persona.expect;
  const problems: string[] = [];
  if (booked !== e.booked) problems.push(booked ? "booked but shouldn't" : "expected a booking");
  if (e.meetingKind && lead?.meeting?.kind !== e.meetingKind) problems.push(`expected a ${e.meetingKind}`);
  if (e.leadType && lead?.leadType !== e.leadType) problems.push(`expected a ${e.leadType} lead`);
  if (e.unanswered && !unanswered) problems.push("expected the question to be logged as unanswered");
  return {
    persona,
    transcript,
    finalPhase: r.state.phase,
    booked,
    meetingKind: lead?.meeting?.kind,
    leadType: lead?.leadType,
    questionTrail: r.state.questionTrail,
    unanswered,
    pass: problems.length === 0,
    why: problems.join(", "),
  };
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
function renderReport(r: DemoResult, traffic: boolean): string {
  const ok = (b: boolean) => (b ? "✅" : "❌");
  const lines: string[] = [];
  lines.push(`# Demo run — Sam Rivers (mock client)`, "");
  lines.push(`**Result: ${r.pass ? "PASS" : "FAIL"}** · mode: ${r.mode}`, "");
  lines.push(`Services: ${r.services.join(" · ")}`, "");
  if (r.mode === "offline")
    lines.push("> Offline mode: replies are templates and matching uses mock vectors. This proves the plumbing, not how the bot sounds. Run with keys for the real thing.", "");

  lines.push("## Checks", "");
  for (const c of r.checks) lines.push(`- ${ok(c.pass)} ${c.name} — ${c.detail}`);

  lines.push("", "## Visitors", "");
  for (const p of r.personas) {
    lines.push(`### ${ok(p.pass)} ${p.persona.label}`, "");
    lines.push(`Outcome: **${p.booked ? `booked ${p.meetingKind}` : p.leadType === "nurture" ? "contact captured (not ready)" : p.finalPhase}**${p.why ? ` — ${p.why}` : ""}`, "");
    if (p.questionTrail.length > 1) {
      lines.push("How the question got specific:");
      p.questionTrail.forEach((q, i) => lines.push(`${i + 1}. ${q}`));
      lines.push("");
    }
    lines.push("```");
    for (const t of p.transcript) lines.push(`${t.role === "bot" ? "BOT " : "THEM"}: ${t.text.replace(/\n/g, "\n      ")}`);
    lines.push("```", "");
  }

  lines.push("## What the agent receives", "");
  for (const b of r.briefs) lines.push(`**${b.subject}**`, "", "```", b.text, "```", "");

  lines.push("## What you receive: niche signals", "");
  if (traffic) lines.push("_Includes background traffic: each of the 20 eval questions as a visitor who doesn't convert._", "");
  lines.push(nicheTable(r.niche), "");
  if (r.niche.postsSeen.length) {
    lines.push("**Posts that brought people to the chat:**", "", "| Post | Visitors | Said so | By link | Booked |", "|---|---:|---:|---:|---:|");
    for (const p of r.niche.postsSeen) lines.push(`| ${p.title} | ${p.visitors} | ${p.saidSo} | ${p.byLink} | ${p.booked} |`);
    lines.push("");
  }
  lines.push(`Conversations: ${r.niche.totals.conversations} · booked: ${r.niche.totals.booked} · contacts: ${r.niche.totals.contacts}`, "");
  lines.push("**Next round (suggestion for you to approve):**");
  for (const n of r.niche.nextRound) lines.push(`- ${n}`);
  if (r.niche.unanswered.length) {
    lines.push("", "**Unanswered → post ideas:**");
    for (const u of [...new Set(r.niche.unanswered)]) lines.push(`- ${u}`);
  }
  lines.push("", "_Scoring is a stand-in: signal = (3·bookings + 2·contacts + went-specific) / chats. The real engine is CT-17 (Reports session)._");

  lines.push("", "## Match check", "", "| | Question | Expected | Got | Branch | Score |", "|---|---|---|---|---|---:|");
  for (const m of r.match.rows) lines.push(`| ${ok(m.pass)} | ${m.question} | ${m.expected ?? "none (idea)"} | ${m.got ?? "none"} | ${m.branch ?? "–"} | ${m.score.toFixed(2)} |`);
  return lines.join("\n") + "\n";
}
