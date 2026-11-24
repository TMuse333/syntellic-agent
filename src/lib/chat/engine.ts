/**
 * Chat engine — the conversation state machine (Spec section 7).
 *
 *   open → explore (what/how until specific) → offer → capture → book → booked
 *                   └─ not ready → nurture_offer → nurture_capture → ended
 *                   └─ out of area → ended
 *
 * Code decides every step; the writer (Claude or templates) only words it.
 * Every step emits tracking events tagged with topic + branch for the niche report.
 */

import type { Account, ContentItem, EventRecord, EventName, Listing, Topic } from "../db/schemas";
import { sendNotification } from "../notify/client";
import type { Providers } from "../providers/types";
import type { Action, ChatState, Signals, PostCard, QuickReply, RetrievalTrace } from "./types";
import { CMD } from "./types";
import { extract, mergeFacts } from "./extract";
import { writeReply } from "./writer";
import { specificity, readyForOffer, composeQuestion, MAX_EXPLORE_TURNS } from "./specificity";
import { matchQuestion, searchListings, listingAreas, minScore } from "../search/match";
import { buildLead } from "./brief";

export type EngineDeps = Omit<Providers, "fallbacks">;

export interface TurnResult {
  state: ChatState;
  reply: string;
  action: Action;
  events: EventRecord[];
  quickReplies?: QuickReply[];
  lead?: Awaited<ReturnType<typeof buildLead>>["lead"];
  /** Retrieval trace for the inspector (only populated on explore turns). */
  trace?: RetrievalTrace;
}

/** Opening shortcuts. Each just sends a message, so typing works the same. */
export const OPENERS: QuickReply[] = [
  { label: "I saw a post", value: CMD.sawPost },
  { label: "Thinking of selling", value: "I'm thinking of selling" },
  { label: "Looking to buy", value: "I'm looking to buy" },
  { label: "Just browsing", value: "Just browsing" },
];

const SAW_POST = /\b(saw|seen|watched|came from)\b.{0,40}\b(post|video|reel|carousel|instagram|insta|ig)\b/i;

const id = (p: string) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const now = () => new Date().toISOString();

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
export async function startConversation(
  deps: EngineDeps,
  account: Account,
  opts: { sessionId: string; conversationId?: string; entryPostId?: string | null; utm?: ChatState["utm"] | null }
): Promise<TurnResult> {
  if (!account.agent) throw new Error(`Account ${account.slug} has no chatbot (agent) config`);
  const state: ChatState = {
    conversationId: opts.conversationId ?? id("conv"),
    accountId: account.slug,
    sessionId: opts.sessionId,
    phase: "open",
    entryPostId: opts.entryPostId ?? undefined,
    utm: opts.utm ?? undefined,
    facts: {},
    servedIds: [],
    listingIds: [],
    questionTrail: [],
    exploreTurns: 0,
    capturePrompts: 0,
    offerAsks: 0,
    flags: {},
    messages: [],
  };
  const events: EventRecord[] = [];
  const ev = eventFactory(state, events);
  ev("site_visit");

  // A post-specific link (/p/<postId>, story/DM/bio) may carry which post they
  // clicked. Record it for attribution only — never assume they engaged with it:
  // the opener is always neutral and we don't prime the topic or mark it served.
  if (state.entryPostId) {
    const post = await deps.store.getContent(account.slug, state.entryPostId);
    if (post?.isPublic) {
      state.entrySource = "link";
      ev("entry_post", { postId: post.sourceId, source: "link" });
    } else {
      state.entryPostId = undefined; // not a real public post — drop it
    }
  }
  const action: Action = { type: "greet" };
  const reply = await writeReply(deps.llm, account.agent, state, action, { matched: [] });
  state.messages.push({ role: "assistant", content: reply, at: now() });
  await persist(deps, state, events);
  return { state, reply, action, events, quickReplies: OPENERS };
}

// ---------------------------------------------------------------------------
// Each visitor message
// ---------------------------------------------------------------------------
export async function handleMessage(deps: EngineDeps, account: Account, state: ChatState, text: string): Promise<TurnResult> {
  const agent = account.agent!;
  const events: EventRecord[] = [];
  const ev = eventFactory(state, events);
  if (!state.flags.chatStarted) {
    state.flags.chatStarted = true;
    ev("chat_start");
  }

  // "I saw a post" path: pick or describe the post before anything else.
  const picked = await postPicker(deps, account, state, text, ev);
  if (picked) {
    const reply = await writeReply(deps.llm, agent, state, picked.action, { matched: [], entryPost: picked.entryPost });
    state.messages.push({ role: "assistant", content: reply, at: now() });
    await persist(deps, state, events);
    return { state, reply, action: picked.action, events, quickReplies: quickRepliesFor(picked.action) };
  }
  state.messages.push({ role: "user", content: text, at: now() });

  const areas = await listingAreas(deps.store, account.slug);
  const { facts, signals } = await extract(deps.llm, text, state, agent.serviceAreas, areas);
  const wasPersonal = !!state.facts.personal;
  state.facts = mergeFacts(state.facts, facts);
  if (facts.inServiceArea === false) state.facts.inServiceArea = false;
  if (state.facts.personal && !wasPersonal && !state.flags.shiftLogged) {
    state.flags.shiftLogged = true;
    const n = state.messages.filter((m) => m.role === "user").length;
    state.shiftMoment = `Message ${n}: "${text.slice(0, 120)}"${state.servedIds.length ? ` (after seeing ${state.servedIds.length} post${state.servedIds.length > 1 ? "s" : ""})` : ""}`;
    ev("shift_to_personal");
  }

  let action: Action;
  let lead: TurnResult["lead"];
  const entry = state.entryPostId ? await deps.store.getContent(account.slug, state.entryPostId) : null;
  const ctx = { matched: [] as string[], entryPost: entry?.title as string | undefined };
  const sink: { trace?: RetrievalTrace } = {};

  switch (state.phase) {
    case "open":
    case "explore":
      action = await explore(deps, account, state, text, signals, ev, ctx, sink);
      break;

    case "offer":
      if (signals.offerResponse === "accept") {
        state.phase = "capture";
        action = nextCapture(state);
      } else if (signals.offerResponse === "decline" || state.offerAsks >= 1) {
        action = await toNurture(deps, account, state);
      } else {
        state.offerAsks++;
        action = { type: "reoffer" };
      }
      break;

    case "capture":
      action = nextCapture(state);
      if (action.type === "offer_slots") {
        action.slots = await deps.calendar.getSlots(account, 3);
        state.offeredSlots = action.slots;
        state.phase = "book";
      }
      break;

    case "book": {
      const slot = signals.slotIndex !== undefined ? state.offeredSlots?.[signals.slotIndex] : undefined;
      if (!slot) {
        action = { type: "offer_slots", slots: state.offeredSlots ?? (await deps.calendar.getSlots(account, 3)) };
        break;
      }
      const meeting = meetingKind(state);
      const booking = await deps.calendar.book(account, slot, {
        name: state.facts.name ?? "",
        contact: state.facts.contact ?? "",
        notes: state.questionTrail.at(-1) ?? "",
        kind: meeting,
      });
      const built = await buildLead(deps.llm, {
        account,
        state,
        leadType: "booking",
        booking,
        ...(await titles(deps, account.slug, state)),
      });
      await deps.store.insertLead(built.lead);
      if (process.env.NOTIFY_URL) {
        // Route the lead through the notify gateway (Slack + email); booking vs
        // nurture distinguished via data.leadType.
        await sendNotification({
          accountId: account.slug,
          event: "lead.captured",
          visibility: "internal",
          data: {
            leadType: built.lead.leadType,
            leadId: built.lead.leadId,
            subject: built.subject,
            text: built.text,
          },
        });
      } else {
        await deps.notifier.sendLeadBrief(account, built.lead, { subject: built.subject, text: built.text });
      }
      state.leadId = built.lead.leadId;
      lead = built.lead;
      ev("booking_made", { leadId: built.lead.leadId });
      state.phase = "booked";
      action = { type: "confirm_booking", slot, meeting };
      break;
    }

    case "nurture_offer":
      if (signals.offerResponse === "accept") {
        state.phase = "nurture_capture";
        action = state.facts.contact ? { type: "nurture_ask_consent", contact: state.facts.contact } : { type: "nurture_ask_contact" };
      } else {
        state.phase = "ended";
        action = { type: "goodbye" };
      }
      break;

    case "nurture_capture":
      if (!state.facts.contact) action = { type: "nurture_ask_contact" };
      else if (!state.facts.consent) action = { type: "nurture_ask_consent", contact: state.facts.contact };
      else {
        const built = await buildLead(deps.llm, { account, state, leadType: "nurture", ...(await titles(deps, account.slug, state)) });
        await deps.store.insertLead(built.lead);
        state.leadId = built.lead.leadId;
        lead = built.lead;
        ev("lead_captured", { leadId: built.lead.leadId });
        state.phase = "ended";
        action = { type: "nurture_done" };
      }
      break;

    default:
      action = { type: "goodbye" };
  }

  const reply = await writeReply(deps.llm, agent, state, action, ctx);
  state.messages.push({ role: "assistant", content: reply, at: now() });
  await persist(deps, state, events);
  if (sink.trace) sink.trace.decision = action.type;
  return { state, reply, action, events, lead, quickReplies: quickRepliesFor(action), trace: sink.trace };
}

// ---------------------------------------------------------------------------
// Post picker: visitor says they saw a post → recent posts / describe it
// ---------------------------------------------------------------------------
async function postPicker(
  deps: EngineDeps,
  account: Account,
  state: ChatState,
  text: string,
  ev: ReturnType<typeof eventFactory>
): Promise<{ action: Action; entryPost?: string } | null> {
  const t = text.trim();
  const isCmd = t.startsWith("/");
  const say = (content: string) => state.messages.push({ role: "user", content, at: now() });

  // 1. "I saw a post" (button or typed, only before the conversation has a direction)
  if (t === CMD.sawPost || (state.phase === "open" && !state.entryPostId && SAW_POST.test(t))) {
    say(t === CMD.sawPost ? "I saw a post" : t);
    state.phase = "pick_post";
    // Typed description? Try to find it straight away.
    if (t !== CMD.sawPost) {
      const found = await findPosts(deps, account.slug, t);
      if (found.length) return { action: { type: "confirm_post", posts: found } };
    }
    return { action: { type: "show_recent_posts", posts: await recentPosts(deps, account.slug, 4) } };
  }

  if (state.phase !== "pick_post") return null;

  // 2. Picked one
  if (t.startsWith(CMD.pickPost)) {
    const post = await deps.store.getContent(account.slug, t.slice(CMD.pickPost.length).trim());
    if (!post?.isPublic) return { action: { type: "show_recent_posts", posts: await recentPosts(deps, account.slug, 4) } };
    say(`It was "${post.title}"`);
    state.entryPostId = post.sourceId;
    state.entrySource = "visitor";
    if (!state.servedIds.includes(post.sourceId)) state.servedIds.push(post.sourceId);
    await setTopic(deps, account.slug, state, (post.branchId ?? post.topicId) as string | undefined);
    ev("entry_post", { postId: post.sourceId, source: "visitor" });
    if (state.rootTopicId) ev("topic_matched", { topicId: state.rootTopicId, via: "picked post" });
    const question = post.answers ?? post.title;
    state.questionTrail.push(question);
    state.phase = "explore";
    return { action: { type: "ask_why_post", postTitle: post.title, question }, entryPost: post.title };
  }

  // 3. None of these → ask what it was about
  if (t === CMD.noneOfThese) {
    say("None of these");
    return { action: { type: "post_not_found" } };
  }

  // 4. Typed something while picking: look for the post they describe
  if (!isCmd) {
    const found = await findPosts(deps, account.slug, t);
    if (found.length) {
      say(t);
      return { action: { type: "confirm_post", posts: found } };
    }
    // Can't find it: carry on with what they said as a normal message.
    state.phase = "open";
    return null;
  }
  return null;
}

function toCard(p: ContentItem): PostCard {
  const d = (p as { postDate?: Date | string }).postDate;
  return {
    id: p.sourceId,
    title: p.title,
    question: p.answers,
    url: p.url,
    date: d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : undefined,
  };
}

async function recentPosts(deps: EngineDeps, accountId: string, n: number): Promise<PostCard[]> {
  const posts = await deps.store.listContent(accountId, { kind: "post", isPublic: true });
  const time = (p: ContentItem) => new Date((p as { postDate?: Date | string }).postDate ?? 0).getTime();
  return posts.sort((a, b) => time(b) - time(a)).slice(0, n).map(toCard);
}

async function findPosts(deps: EngineDeps, accountId: string, text: string): Promise<PostCard[]> {
  const v = await deps.embedder.embedQuery(text);
  const rows = await deps.store.searchContent(v, { accountId, kind: "post", isPublic: true }, 3);
  const floor = minScore(deps.embedder) * 0.8;
  return rows.filter((r) => r.score >= floor).map((r) => toCard(r.doc));
}

function quickRepliesFor(action: Action): QuickReply[] | undefined {
  switch (action.type) {
    case "show_recent_posts":
    case "confirm_post":
      return [
        ...action.posts.map((p) => ({ label: p.title, value: CMD.pickPost + p.id })),
        { label: action.type === "confirm_post" ? "None of these" : "Not here", value: CMD.noneOfThese },
      ];
    case "offer":
    case "reoffer":
      return [
        { label: "No, go ahead", value: "No, go ahead" },
        { label: "Not right now", value: "Not right now" },
      ];
    case "ask_consent":
    case "nurture_ask_consent":
      return [{ label: "Yes, that's fine", value: "Yes, that's fine" }];
    case "offer_slots":
      return action.slots.map((s, i) => ({ label: s.label, value: String(i + 1) }));
    case "nurture_offer":
      return [
        { label: "Sure, send it", value: "Sure, send it" },
        { label: "No thanks", value: "No thanks" },
      ];
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// Explore: match, serve, what/how, decide when to offer
// ---------------------------------------------------------------------------
async function explore(
  deps: EngineDeps,
  account: Account,
  state: ChatState,
  text: string,
  signals: Signals,
  ev: ReturnType<typeof eventFactory>,
  ctx: { matched: string[]; entryPost?: string },
  sink?: { trace?: RetrievalTrace }
): Promise<Action> {
  const agent = account.agent!;
  state.phase = "explore";
  state.exploreTurns++;
  const f = state.facts;
  const firstTurn = state.questionTrail.length === 0;
  if (firstTurn) state.questionTrail.push(text.trim().slice(0, 200));

  // Out of area: be honest, don't book.
  if (f.area && f.inServiceArea === false) {
    state.phase = "ended";
    return { type: "out_of_area", area: f.area, region: agent.region };
  }

  // Listings: exact filters first, then similarity.
  let listings: Listing[] = [];
  const wantsListings = signals.wantsListings || (f.intent === "buyer" && state.listingIds.length === 0 && !!(f.beds || f.priceMax));
  if (wantsListings) {
    const criteria = { bedsMin: f.beds, priceMax: f.priceMax, area: f.area, propertyType: f.propertyType };
    const found = await searchListings(deps, account.slug, text, criteria);
    listings = found.map((r) => r.doc);
    for (const l of listings) if (!state.listingIds.includes(l.sourceId)) state.listingIds.push(l.sourceId);
    if (!state.branchId) state.branchId = "listings";
    ev("listing_matched", { listingIds: listings.map((l) => l.sourceId) });
    ctx.matched = listings.map((l) => `${l.title}: ${l.description}`);
    if (sink) sink.trace = {
      query: text,
      mode: "listings",
      listingCriteria: Object.fromEntries(Object.entries(criteria).filter(([, v]) => v !== undefined)),
      listingResults: found.map((r) => ({ id: r.doc.sourceId, title: r.doc.title, score: Number(r.score.toFixed(3)) })),
      decision: "",
    };
  }

  // Topic match (keep trying on the visitor's words until something matches).
  let serve: ContentItem | undefined;
  let justLogged = false;
  if (!wantsListings) {
    const userText = state.messages.filter((m) => m.role === "user").map((m) => m.content).join(" ");
    const m = await matchQuestion(deps, account.slug, state.rootTopicId ? text : userText);
    if (m.topic && !state.rootTopicId) {
      await setTopic(deps, account.slug, state, m.topic.sourceId);
      if (m.branchId && !state.branchId) state.branchId = m.branchId;
      ev("topic_matched", { topicId: m.rootTopicId!, score: Number(m.score.toFixed(3)) });
    }
    if (m.topic || state.rootTopicId) {
      serve = m.posts.map((p) => p.doc).find((p) => !state.servedIds.includes(p.sourceId));
      if (serve) state.servedIds.push(serve.sourceId);
      ctx.matched = m.posts.map((p) => `${p.doc.title}: ${(p.doc as { caption?: string }).caption ?? ""}`);
    }
    if (sink) {
      const pickedId = m.topic?.sourceId;
      sink.trace = {
        query: state.rootTopicId ? text : userText,
        mode: "topic",
        threshold: m.candidates?.threshold,
        topicCandidates: (m.candidates?.topics ?? []).map((t) => ({
          id: t.doc.sourceId,
          title: t.doc.topic,
          score: Number(t.score.toFixed(3)),
          picked: t.doc.sourceId === pickedId,
        })),
        postCandidates: (m.candidates?.posts ?? []).map((p) => ({
          id: p.doc.sourceId,
          title: p.doc.title,
          score: Number(p.score.toFixed(3)),
        })),
        matchedTopicId: m.topic ? m.rootTopicId : (state.rootTopicId ?? null),
        matchedScore: m.topic ? Number(m.score.toFixed(3)) : null,
        servedPostId: serve?.sourceId,
        decision: "",
      };
    }
    // Spec 7.8: a question nothing answers becomes a post idea.
    if (!state.rootTopicId && !state.listingIds.length && !state.flags.unansweredLogged && (state.exploreTurns >= 2 || signals.notReady)) {
      state.flags.unansweredLogged = true;
      justLogged = true;
      ev("unanswered_question", { question: state.questionTrail[0] });
    }
  }

  // Track how the question is getting specific.
  const topic = state.topicId ? await deps.store.getTopic(account.slug, state.topicId) : null;
  const q =
    signals.question ??
    composeQuestion(f, {
      topicTitle: topic?.topic,
      listingTitle: listings[0]?.title ?? (state.listingIds[0] ? (await deps.store.getContent(account.slug, state.listingIds[0]))?.title : undefined),
      downsizing: /downsiz/i.test(topic?.topic ?? "") || /downsiz/i.test((await rootTitle(deps, account.slug, state)) ?? ""),
    });
  if (q && q !== state.questionTrail.at(-1)) state.questionTrail.push(q);

  // Specific enough? Make the offer.
  // (A topic match isn't required: a specific personal question is a meeting
  //  even if no post covers it yet — it's also logged as unanswered for the niche report.)
  if (readyForOffer(f, state.exploreTurns)) {
    state.phase = "offer";
    if (!state.flags.offerLogged) {
      state.flags.offerLogged = true;
      ev("booking_offered");
    }
    const meeting = meetingKind(state);
    const listing = meeting === "showing" ? await deps.store.getContent(account.slug, state.listingIds[0]) : null;
    // Spec §7.5: ask the Topic's curated Personal question (CTA) — the one only the
    // agent can answer. Prefer the matched branch/topic's CTA, then the root
    // topic's; fall back to the composed question when no topic matched.
    let cta = topic?.personalQuestionCta;
    if (!cta && state.rootTopicId && state.rootTopicId !== state.topicId) {
      cta = (await deps.store.getTopic(account.slug, state.rootTopicId))?.personalQuestionCta;
    }
    const specificQuestion = cta ?? state.questionTrail.at(-1) ?? text;
    if (specificQuestion !== state.questionTrail.at(-1)) state.questionTrail.push(specificQuestion);
    return {
      type: "offer",
      specificQuestion,
      meeting,
      listingTitle: listing?.title,
    };
  }

  // Not ready / going nowhere: offer content for email instead of pushing.
  if ((signals.notReady && state.exploreTurns >= 2) || (state.exploreTurns > MAX_EXPLORE_TURNS && !f.personal)) {
    return toNurture(deps, account, state);
  }

  // Otherwise: one what/how question on the most useful missing detail.
  const { missing } = specificity(f);
  const greetedFromPost = state.entrySource === "link" && state.exploreTurns === 1;
  const ask = signals.notReady && state.exploreTurns === 1 ? "browsing" : listings.length ? "fit" : !f.personal && !wantsListings ? (greetedFromPost ? "relate" : "situation") : missing[0] ?? "worry";
  if (wantsListings) {
    return listings.length
      ? {
          type: "show_listings",
          listings: listings.map((l) => ({ title: l.title, price: l.price, beds: l.beds, baths: l.baths, url: l.url })),
          ask,
        }
      : { type: "no_listings", ask };
  }
  if (justLogged) return { type: "unanswered", ask };
  return {
    type: "explore",
    ask,
    serve: serve ? { title: serve.title, url: serve.url, answers: serve.answers } : undefined,
    label: dedupeLabel(state, labelFor(state)),
  };
}

/** Don't repeat the same label two turns in a row. */
function dedupeLabel(state: ChatState, label?: string) {
  const lastBot = [...state.messages].reverse().find((m) => m.role === "assistant")?.content ?? "";
  return label && lastBot.includes(label) ? undefined : label;
}

function labelFor(state: ChatState): string | undefined {
  const f = state.facts;
  if (!f.personal) return undefined;
  if (f.worry) return "Sounds like you don't want to get caught on the wrong side of this";
  if (f.motivation) return "Sounds like there's a real reason behind the timing";
  if (f.personal) return "Sounds like this is more than just curiosity";
  return undefined;
}

function nextCapture(state: ChatState): Action {
  const f = state.facts;
  state.capturePrompts++;
  if (!f.name) return { type: "ask_name" };
  if (!f.contact) return { type: "ask_contact" };
  if (!f.consent) return { type: "ask_consent", contact: f.contact };
  return { type: "offer_slots", slots: [] };
}

async function toNurture(deps: EngineDeps, account: Account, state: ChatState): Promise<Action> {
  state.phase = "nurture_offer";
  const lastServed = state.servedIds.at(-1);
  const item = lastServed ? await deps.store.getContent(account.slug, lastServed) : null;
  // Later: prefer a gated guide in the matched topic (kind "guide", gated: true).
  return { type: "nurture_offer", item: item ? { title: item.title, url: item.url } : undefined };
}

function meetingKind(state: ChatState): "call" | "showing" {
  return state.facts.intent === "buyer" && state.listingIds.length ? "showing" : "call";
}

async function setTopic(deps: EngineDeps, accountId: string, state: ChatState, topicId?: string) {
  if (!topicId) return;
  const t: Topic | null = await deps.store.getTopic(accountId, topicId);
  if (!t) return;
  state.topicId = t.sourceId;
  state.rootTopicId = t.parentTopicId ?? t.sourceId;
  if (t.parentTopicId) state.branchId = t.sourceId;
}

async function rootTitle(deps: EngineDeps, accountId: string, state: ChatState) {
  return state.rootTopicId ? (await deps.store.getTopic(accountId, state.rootTopicId))?.topic : undefined;
}

async function titles(deps: EngineDeps, accountId: string, state: ChatState) {
  const entry = state.entryPostId ? await deps.store.getContent(accountId, state.entryPostId) : null;
  const listingTitles: string[] = [];
  for (const lid of state.listingIds) {
    const l = await deps.store.getContent(accountId, lid);
    if (l) listingTitles.push(l.title);
  }
  return { entryPostTitle: entry?.title, topicTitle: await rootTitle(deps, accountId, state), listingTitles };
}

// ---------------------------------------------------------------------------
// Events + persistence
// ---------------------------------------------------------------------------
function eventFactory(state: ChatState, sink: EventRecord[]) {
  return (event: EventName, data?: Record<string, unknown>) => {
    sink.push({
      accountId: state.accountId,
      sessionId: state.sessionId,
      conversationId: state.conversationId,
      event,
      timestamp: new Date(),
      topicId: state.rootTopicId,
      branchId: state.branchId,
      entryPostId: state.entryPostId,
      data,
    });
  };
}

async function persist(deps: EngineDeps, state: ChatState, events: EventRecord[]) {
  await deps.store.insertEvents(events);
  const existing = await deps.store.getConversation(state.conversationId);
  await deps.store.saveConversation({
    _id: state.conversationId,
    accountId: state.accountId,
    sessionId: state.sessionId,
    state,
    createdAt: existing?.createdAt ?? new Date(),
    updatedAt: new Date(),
  });
}
