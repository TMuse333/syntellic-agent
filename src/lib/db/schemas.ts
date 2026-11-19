/**
 * MongoDB schemas matching System Spec section 3 exactly.
 * Field names use camelCase but map 1:1 to Spec field names.
 *
 * Per Definition of done: all models include accountId, sourceId, embedding, syncedAt
 * where applicable. mediaUrl replaces previewUrl for CDN URLs.
 */

// =============================================================================
// Topic (Spec section 3)
// =============================================================================

export interface Topic {
  _id?: string;
  accountId: string;
  sourceId: string; // Notion page ID

  // Spec section 3 Topic fields
  topic: string; // title - e.g. "Should I sell this fall, or wait for spring?"
  audience: string;
  whyItMatters: string; // "Why it matters" in Notion
  personalQuestionCta: string; // "Personal question (CTA)" - e.g. "What would MY home sell for this fall?"
  localAngle: string; // "Local angle"
  fromLibrary?: string; // relation → Topic Library (general)
  source: string; // select
  status: "Idea" | "Active" | "Covered";
  priority: string; // select

  // Niche tree (Spec section 3, 2026-10-19): a branch is a Topic with a parent
  parentTopicId?: string; // "Parent topic" (sourceId of the broad topic)
  branchStatus?: "Testing" | "Winner" | "Paused" | "Dropped"; // "Branch status"
  round?: "Month 1" | "Month 2" | "Month 3" | "Month 4+";

  // Embedding (Spec section 5)
  embedding?: number[];
  embeddingText?: string; // Topic + Audience + Why it matters + Personal question (CTA)

  // Metadata
  syncedAt: Date;
}

// =============================================================================
// content_library — general library of anything the chatbot can serve.
// Documents are FLAT: core fields + the kind's own fields at the top level,
// so Post fields keep their exact Spec names.
// =============================================================================

export type ContentKind = "post" | "listing" | "guide" | "faq" | "blog" | "video";

export interface ContentCore {
  _id?: string;
  accountId: string;
  sourceId: string; // id in the source system (Notion page ID, MLS #, file id…)
  kind: ContentKind;
  title: string;
  url?: string; // public page for this item (e.g. /p/<postId>, /listings/<slug>)
  isPublic: boolean; // the ONLY flag the chatbot/website filter on
  topicId?: string; // Topic relation as in Notion (may point at a branch)
  rootTopicId?: string; // derived: the broad topic at the top of the niche tree
  branchId?: string; // derived: set when topicId is a branch (Topic with a parent)
  answers?: string; // the question this item answers
  gated?: boolean; // true = offered in exchange for contact info (guides)

  embedding?: number[];
  embeddingText?: string;
  syncedAt: Date;
}

// =============================================================================
// Post (Spec section 3) — kind "post"
// =============================================================================

export interface Post extends Partial<Omit<ContentCore, "accountId" | "sourceId" | "syncedAt" | "embedding" | "embeddingText">> {
  _id?: string;
  accountId: string;
  sourceId: string; // Notion page ID

  // — Identity —
  post: string; // title
  status: "Idea" | "Draft" | "Ready for review" | "Approved" | "Scheduled" | "Posted";
  postDate?: Date; // "Post date"
  type: "Carousel" | "Listing graphic" | "Listing video" | "Video explainer";

  // — Strategy —
  topicId?: string; // relation to Topic (sourceId)
  topicTitle?: string; // denormalized for embedding
  questionAnswered: string; // "Question answered" - one small question per post
  decisionStage: 1 | 2 | 3 | 4 | 5 | 6; // "Decision stage"
  level: "L1" | "L2" | "L3" | "L4" | "L5" | "L6" | "L7";
  versionOf?: string; // "Version of / Other versions" self-relation

  // — Information —
  pattern?: string; // relation → Information Patterns (general)
  beliefBefore: string; // "Belief before"
  beliefAfter: string; // "Belief after"
  surprise: string;

  // — Packaging —
  humanNatureLever: "curiosity gap" | "social proof" | "loss aversion" | "specificity" | "authority"; // "Human nature (lever)"
  literaryDevice: "contrast" | "story" | "concrete numbers" | "metaphor" | "repetition"; // "Literary device"
  videoFormat?: "Animated explainer" | "Kinetic text" | "Talking head (agent)" | "Listing walkthrough" | "Carousel to video" | "Voiceover + B-roll"; // "Video format"

  // — Execution —
  caption: string;
  cta: "DM keyword" | "Link" | "Book a call" | "None";
  mediaUrl?: string; // CDN URL (Cloudinary). Never expose Drive URLs.
  // driveLink is INTERNAL ONLY, not stored in app per Spec

  // — Measurement —
  successMetric: "Reach" | "Saves" | "DMs" | "Profile visits" | "Link taps"; // "Success metric"
  answerCheck: string[]; // "Answer check" - Direct, Specific, So what, Next step, Accurate
  igPostLink?: string; // "IG post link" - JOIN KEY to Instagram
  strategyNotes?: string; // "Strategy notes"

  // Embedding (Spec section 5)
  embedding?: number[];
  embeddingText?: string; // Question answered + Topic title + Belief before + Belief after + Caption

  // Metadata
  syncedAt: Date;
}

// =============================================================================
// Listing — kind "listing"
// =============================================================================

export interface ListingImage {
  url: string;
  alt?: string;
}

// Listing lifecycle the agent moves a property through (2026-11-16).
// Open house is NOT a status — it's an independent overlay (see openHouse) that
// can be on for any status.
export type ListingStatus =
  | "listed" // on the market
  | "price_adjustment" // still on the market, price changed
  | "accepted_offer" // under contract
  | "closed"; // deal closed / sold

export const LISTING_STATUSES: ListingStatus[] = [
  "listed",
  "price_adjustment",
  "accepted_offer",
  "closed",
];

export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  listed: "Listed",
  price_adjustment: "Price adjustment",
  accepted_offer: "Accepted offer",
  closed: "Closed",
};

export interface Listing extends ContentCore {
  kind: "listing";
  status: ListingStatus;
  // Optional overlay, independent of status.
  openHouse?: boolean;
  openHouseAt?: string; // ISO datetime of the next open house, if set
  mlsNumber?: string;
  price: number;
  beds: number;
  baths: number;
  propertyType: string; // Detached | Semi | Townhouse | Condo | Land | …
  address: string;
  city: string;
  province?: string;
  neighbourhood?: string;
  sqft?: number;
  lotSize?: string;
  features: string[];
  description: string;
  // Added for website consumption + Paragon ingest (2026-11-14)
  images?: ListingImage[];
  sourceUrl?: string; // the Paragon MLS link this was scraped from
  updatedAt?: Date; // last time the agent touched status/fields
}

export type ContentItem = ((Post & { kind: "post" }) | Listing | ContentCore) & { title: string };

// =============================================================================
// Lead (Spec section 3 - chatbot handoff, stored in Mongo, sent to agent)
// =============================================================================

export interface Lead {
  _id?: string;
  accountId: string;

  // Contact info
  name: string;
  contact: string;
  preferredTime?: string; // preferred_time
  consent: true; // Must always be true per Spec

  // Context
  situationSummary: string; // situation_summary - e.g. "Thinking of selling a 3-bed in Stratford; worried about price"
  entryReason: string; // entry_reason - e.g. "Came from IG post 'Is fall a bad time to sell?' via bio link"
  entryPostId?: string; // entry_post_id
  topicId?: string; // topic_id
  topic?: string;

  // Journey
  contentViewed: Array<{
    postId: string; // post_id
    title: string;
    watchPct: number; // watch_pct
  }>; // content_viewed

  shiftMoment?: string; // shift_moment - e.g. "Asked 'what would mine go for?' after 2nd video"
  personalQuestion?: string; // personal_question - e.g. "What would MY home sell for this fall?"
  stageReached: 1 | 2 | 3 | 4 | 5 | 6; // stage_reached

  // Agent handoff
  suggestedOpener?: string; // suggested_opener - e.g. "You mentioned price was the big worry…"

  // Attribution
  utm?: {
    source?: string;
    medium?: string;
    content?: string;
  };

  // Additions (2026-10-22, website session)
  leadType?: "booking" | "nurture"; // booked a meeting vs gave contact for content
  questionTrail?: string[]; // how the question got specific, general → specific
  branchId?: string;
  listingIds?: string[]; // listings discussed
  meeting?: { start: string; end: string; kind: "call" | "showing"; bookingId: string };
  conversationId?: string;

  createdAt: Date;
}

// =============================================================================
// Session (Spec section 6 + 8 - visitor session tracking)
// =============================================================================

export type TrackingEvent =
  | { event: "site_visit"; timestamp: Date }
  | { event: "entry_post"; timestamp: Date; postId: string }
  | { event: "video_play"; timestamp: Date; postId: string }
  | { event: "video_watch_pct"; timestamp: Date; postId: string; pct: number }
  | { event: "chat_start"; timestamp: Date }
  | { event: "topic_matched"; timestamp: Date; topicId: string }
  | { event: "shift_to_personal"; timestamp: Date }
  | { event: "booking_offered"; timestamp: Date }
  | { event: "booking_made"; timestamp: Date; leadId: string }
  | { event: "unanswered_question"; timestamp: Date; question: string }
  // Additions (2026-10-22): niche signals + listings
  | { event: "listing_matched"; timestamp: Date; listingIds: string[] }
  | { event: "lead_captured"; timestamp: Date; leadId: string };

/** Stored event row: one per event, with niche context for grouping. */
export type EventName = TrackingEvent["event"];
export interface EventRecord {
  _id?: string;
  accountId: string;
  sessionId: string;
  conversationId?: string;
  event: EventName;
  timestamp: Date;
  topicId?: string;
  branchId?: string;
  entryPostId?: string;
  data?: Record<string, unknown>;
}

export interface Session {
  _id?: string;
  accountId: string;

  // Attribution (Spec section 6)
  entryPostId?: string; // entry_post_id
  entryTopicId?: string; // entry_topic_id
  utm?: {
    source?: string;
    medium?: string;
    content?: string;
  };

  // Content viewed (Spec section 6: pages/videos viewed, watch %)
  pagesViewed: Array<{
    postId: string;
    title: string;
    watchPct: number;
    viewedAt: Date;
  }>;

  // Tracking events (Spec section 8)
  events: TrackingEvent[];

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// Account (Spec section 4 - per-account config)
// =============================================================================

// Account (Spec section 4, rewritten 2026-10-24): strategy-app's Mongo
// `strategy.accounts` is the source of truth. This app reads it read-only
// (never `platforms.instagram.accessToken`) and never stores its own copy.
export interface Account {
  name: string;
  slug: string; // accountId (matches strategy.accounts' `id`)
  isDemo?: boolean; // true for demo accounts (never mix with real data)

  notion?: {
    postsDataSourceId: string;
    topicsDataSourceId: string;
  };
  driveFolderId?: string;

  // Chatbot config: everything client-specific lives here, so a new
  // client is config, not code. Owned by strategy-app, read here.
  agent?: AgentConfig;
}

export interface AgentConfig {
  displayName: string; // "Greg", "Sam"
  fullName: string;
  title: string; // "REALTOR®"
  brokerage?: string;
  region: string; // human label, e.g. "Prince Edward Island"
  serviceAreas: string[]; // lowercase place names the agent serves
  timezone: string; // IANA, e.g. "America/Halifax"
  notifyEmail: string; // where lead briefs go
  meeting: { minutes: number; mode: "phone" | "video" | "in person" };
  voiceNotes?: string; // extra tone guidance for the prompt
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Build embedding text for a Topic (Spec section 5):
 * Topic + Audience + Why it matters + Personal question (CTA)
 */
export function buildTopicEmbeddingText(topic: Topic): string {
  return [
    topic.topic,
    topic.audience,
    topic.whyItMatters,
    topic.personalQuestionCta,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Build embedding text for a Post (Spec section 5):
 * Question answered + Topic title + Belief before + Belief after + Caption
 */
export function buildPostEmbeddingText(post: Post): string {
  return [
    post.questionAnswered,
    post.topicTitle,
    post.beliefBefore,
    post.beliefAfter,
    post.caption,
  ]
    .filter(Boolean)
    .join("\n\n");
}

// =============================================================================
// Collection names
// =============================================================================

export const COLLECTIONS = {
  topics: "topics",
  posts: "content_library", // Called "content_library" in Spec
  content: "content_library", // same collection, general name
  leads: "leads",
  events: "events",
  conversations: "conversations",
  sessions: "sessions",
} as const;
