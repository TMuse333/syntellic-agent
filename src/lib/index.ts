// Database
export { connectToDatabase, getDb } from "./db/mongodb";
export {
  type Topic,
  type Post,
  type Lead,
  type Account,
  buildTopicEmbeddingText,
  buildPostEmbeddingText,
} from "./db/schemas";

// Embeddings
export {
  embed,
  embedOne,
  embedDocument,
  embedQuery,
} from "./embeddings/voyage";

// Vector Search
export {
  searchTopics,
  searchPostsInTopic,
  searchAllPosts,
  matchContent,
} from "./search/vector-search";

// Sync
export {
  upsertTopic,
  upsertPost,
  embedMissingTopics,
  embedMissingPosts,
} from "./sync/embed-content";
