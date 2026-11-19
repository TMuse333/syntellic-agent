/**
 * MongoDB Atlas Vector Search index definitions.
 *
 * `$vectorSearch` only works with indexes of type "vectorSearch" (the older
 * Atlas Search "knnVector" mapping is NOT accepted by `$vectorSearch`).
 * Every field used in a `$vectorSearch` pre-filter must be listed as a
 * "filter" field below.
 *
 * Voyage AI voyage-3 / voyage-3.5 produce 1024-dimensional embeddings.
 */

export const EMBEDDING_DIMENSIONS = 1024;

export const VECTOR_INDEX_DEFINITIONS = {
  /** Collection: topics (includes branches — a branch is a Topic with parentTopicId) */
  topics_vector_index: {
    collection: "topics",
    name: "topics_vector_index",
    type: "vectorSearch",
    definition: {
      fields: [
        { type: "vector", path: "embedding", numDimensions: EMBEDDING_DIMENSIONS, similarity: "cosine" },
        { type: "filter", path: "accountId" },
        { type: "filter", path: "status" },
        { type: "filter", path: "parentTopicId" },
      ],
    },
  },

  /** Collection: content_library (posts, listings, guides, faqs, …) */
  content_vector_index: {
    collection: "content_library",
    name: "content_vector_index",
    type: "vectorSearch",
    definition: {
      fields: [
        { type: "vector", path: "embedding", numDimensions: EMBEDDING_DIMENSIONS, similarity: "cosine" },
        { type: "filter", path: "accountId" },
        { type: "filter", path: "kind" },
        { type: "filter", path: "isPublic" },
        { type: "filter", path: "topicId" },
        { type: "filter", path: "rootTopicId" },
        { type: "filter", path: "branchId" },
        // listing filters
        { type: "filter", path: "price" },
        { type: "filter", path: "beds" },
        { type: "filter", path: "baths" },
        { type: "filter", path: "city" },
        { type: "filter", path: "propertyType" },
      ],
    },
  },
} as const;

/**
 * Create the indexes programmatically (Atlas only):
 *
 *   for (const def of Object.values(VECTOR_INDEX_DEFINITIONS)) {
 *     await db.collection(def.collection).createSearchIndex({
 *       name: def.name, type: def.type, definition: def.definition,
 *     });
 *   }
 *
 * Or in the Atlas UI: Collection → Search Indexes → Create → "Vector Search"
 * → JSON editor → paste `definition`.
 */
