/**
 * Lead + the brief the agent receives (Spec section 3 Lead payload).
 */

import type { Account, Lead } from "../db/schemas";
import type { LLM, Booking } from "../providers/types";
import type { ChatState } from "./types";
import { briefPrompt } from "./prompts";
import { parseJsonReply } from "../providers/llm";
import { factsLine } from "./prompts";

export interface BriefInputs {
  account: Account;
  state: ChatState;
  leadType: "booking" | "nurture";
  booking?: Booking;
  entryPostTitle?: string;
  topicTitle?: string;
  listingTitles: string[];
}

interface BriefFields {
  situation_summary: string;
  personal_question: string;
  shift_moment: string;
  suggested_opener: string;
}

function templateFields({ state, topicTitle }: BriefInputs): BriefFields {
  const f = state.facts;
  const who = f.intent === "buyer" ? "Buyer" : f.intent === "seller" ? "Seller" : "Visitor";
  const home = [f.beds && `${f.beds}-bed`, f.propertyType].filter(Boolean).join(" ");
  const situation = [who, home && `with a ${home}`, f.area && `in ${f.area}`, f.motivation && `— ${f.motivation}`]
    .filter(Boolean)
    .join(" ");
  const q = state.questionTrail.at(-1) ?? topicTitle ?? "(not captured)";
  const hook = f.worry ?? f.motivation ?? f.timeline;
  return {
    situation_summary: situation,
    personal_question: q,
    shift_moment: state.shiftMoment ?? "",
    suggested_opener: hook ? `You mentioned "${hook}". Let's look at what that means for your situation.` : "Thanks for reaching out through the site. What prompted you to look into this now?",
  };
}

async function fields(llm: LLM | null, input: BriefInputs): Promise<BriefFields> {
  const base = templateFields(input);
  if (!llm) return base;
  try {
    const transcript = input.state.messages.map((m) => `${m.role === "user" ? "Visitor" : "Assistant"}: ${m.content}`).join("\n");
    const j = parseJsonReply<BriefFields>(
      await llm.complete({ system: briefPrompt(input.account.agent!), messages: [{ role: "user", content: transcript }], maxTokens: 400 })
    );
    return { ...base, ...(j ?? {}) };
  } catch {
    return base;
  }
}

export async function buildLead(llm: LLM | null, input: BriefInputs): Promise<{ lead: Lead & { leadId: string }; subject: string; text: string }> {
  const { state, booking, account } = input;
  const f = state.facts;
  const b = await fields(llm, input);
  const leadId = `lead_${state.conversationId}`;
  const stage = input.leadType === "booking" ? 6 : f.personal ? 3 : 1;

  const lead: Lead & { leadId: string } = {
    leadId,
    accountId: state.accountId,
    name: f.name ?? "",
    contact: f.contact ?? "",
    preferredTime: booking?.label,
    consent: true,
    situationSummary: b.situation_summary,
    entryReason: input.entryPostTitle
      ? state.entrySource === "visitor"
        ? `Said they saw the IG post "${input.entryPostTitle}"`
        : `Came from IG post "${input.entryPostTitle}"${state.utm?.medium ? ` via ${state.utm.medium} link` : ""}`
      : state.utm?.source
        ? `Came from ${state.utm.source}${state.utm.medium ? ` (${state.utm.medium} link)` : ""}; which post is unknown`
        : "Came to the site directly; source unknown",
    entryPostId: state.entryPostId,
    topicId: state.rootTopicId,
    topic: input.topicTitle,
    contentViewed: state.servedIds.map((id) => ({ postId: id, title: id, watchPct: 0 })),
    shiftMoment: b.shift_moment || undefined,
    personalQuestion: b.personal_question,
    stageReached: stage as Lead["stageReached"],
    suggestedOpener: b.suggested_opener,
    utm: state.utm,
    leadType: input.leadType,
    questionTrail: state.questionTrail,
    branchId: state.branchId,
    listingIds: state.listingIds,
    meeting: booking ? { start: booking.start, end: booking.end, kind: booking.kind, bookingId: booking.bookingId } : undefined,
    conversationId: state.conversationId,
    createdAt: new Date(),
  };

  const a = account.agent!;
  const meetingLine = booking
    ? `New ${booking.kind === "showing" ? "showing" : `${a.meeting.minutes}-min ${a.meeting.mode} call`}: ${booking.label}`
    : "New contact (not booked yet, asked to receive content)";
  const text = [
    meetingLine,
    `${lead.name || "(no name)"} · ${lead.contact}`,
    "",
    "THE QUESTION",
    `"${lead.personalQuestion}"`,
    "",
    `Situation: ${lead.situationSummary}`,
    `Known: ${factsLine(f)}`,
    input.listingTitles.length ? `Listings discussed: ${input.listingTitles.join("; ")}` : "",
    `Entry: ${lead.entryReason}`,
    lead.shiftMoment ? `Went specific: ${lead.shiftMoment}` : "",
    "",
    "How the question got specific:",
    ...state.questionTrail.map((q, i) => `  ${i + 1}. ${q}`),
    "",
    `Suggested opener: ${lead.suggestedOpener}`,
  ]
    .filter((l) => l !== "")
    .join("\n")
    .replace(/\nTHE QUESTION/, "\n\nTHE QUESTION")
    .replace(/\nHow the question/, "\n\nHow the question")
    .replace(/\nSuggested opener/, "\n\nSuggested opener");
  const subject = booking
    ? `New ${booking.kind === "showing" ? "showing" : "call"}: ${lead.name} · ${booking.label}`
    : `New contact from your site: ${lead.contact}`;
  return { lead, subject, text };
}
