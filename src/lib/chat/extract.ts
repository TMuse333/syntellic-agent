/**
 * Fact + signal extraction from the visitor's message.
 * Rule-based extraction always runs (offline mode, and as a safety net for
 * contact details). In live mode Claude's JSON (prompt 2) is merged on top.
 */

import type { Facts, Signals, ChatState, Phase } from "./types";
import type { LLM } from "../providers/types";
import { extractListingCriteria } from "../search/match";
import { parseJsonReply } from "../providers/llm";
import { extractPrompt } from "./prompts";

const MONTHS = "january|february|march|april|may|june|july|august|september|october|november|december";
const NOT_PLACES = new Set([...MONTHS.split("|"), "spring", "summer", "fall", "autumn", "winter", "the", "a", "my", "our", "your"]);

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/;
const PHONE = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;

function sentenceWith(text: string, re: RegExp): string | undefined {
  const parts = text.split(/(?<=[.!?])\s+|,\s*|\s+(?:and|but|so)\s+/i);
  const hit = parts.find((p) => re.test(p));
  return hit?.trim().replace(/^(and|but|so)\s+/i, "").replace(/[.!?]+$/, "").slice(0, 140);
}

export function extractRules(text: string, state: ChatState, serviceAreas: string[], knownAreas: string[]): { facts: Facts; signals: Signals } {
  const t = text.toLowerCase().trim();
  const facts: Facts = {};
  const signals: Signals = {};
  const phase: Phase = state.phase;

  // --- intent ---
  if (/\b(sell|selling|list(ing)? (my|our)|downsiz)/.test(t)) facts.intent = "seller";
  if (/\b(buy|buying|looking for|places|listings?|for sale|showing|view(ing)?)\b/.test(t) && !/\b(sell|selling)\b/.test(t)) facts.intent = "buyer";
  if (/\b(too big|downsiz|empty nest)/.test(t)) facts.intent = "seller";

  // --- personal: about THEIR home / move / life ---
  if (
    /\b(my|our)\s+(\w+\s+){0,2}(home|house|condo|place|semi|townhouse|bungalow|property|kids|mom|dad|parents|commute|lease|job|family|wife|husband|partner)\b/.test(t) ||
    /\b(we're|we are|i'm|i am|we've|i've)\s+(thinking|planning|looking|considering|nervous|worried|been)\b/.test(t) ||
    /\b(we|i)\s+(need|want|have|own)\b/.test(t) ||
    /^it'?s an?\s/.test(t)
  )
    facts.personal = true;

  // --- property ---
  const type = t.match(/\b(semi(?:-detached)?|detached|townhouse|townhome|condo|bungalow|cottage|duplex)\b/);
  if (type) facts.propertyType = type[1].startsWith("semi") ? "semi" : type[1] === "townhome" ? "townhouse" : type[1];
  const crit = extractListingCriteria(text, knownAreas);
  if (crit.bedsMin) facts.beds = crit.bedsMin;
  if (crit.priceMax) facts.priceMax = crit.priceMax;

  // --- area: service areas, known listing areas, or "in <Place>" ---
  const svc = serviceAreas.find((a) => new RegExp(`\\b${a}\\b`, "i").test(t));
  if (svc) {
    facts.area = svc.replace(/\b\w/g, (c) => c.toUpperCase());
    facts.inServiceArea = true;
  } else {
    const m = text.match(/\b(?:in|from|near|out in)\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)?)/);
    if (m && !NOT_PLACES.has(m[1].toLowerCase())) {
      facts.area = m[1];
      facts.inServiceArea = serviceAreas.some((a) => a === m[1].toLowerCase());
    }
  }

  // --- timeline ---
  const tl = t.match(
    new RegExp(`\\b(this (?:fall|spring|summer|winter|year)|next (?:spring|summer|fall|year|month)|in \\d+ (?:months?|weeks?)|by (?:${MONTHS})|in (?:${MONTHS})|(?:${MONTHS})|asap|right away|before (?:winter|the snow|spring|christmas)|soon)\\b`)
  );
  if (tl) facts.timeline = text.substr(t.indexOf(tl[1]), tl[1].length);

  // --- reason + worry ---
  const reason = /\b(because|since|kids|mom|dad|parents|job|commute|retire|baby|relocat|moving in|too big|stairs|lease ends|more space|divorce|downsiz|subway|main floor)/i;
  const worry = /\b(worried|worry|nervous|scared|afraid|concern|don't want to|lose money|leave money|prices? drop|miss out)/i;
  const r = sentenceWith(text, reason);
  const w = sentenceWith(text, worry);
  if (r && r !== w) facts.motivation = r;
  if (w) facts.worry = w;
  if (r && w && r === w) facts.motivation = r;

  // --- contact (always) ---
  const email = text.match(EMAIL)?.[0];
  const phone = text.match(PHONE)?.[0];
  if (email || phone) facts.contact = [email, phone].filter(Boolean).join(" / ");

  // --- name (only when we asked for it) ---
  if (phase === "capture" && !state.facts.name) {
    const m = text.match(/(?:i'?m|my name is|it'?s|this is|name'?s)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/i) ?? text.trim().match(/^([A-Z][a-z]+(?:\s[A-Z][a-z'-]+){0,2})\.?$/);
    if (m) facts.name = m[1];
  }

  // --- yes / no ---
  const decline = /\b(no thanks|no thank you|not (right )?now|not yet|maybe later|i'?ll think|just looking|not ready|i'?m good|no,? i'?m ok|pass|not interested)\b|^nah\b/;
  const yes = /^(yes|yeah|yep|yup|sure|ok|okay|of course|absolutely|please|that'?s fine|fine|go ahead|sounds good|definitely|let'?s|perfect)\b/;
  const noOrientedYes = /^(no\b|nope\b|not at all|not a bad idea|no,? not a bad idea|no,? that would|no,? let'?s|that would (actually )?(help|be (great|good|helpful)))/;
  if (phase === "offer" || phase === "nurture_offer") {
    if (decline.test(t)) signals.offerResponse = "decline";
    else if (noOrientedYes.test(t) || yes.test(t) || /not a bad idea|would (actually )?help|let'?s do it|send it/.test(t)) signals.offerResponse = "accept";
    else signals.offerResponse = "unclear";
  }
  if ((phase === "capture" || phase === "nurture_capture") && state.facts.contact && !state.facts.consent) {
    if (yes.test(t) || /that'?s fine|go ahead|no problem/.test(t)) facts.consent = true;
  }

  // --- slot choice ---
  if (phase === "book") {
    const ord = t.match(/\b(first|1st|second|2nd|third|3rd|last)\b|^\s*(?:option\s*)?([123])\b/);
    if (ord) {
      const w = ord[1];
      signals.slotIndex = w ? { first: 0, "1st": 0, second: 1, "2nd": 1, third: 2, "3rd": 2, last: (state.offeredSlots?.length ?? 1) - 1 }[w] : Number(ord[2]) - 1;
    } else if (state.offeredSlots) {
      const i = state.offeredSlots.findIndex((s) => s.label.toLowerCase().split(/,?\s+/).some((part) => part.length > 2 && t.includes(part.replace(/[^a-z0-9:]/g, ""))));
      if (i >= 0) signals.slotIndex = i;
    }
  }

  // --- listings + readiness ---
  if (/\b(listings?|for sale|places|homes for sale|what do you have|any (?:\d|one|two|three|four)\s*bed)/.test(t) || (facts.intent === "buyer" && (crit.bedsMin || crit.priceMax))) signals.wantsListings = true;
  if (/\b(just (curious|wondering|browsing|looking)|no plans|not (planning|ready|looking) to|not selling|someday|down the road)\b/.test(t)) signals.notReady = true;

  return { facts, signals };
}

/** Merge new facts over old; never erase a known value with an empty one. */
export function mergeFacts(old: Facts, add: Partial<Facts>): Facts {
  const out: Facts = { ...old };
  for (const [k, v] of Object.entries(add)) {
    if (v === undefined || v === null || v === "") continue;
    (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

interface LLMExtract extends Partial<Facts> {
  offer_response?: "accept" | "decline" | "unclear" | null;
  slot?: number | null;
  wants_listings?: boolean | null;
  not_ready?: boolean | null;
  current_question?: string | null;
}

export async function extract(
  llm: LLM | null,
  text: string,
  state: ChatState,
  serviceAreas: string[],
  knownAreas: string[]
): Promise<{ facts: Facts; signals: Signals }> {
  const rules = extractRules(text, state, serviceAreas, knownAreas);
  if (!llm) return rules;

  const reply = await llm.complete({
    system: extractPrompt(state),
    messages: [{ role: "user", content: text }],
    maxTokens: 400,
  });
  const j = parseJsonReply<LLMExtract>(reply);
  if (!j) return rules;

  const facts: Facts = mergeFacts(rules.facts, {
    intent: j.intent ?? undefined,
    personal: j.personal ?? undefined,
    area: j.area ?? undefined,
    propertyType: j.propertyType ?? undefined,
    beds: j.beds ?? undefined,
    timeline: j.timeline ?? undefined,
    motivation: j.motivation ?? undefined,
    worry: j.worry ?? undefined,
    priceMax: j.priceMax ?? undefined,
    name: j.name ?? undefined,
    // contact: rules win (exact strings); consent: only explicit
    consent: j.consent === true && rules.facts.consent !== false ? true : undefined,
  });
  if (facts.area) facts.inServiceArea = serviceAreas.some((a) => facts.area!.toLowerCase().includes(a));
  const signals: Signals = {
    ...rules.signals,
    offerResponse: j.offer_response ?? rules.signals.offerResponse,
    slotIndex: typeof j.slot === "number" ? j.slot - 1 : rules.signals.slotIndex,
    wantsListings: j.wants_listings ?? rules.signals.wantsListings,
    notReady: j.not_ready ?? rules.signals.notReady,
    question: j.current_question ?? undefined,
  };
  return { facts, signals };
}
