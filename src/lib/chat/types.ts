import type { Slot } from "../providers/types";

export type Phase =
  | "open" // waiting for the first message
  | "pick_post" // visitor said they saw a post; showing recent posts to pick from
  | "explore" // what/how questions until the question is specific
  | "offer" // played back the specific question + no-oriented offer
  | "capture" // name → contact → consent
  | "book" // slots offered
  | "booked"
  | "nurture_offer" // not ready: offered content (later: a guide) for email
  | "nurture_capture"
  | "ended";

export interface Facts {
  intent?: "seller" | "buyer" | "both" | "unsure";
  personal?: boolean; // talking about THEIR home / move / money
  area?: string;
  inServiceArea?: boolean;
  propertyType?: string;
  beds?: number;
  timeline?: string;
  motivation?: string;
  worry?: string;
  priceMax?: number;
  name?: string;
  contact?: string;
  consent?: boolean;
}

/** Per-turn signals from the extractor (not persisted as facts). */
export interface Signals {
  offerResponse?: "accept" | "decline" | "unclear";
  slotIndex?: number;
  wantsListings?: boolean;
  notReady?: boolean;
  /** The visitor's question in their own first-person words, as specific as it is so far. */
  question?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  at: string;
}

export interface ChatState {
  conversationId: string;
  accountId: string;
  sessionId: string;
  phase: Phase;
  entryPostId?: string;
  /** link = the URL named the post (/p/<id>); visitor = they picked/described it in chat */
  entrySource?: "link" | "visitor";
  utm?: { source?: string; medium?: string; content?: string };
  facts: Facts;
  topicId?: string; // matched topic or branch
  rootTopicId?: string;
  branchId?: string;
  servedIds: string[]; // posts shared in chat
  listingIds: string[]; // listings shared in chat
  questionTrail: string[]; // general → specific
  exploreTurns: number;
  capturePrompts: number;
  offerAsks: number;
  flags: { chatStarted?: boolean; shiftLogged?: boolean; offerLogged?: boolean; unansweredLogged?: boolean; outOfArea?: boolean };
  shiftMoment?: string;
  offeredSlots?: Slot[];
  messages: ChatMessage[];
  leadId?: string;
}

/** What the engine decided to do this turn; the writer turns it into words. */
export type Action =
  | { type: "greet"; entryPostTitle?: string }
  | { type: "show_recent_posts"; posts: PostCard[] }
  | { type: "confirm_post"; posts: PostCard[] }
  | { type: "post_not_found" }
  | { type: "ask_why_post"; postTitle: string; question: string }
  | { type: "explore"; ask: Dimension; serve?: { title: string; url?: string; answers?: string }; label?: string }
  | { type: "show_listings"; listings: { title: string; price: number; beds: number; baths: number; url?: string }[]; ask: Dimension }
  | { type: "no_listings"; ask: Dimension }
  | { type: "unanswered"; ask: Dimension }
  | { type: "offer"; specificQuestion: string; meeting: "call" | "showing"; listingTitle?: string }
  | { type: "reoffer" }
  | { type: "ask_name" }
  | { type: "ask_contact" }
  | { type: "ask_consent"; contact: string }
  | { type: "offer_slots"; slots: Slot[] }
  | { type: "confirm_booking"; slot: Slot; meeting: "call" | "showing" }
  | { type: "out_of_area"; area: string; region: string }
  | { type: "nurture_offer"; item?: { title: string; url?: string } }
  | { type: "nurture_ask_contact" }
  | { type: "nurture_ask_consent"; contact: string }
  | { type: "nurture_done" }
  | { type: "goodbye" };

export type Dimension = "situation" | "browsing" | "relate" | "property" | "area" | "timeline" | "reason" | "worry" | "fit";

export interface PostCard {
  id: string;
  title: string;
  question?: string;
  date?: string;
  url?: string;
}

/** Tappable shortcuts. `value` is sent as the visitor's message. */
export interface QuickReply {
  label: string;
  value: string;
}

/**
 * Per-turn retrieval trace for the knowledge inspector. Write-only — the chat
 * engine never reads it, so surfacing it can't change the bot's behaviour.
 */
export interface RetrievalTrace {
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
  decision: string; // the Action type the engine chose this turn
}

/** Commands sent by buttons (typed text works too). */
export const CMD = {
  sawPost: "/saw-post",
  pickPost: "/post ", // + postId
  noneOfThese: "/none",
} as const;
