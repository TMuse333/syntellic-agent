import type { Embedder } from "./types";
import { embed } from "../embeddings/voyage";
import { EMBEDDING_DIMENSIONS } from "../db/indexes";

/** Real embeddings: Voyage AI (input_type document vs query, per Spec section 5). */
export class VoyageEmbedder implements Embedder {
  readonly name = "voyage";
  async embedDocuments(texts: string[]): Promise<number[][]> {
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += 64) {
      out.push(...(await embed(texts.slice(i, i + 64), "document")));
    }
    return out;
  }
  async embedQuery(text: string): Promise<number[]> {
    const [v] = await embed([text], "query");
    return v;
  }
}

// ---------------------------------------------------------------------------
// Mock embeddings (offline). Hashed bag-of-words + a small real-estate
// synonym map. Good enough to exercise the plumbing; NOT a measure of how
// well Voyage will match. Live runs use VoyageEmbedder.
// ---------------------------------------------------------------------------

const STOP = new Set(
  "a an the is are am was were be been being i me my mine we our you your it its this that these those to of in on at for with and or but if so do does did can could should would will just about what how when why which who whom there here than then too very really actually any some all".split(
    " "
  )
);

const SYNONYMS: Record<string, string> = {
  house: "home", houses: "home", homes: "home", property: "home", place: "home",
  worth: "value", valu: "value", price: "value", pric: "value", apprais: "value", estimat: "value",
  zillow: "online", zestimate: "online", websit: "online", app: "online",
  list: "sell", listing: "sell", sale: "sell", sold: "sell", selling: "sell", sel: "sell",
  autumn: "fall", october: "fall", septemb: "fall", novemb: "fall",
  wait: "spring", reno: "renov", renovat: "renov", kitchen: "renov", upgrad: "renov",
  downsiz: "downsiz", smaller: "downsiz", stair: "downsiz", kid: "downsiz", "too big": "downsiz", big: "downsiz", empty: "downsiz",
  sav: "money", cost: "money", cheap: "money", expens: "money", fee: "money",
  fix: "prep", prepar: "prep", stag: "prep", repair: "prep",
  nervous: "worri", scar: "worri", afraid: "worri", anxious: "worri",
  market: "market", now: "timing", time: "timing", timing: "timing", right: "timing",
};

function stem(w: string): string {
  return w.replace(/(ing|ed|ly|es|s)$/, "");
}

export function tokenize(text: string): string[] {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (const w of words) {
    if (STOP.has(w)) continue;
    const s = stem(w);
    out.push(SYNONYMS[w] ?? SYNONYMS[s] ?? s);
  }
  return out;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mockVector(text: string, dims = EMBEDDING_DIMENSIONS): number[] {
  const v = new Array(dims).fill(0);
  const toks = tokenize(text);
  for (const t of toks) {
    const h = hash(t);
    v[h % dims] += h & 1 ? 1 : -1;
  }
  const norm = Math.sqrt(v.reduce((a, x) => a + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

export class MockEmbedder implements Embedder {
  readonly name = "mock";
  async embedDocuments(texts: string[]) {
    return texts.map((t) => mockVector(t));
  }
  async embedQuery(text: string) {
    return mockVector(text);
  }
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}
