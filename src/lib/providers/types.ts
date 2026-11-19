/**
 * Provider interfaces. Each outside service has a real and a mock version,
 * so the whole chat → booking → report path runs offline in tests.
 */

import type { ContentItem, Topic, Lead, EventRecord, Account } from "../db/schemas";

// ---------------------------------------------------------------------------
// Embeddings
// ---------------------------------------------------------------------------
export interface Embedder {
  readonly name: string;
  embedDocuments(texts: string[]): Promise<number[][]>;
  embedQuery(text: string): Promise<number[]>;
}

// ---------------------------------------------------------------------------
// Storage (content library, topics, conversations, leads, events)
// ---------------------------------------------------------------------------
export type FilterValue =
  | string
  | number
  | boolean
  | { $in: (string | number)[] }
  | { $gte?: number; $lte?: number };
export type Filter = Record<string, FilterValue>;

export interface Scored<T> {
  doc: T;
  score: number;
}

export interface ConversationRecord {
  _id: string; // conversationId
  accountId: string;
  sessionId: string;
  state: unknown; // ChatState (kept opaque here to avoid a cycle)
  createdAt: Date;
  updatedAt: Date;
}

export interface Store {
  readonly name: string;
  upsertTopic(topic: Topic): Promise<void>;
  listTopics(accountId: string): Promise<Topic[]>;
  getTopic(accountId: string, sourceId: string): Promise<Topic | null>;

  upsertContent(item: ContentItem): Promise<void>;
  getContent(accountId: string, sourceId: string): Promise<ContentItem | null>;
  listContent(accountId: string, filter?: Filter): Promise<ContentItem[]>;

  /** Vector search; `filter` is applied before ranking (accountId always required). */
  searchTopics(vector: number[], filter: Filter, limit: number): Promise<Scored<Topic>[]>;
  searchContent(vector: number[], filter: Filter, limit: number): Promise<Scored<ContentItem>[]>;

  saveConversation(c: ConversationRecord): Promise<void>;
  getConversation(id: string): Promise<ConversationRecord | null>;

  insertLead(lead: Lead & { leadId: string }): Promise<void>;
  listLeads(accountId: string): Promise<(Lead & { leadId: string })[]>;

  insertEvents(events: EventRecord[]): Promise<void>;
  listEvents(accountId: string): Promise<EventRecord[]>;
}

// ---------------------------------------------------------------------------
// Language model
// ---------------------------------------------------------------------------
export interface LLMMessage {
  role: "user" | "assistant";
  content: string;
}
export interface LLM {
  readonly name: string;
  complete(opts: { system: string; messages: LLMMessage[]; maxTokens?: number }): Promise<string>;
}

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------
export interface Slot {
  start: string; // ISO with offset
  end: string;
  label: string; // "Thu Oct 23, 2:00 PM"
}
export interface Booking extends Slot {
  bookingId: string;
  kind: "call" | "showing";
}
export interface Calendar {
  readonly name: string;
  getSlots(account: Account, count: number): Promise<Slot[]>;
  book(account: Account, slot: Slot, attendee: { name: string; contact: string; notes: string; kind: "call" | "showing" }): Promise<Booking>;
}

// ---------------------------------------------------------------------------
// Notifications (lead brief to the agent)
// ---------------------------------------------------------------------------
export interface Notifier {
  readonly name: string;
  sendLeadBrief(account: Account, lead: Lead & { leadId: string }, brief: { subject: string; text: string }): Promise<void>;
}

export interface Providers {
  embedder: Embedder;
  store: Store;
  llm: LLM | null; // null = offline (templated wording + rule-based extraction)
  calendar: Calendar;
  notifier: Notifier;
}
