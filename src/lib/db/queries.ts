/**
 * Database queries for fetching data.
 * Used by server components and API routes.
 *
 * All queries gracefully handle missing MongoDB connection,
 * returning empty/default data when DB is not configured.
 */

import { getDb, isMongoConfigured } from "./mongodb";
import { COLLECTIONS, type Topic, type Post, type Lead } from "./schemas";

// Account lookups now go through getStrategyAccount (../account/strategyAccount) —
// Spec section 4: strategy-app's Mongo is the source of truth, this app only reads it.

export async function getAccountStats(accountId: string) {
  if (!isMongoConfigured()) {
    return { posts: 0, topics: 0, leads: 0 };
  }
  try {
    const db = await getDb();

    const [postsCount, topicsCount, leadsCount] = await Promise.all([
      db.collection(COLLECTIONS.posts).countDocuments({ accountId }),
      db.collection(COLLECTIONS.topics).countDocuments({ accountId }),
      db.collection(COLLECTIONS.leads).countDocuments({ accountId }),
    ]);

    return {
      posts: postsCount,
      topics: topicsCount,
      leads: leadsCount,
    };
  } catch {
    console.error("Failed to fetch account stats:", accountId);
    return { posts: 0, topics: 0, leads: 0 };
  }
}

// =============================================================================
// Topic queries
// =============================================================================

export async function getTopics(accountId: string): Promise<Topic[]> {
  if (!isMongoConfigured()) {
    return [];
  }
  try {
    const db = await getDb();
    const topics = await db
      .collection<Topic>(COLLECTIONS.topics)
      .find({ accountId })
      .sort({ priority: 1 })
      .toArray();
    return topics;
  } catch {
    console.error("Failed to fetch topics:", accountId);
    return [];
  }
}

export async function getTopic(accountId: string, sourceId: string): Promise<Topic | null> {
  if (!isMongoConfigured()) {
    return null;
  }
  try {
    const db = await getDb();
    const topic = await db
      .collection<Topic>(COLLECTIONS.topics)
      .findOne({ accountId, sourceId });
    return topic;
  } catch {
    console.error("Failed to fetch topic:", sourceId);
    return null;
  }
}

// =============================================================================
// Post queries
// =============================================================================

export async function getPosts(accountId: string): Promise<Post[]> {
  if (!isMongoConfigured()) {
    return [];
  }
  try {
    const db = await getDb();
    const posts = await db
      .collection<Post>(COLLECTIONS.posts)
      .find({ accountId })
      .sort({ postDate: -1 })
      .toArray();
    return posts;
  } catch {
    console.error("Failed to fetch posts:", accountId);
    return [];
  }
}

export async function getPost(accountId: string, sourceId: string): Promise<Post | null> {
  if (!isMongoConfigured()) {
    return null;
  }
  try {
    const db = await getDb();
    const post = await db
      .collection<Post>(COLLECTIONS.posts)
      .findOne({ accountId, sourceId });
    return post;
  } catch {
    console.error("Failed to fetch post:", sourceId);
    return null;
  }
}

export async function getPostsByTopic(accountId: string, topicId: string): Promise<Post[]> {
  if (!isMongoConfigured()) {
    return [];
  }
  try {
    const db = await getDb();
    const posts = await db
      .collection<Post>(COLLECTIONS.posts)
      .find({ accountId, topicId })
      .sort({ decisionStage: 1 })
      .toArray();
    return posts;
  } catch {
    console.error("Failed to fetch posts by topic:", topicId);
    return [];
  }
}

// =============================================================================
// Lead queries
// =============================================================================

export async function getLeads(accountId: string): Promise<Lead[]> {
  if (!isMongoConfigured()) {
    return [];
  }
  try {
    const db = await getDb();
    const leads = await db
      .collection<Lead>(COLLECTIONS.leads)
      .find({ accountId })
      .sort({ createdAt: -1 })
      .toArray();
    return leads;
  } catch {
    console.error("Failed to fetch leads:", accountId);
    return [];
  }
}

export async function getLead(accountId: string, leadId: string): Promise<Lead | null> {
  if (!isMongoConfigured()) {
    return null;
  }
  try {
    const db = await getDb();
    const lead = await db
      .collection<Lead>(COLLECTIONS.leads)
      .findOne({ accountId, leadId });
    return lead;
  } catch {
    console.error("Failed to fetch lead:", leadId);
    return null;
  }
}
