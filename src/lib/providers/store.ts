import type { Db } from "mongodb";
import type { Store, Filter, FilterValue, Scored, ConversationRecord } from "./types";
import type { Topic, ContentItem, Lead, EventRecord } from "../db/schemas";
import { COLLECTIONS } from "../db/schemas";
import { cosine } from "./embedder";

// ---------------------------------------------------------------------------
// Filter matching (shared by the in-memory store; mirrors $vectorSearch filters)
// ---------------------------------------------------------------------------
function matchValue(actual: unknown, cond: FilterValue): boolean {
  if (cond !== null && typeof cond === "object") {
    if ("$in" in cond) return cond.$in.includes(actual as string | number);
    const n = typeof actual === "number" ? actual : NaN;
    if (cond.$gte !== undefined && !(n >= cond.$gte)) return false;
    if (cond.$lte !== undefined && !(n <= cond.$lte)) return false;
    return true;
  }
  if (typeof cond === "string" && typeof actual === "string") return actual.toLowerCase() === cond.toLowerCase();
  return actual === cond;
}
export function matchesFilter(doc: Record<string, unknown>, filter: Filter): boolean {
  return Object.entries(filter).every(([k, v]) => matchValue(doc[k], v));
}

type LeadDoc = Lead & { leadId: string };

// ---------------------------------------------------------------------------
// In-memory store (tests, offline demo)
// ---------------------------------------------------------------------------
export class MemoryStore implements Store {
  readonly name = "memory";
  topics = new Map<string, Topic>();
  content = new Map<string, ContentItem>();
  conversations = new Map<string, ConversationRecord>();
  leads: LeadDoc[] = [];
  events: EventRecord[] = [];

  private key(accountId: string, sourceId: string) {
    return `${accountId}::${sourceId}`;
  }
  async upsertTopic(t: Topic) {
    this.topics.set(this.key(t.accountId, t.sourceId), t);
  }
  async listTopics(accountId: string) {
    return [...this.topics.values()].filter((t) => t.accountId === accountId);
  }
  async getTopic(accountId: string, sourceId: string) {
    return this.topics.get(this.key(accountId, sourceId)) ?? null;
  }
  async upsertContent(i: ContentItem) {
    this.content.set(this.key(i.accountId, i.sourceId), i);
  }
  async getContent(accountId: string, sourceId: string) {
    return this.content.get(this.key(accountId, sourceId)) ?? null;
  }
  async listContent(accountId: string, filter: Filter = {}) {
    return [...this.content.values()].filter(
      (c) => c.accountId === accountId && matchesFilter(c as unknown as Record<string, unknown>, filter)
    );
  }
  private rank<T extends { embedding?: number[] }>(docs: T[], vector: number[], limit: number): Scored<T>[] {
    return docs
      .filter((d) => d.embedding)
      .map((doc) => ({ doc, score: cosine(vector, doc.embedding!) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
  async searchTopics(vector: number[], filter: Filter, limit: number) {
    const docs = [...this.topics.values()].filter((t) => matchesFilter(t as unknown as Record<string, unknown>, filter));
    return this.rank(docs, vector, limit);
  }
  async searchContent(vector: number[], filter: Filter, limit: number) {
    const docs = [...this.content.values()].filter((c) => matchesFilter(c as unknown as Record<string, unknown>, filter));
    return this.rank(docs, vector, limit);
  }
  async saveConversation(c: ConversationRecord) {
    this.conversations.set(c._id, c);
  }
  async getConversation(id: string) {
    return this.conversations.get(id) ?? null;
  }
  async insertLead(l: LeadDoc) {
    this.leads.push(l);
  }
  async listLeads(accountId: string) {
    return this.leads.filter((l) => l.accountId === accountId);
  }
  async insertEvents(e: EventRecord[]) {
    this.events.push(...e);
  }
  async listEvents(accountId: string) {
    return this.events.filter((e) => e.accountId === accountId);
  }
}

// ---------------------------------------------------------------------------
// MongoDB Atlas store (live). Requires the vector indexes in db/indexes.ts.
// ---------------------------------------------------------------------------
function toMongoFilter(filter: Filter): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(filter)) {
    out[k] = v !== null && typeof v === "object" ? v : { $eq: v };
  }
  return out;
}

export class MongoStore implements Store {
  readonly name = "mongo";
  constructor(private db: Db) {}

  async upsertTopic(t: Topic) {
    await this.db
      .collection(COLLECTIONS.topics)
      .updateOne({ accountId: t.accountId, sourceId: t.sourceId }, { $set: t }, { upsert: true });
  }
  async listTopics(accountId: string) {
    return this.db.collection<Topic>(COLLECTIONS.topics).find({ accountId }, { projection: { _id: 0 } }).toArray();
  }
  async getTopic(accountId: string, sourceId: string) {
    return this.db.collection<Topic>(COLLECTIONS.topics).findOne({ accountId, sourceId }, { projection: { _id: 0 } });
  }
  async upsertContent(i: ContentItem) {
    await this.db
      .collection(COLLECTIONS.content)
      .updateOne({ accountId: i.accountId, sourceId: i.sourceId }, { $set: i }, { upsert: true });
  }
  async getContent(accountId: string, sourceId: string) {
    return this.db
      .collection<ContentItem>(COLLECTIONS.content)
      .findOne({ accountId, sourceId }, { projection: { _id: 0 } }) as Promise<ContentItem | null>;
  }
  async listContent(accountId: string, filter: Filter = {}) {
    return this.db
      .collection<ContentItem>(COLLECTIONS.content)
      .find({ accountId, ...toMongoFilter(filter) }, { projection: { _id: 0 } })
      .toArray() as Promise<ContentItem[]>;
  }
  private async vector<T>(collection: string, index: string, vector: number[], filter: Filter, limit: number): Promise<Scored<T>[]> {
    // Preferred path: Atlas $vectorSearch (needs the indexes in db/indexes.ts).
    try {
      const rows = await this.db
        .collection(collection)
        .aggregate([
          {
            $vectorSearch: {
              index,
              path: "embedding",
              queryVector: vector,
              numCandidates: Math.max(limit * 20, 100),
              limit,
              filter: toMongoFilter(filter),
            },
          },
          { $addFields: { _score: { $meta: "vectorSearchScore" } } },
          { $project: { _id: 0 } },
        ])
        .toArray();
      if (rows.length) return rows.map(({ _score, ...doc }) => ({ doc: doc as T, score: _score as number }));
    } catch {
      // Index not created yet — fall through to in-process ranking.
    }
    // Fallback: fetch the filtered set and rank with cosine in JS. Fine for a
    // single client's corpus; means semantic match works before the Atlas
    // vector indexes exist (and small clients may never need them).
    const docs = (await this.db
      .collection(collection)
      .find(toMongoFilter(filter), { projection: { _id: 0 } })
      .toArray()) as unknown as (T & { embedding?: number[] })[];
    return docs
      .filter((d) => Array.isArray(d.embedding))
      .map((doc) => ({ doc: doc as T, score: cosine(vector, doc.embedding!) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
  searchTopics(vector: number[], filter: Filter, limit: number) {
    return this.vector<Topic>(COLLECTIONS.topics, "topics_vector_index", vector, filter, limit);
  }
  searchContent(vector: number[], filter: Filter, limit: number) {
    return this.vector<ContentItem>(COLLECTIONS.content, "content_vector_index", vector, filter, limit);
  }
  async saveConversation(c: ConversationRecord) {
    await this.db.collection<ConversationRecord>(COLLECTIONS.conversations).replaceOne({ _id: c._id }, c, { upsert: true });
  }
  async getConversation(id: string) {
    return this.db.collection<ConversationRecord>(COLLECTIONS.conversations).findOne({ _id: id });
  }
  async insertLead(l: LeadDoc) {
    const { _id, ...doc } = l; // let Mongo assign its own ObjectId
    void _id;
    await this.db.collection(COLLECTIONS.leads).insertOne(doc);
  }
  async listLeads(accountId: string) {
    return this.db.collection<LeadDoc>(COLLECTIONS.leads).find({ accountId }, { projection: { _id: 0 } }).toArray();
  }
  async insertEvents(e: EventRecord[]) {
    if (e.length) await this.db.collection(COLLECTIONS.events).insertMany(e.map(({ _id, ...x }) => (void _id, x)));
  }
  async listEvents(accountId: string) {
    return this.db.collection<EventRecord>(COLLECTIONS.events).find({ accountId }, { projection: { _id: 0 } }).toArray();
  }
}
