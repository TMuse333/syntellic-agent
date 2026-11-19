/**
 * Turns the engine's Action into the bot's words.
 * Live: Claude with prompt 1. Offline: fixed templates (same structure),
 * so tests are deterministic.
 */

import type { AgentConfig } from "../db/schemas";
import type { LLM } from "../providers/types";
import type { Action, ChatState, Dimension } from "./types";
import { replyPrompt } from "./prompts";

const ASK: Record<Dimension, string> = {
  situation: "What's got you thinking about it?",
  browsing: "No rush. What were you hoping to find?",
  relate: "How does that connect to your own place?",
  property: "How would you describe the place, and whereabouts is it?",
  area: "What area are you thinking about?",
  timeline: "What's making the timing feel important right now?",
  reason: "What's behind the move?",
  worry: "What worries you most about it?",
  fit: "What would make a place the right fit for you?",
};

export function templateReply(agent: AgentConfig, state: ChatState, action: Action): string {
  const a = agent.displayName;
  switch (action.type) {
    case "greet":
      return action.entryPostTitle
        ? `Hi! I'm ${a}'s assistant. Looks like you came from ${a}'s post "${action.entryPostTitle}". What got you thinking about it?`
        : `Hi! I'm ${a}'s assistant. What brings you here today?`;
    case "show_recent_posts":
      return `Which one caught your eye? Here are ${a}'s latest:`;
    case "confirm_post":
      return "Is it one of these?";
    case "post_not_found":
      return "No problem. What was it about?";
    case "ask_why_post":
      return `Seems like "${action.question}" hit close to home. What's going on with your place that made you want to dig deeper?`;
    case "explore": {
      const serve = action.serve ? `${a} covered this here: "${action.serve.title}"${action.serve.url ? ` (${action.serve.url})` : ""}. ` : "";
      const label = action.label ? `${action.label}. ` : "";
      return `${serve}${label}${ASK[action.ask]}`;
    }
    case "show_listings":
      return `${a} has ${action.listings.length === 1 ? "one that fits" : `${action.listings.length} that fit`}: ${action.listings
        .map((l) => `${l.title}, $${l.price.toLocaleString()}, ${l.beds} bed / ${l.baths} bath`)
        .join("; ")}. ${ASK[action.ask]}`;
    case "no_listings":
      return `Nothing fits that exactly right now, but new ones come up often. ${ASK[action.ask]}`;
    case "unanswered":
      return `Good question. That's one I'll pass on to ${a}. ${ASK[action.ask]}`;
    case "offer":
      return `So the real question is: "${action.specificQuestion}" Would it be a bad idea to have ${a} ${
        action.meeting === "showing" ? `show you ${action.listingTitle ?? "it"}` : "look at that with you"
      }?`;
    case "reoffer":
      return `No pressure either way. Would it be a bad idea to have ${a} take a quick look with you?`;
    case "ask_name":
      return "Great. What's your first and last name?";
    case "ask_contact":
      return `Thanks! What's the best email or phone number for ${a} to reach you?`;
    case "ask_consent":
      return `Is it OK for ${a} to contact you at ${action.contact} about this? It's only used for this.`;
    case "offer_slots":
      return "Here are a few times. Which works best?";
    case "confirm_booking":
      return `You're booked with ${a} for ${action.slot.label}. ${a} will already know what you want to talk about.`;
    case "out_of_area":
      return `${a} works in ${action.region}, so ${action.area} is outside the area and ${a} isn't the right person for that sale. Best of luck with it!`;
    case "nurture_offer":
      return action.item
        ? `No pressure at all. Would it be a bad idea if I sent you ${a}'s "${action.item.title}" so you have it when the time comes?`
        : `No pressure at all. Would it be a bad idea if I sent you ${a}'s next post on this?`;
    case "nurture_ask_contact":
      return "What's the best email to send it to?";
    case "nurture_ask_consent":
      return `OK to send it to ${action.contact}, plus the odd related post from ${a}?`;
    case "nurture_done":
      return "Done, it's on its way. Come back anytime.";
    case "goodbye":
      return "Thanks for stopping by. Come back anytime.";
  }
}

/** Lists that must be exact (times, posts) are added by code, never written by the model. */
function slotList(action: Action): string {
  if (action.type === "offer_slots") return "\n" + action.slots.map((s, i) => `${i + 1}. ${s.label}`).join("\n");
  if (action.type === "show_recent_posts" || action.type === "confirm_post")
    return "\n" + action.posts.map((p, i) => `${i + 1}. ${p.title}${p.date ? ` (${p.date})` : ""}`).join("\n");
  return "";
}

export async function writeReply(
  llm: LLM | null,
  agent: AgentConfig,
  state: ChatState,
  action: Action,
  context: { entryPost?: string; matched: string[] }
): Promise<string> {
  if (!llm) return templateReply(agent, state, action) + slotList(action);
  try {
    const text = await llm.complete({
      system: replyPrompt(agent, state, action, context),
      messages: state.messages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
      maxTokens: 220,
    });
    return (text || templateReply(agent, state, action)) + slotList(action);
  } catch {
    // Never leave a visitor hanging if the model call fails.
    return templateReply(agent, state, action) + slotList(action);
  }
}
