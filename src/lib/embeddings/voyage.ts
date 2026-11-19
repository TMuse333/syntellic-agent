// Voyage AI embeddings using direct API calls
// SDK has TypeScript issues, so using fetch instead

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const MODEL = "voyage-3"; // Current general-purpose model (1024 dimensions)

export type InputType = "document" | "query";

interface VoyageResponse {
  data: Array<{ embedding: number[] }>;
  usage: { total_tokens: number };
}

/**
 * Generate embeddings for text using Voyage AI
 * @param texts - Array of texts to embed
 * @param inputType - "document" for content being indexed, "query" for visitor messages
 */
export async function embed(
  texts: string[],
  inputType: InputType
): Promise<number[][]> {
  const response = await fetch(VOYAGE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({
      input: texts,
      model: MODEL,
      input_type: inputType,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Voyage AI error: ${response.status} ${error}`);
  }

  const result: VoyageResponse = await response.json();
  return result.data.map((d) => d.embedding);
}

/**
 * Generate a single embedding
 */
export async function embedOne(
  text: string,
  inputType: InputType
): Promise<number[]> {
  const [embedding] = await embed([text], inputType);
  return embedding;
}

/**
 * Embed content for storage (documents)
 */
export async function embedDocument(text: string): Promise<number[]> {
  return embedOne(text, "document");
}

/**
 * Embed a visitor's query for search
 */
export async function embedQuery(text: string): Promise<number[]> {
  return embedOne(text, "query");
}
