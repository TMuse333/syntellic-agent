/**
 * Demo client fixtures → library documents. Shared by the seed script,
 * the e2e demo run and tests. Raw fixtures use Notion property names
 * (as the real Notion sync will), mapped 1:1 to Spec field names here.
 */

import * as fs from "fs";
import * as path from "path";
import type { Account, Topic, ContentItem, Listing } from "../db/schemas";

// process.cwd() works inside the Next.js server bundle; __dirname works for scripts/tests.
export const DEMO_DIR = [path.join(process.cwd(), "fixtures/demo"), path.join(__dirname, "../../../fixtures/demo")].find((d) =>
  fs.existsSync(d)
)!;

type Raw = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function load<T = Raw[]>(file: string, dir = DEMO_DIR): T {
  return JSON.parse(fs.readFileSync(path.join(dir, file), "utf-8"));
}

export function mapNotionTopic(raw: Raw, accountId: string): Topic {
  return {
    accountId,
    sourceId: raw.id,
    topic: raw.Topic,
    audience: raw.Audience,
    whyItMatters: raw["Why it matters"],
    personalQuestionCta: raw["Personal question (CTA)"],
    localAngle: raw["Local angle"],
    fromLibrary: raw["From library"] ?? undefined,
    source: raw.Source ?? "Strategy",
    status: raw.Status,
    priority: raw.Priority ?? "Medium",
    parentTopicId: raw["Parent topic"] ?? undefined,
    branchStatus: raw["Branch status"] ?? undefined,
    round: raw.Round ?? undefined,
    syncedAt: new Date(),
  };
}

export function mapNotionPost(raw: Raw, accountId: string, topicTitle: (id: string) => string | undefined): ContentItem {
  return {
    accountId,
    sourceId: raw.id,
    kind: "post",
    title: raw.Post,
    url: `/p/${raw.id}`,
    post: raw.Post,
    status: raw.Status,
    postDate: raw["Post date"] ? new Date(raw["Post date"]) : undefined,
    type: raw.Type,
    topicId: raw.Topic,
    topicTitle: topicTitle(raw.Topic),
    answers: raw["Question answered"],
    questionAnswered: raw["Question answered"],
    decisionStage: raw["Decision stage"],
    level: raw.Level,
    versionOf: raw["Version of"] ?? undefined,
    pattern: raw.Pattern ?? undefined,
    beliefBefore: raw["Belief before"],
    beliefAfter: raw["Belief after"],
    surprise: raw.Surprise,
    humanNatureLever: raw["Human nature (lever)"],
    literaryDevice: raw["Literary device"],
    videoFormat: raw["Video format"] ?? undefined,
    caption: raw.Caption,
    cta: raw.CTA,
    mediaUrl: raw.Preview ?? undefined,
    successMetric: raw["Success metric"],
    answerCheck: String(raw["Answer check"] ?? "").split(", ").filter(Boolean),
    igPostLink: raw["IG post link"] ?? undefined,
    strategyNotes: raw["Strategy notes"] ?? undefined,
    isPublic: false, // derived at ingest
    syncedAt: new Date(),
  } as unknown as ContentItem;
}

export function mapListing(raw: Raw, accountId: string): Listing {
  return {
    accountId,
    sourceId: raw.id,
    kind: "listing",
    title: `${raw.address}, ${raw.neighbourhood ? raw.neighbourhood + ", " : ""}${raw.city}`,
    url: `/listings/${raw.id}`,
    status: raw.status,
    mlsNumber: raw.mlsNumber,
    price: raw.price,
    beds: raw.beds,
    baths: raw.baths,
    propertyType: raw.propertyType,
    address: raw.address,
    city: raw.city,
    neighbourhood: raw.neighbourhood,
    sqft: raw.sqft,
    features: raw.features ?? [],
    description: raw.description,
    isPublic: false, // derived at ingest
    syncedAt: new Date(),
  };
}

export interface Persona {
  id: string;
  label: string;
  entryPostId: string | null;
  utm: { source?: string; medium?: string; content?: string } | null;
  expect: { booked: boolean; meetingKind?: "call" | "showing"; leadType?: "nurture"; unanswered?: boolean };
  persona: string;
  scripted: string[];
}

export interface EvalQuestion {
  id: string;
  question: string;
  expected_topic_id: string | null;
  expected_post_id: string | null;
  should_log_as_idea: boolean;
  notes?: string;
}

export function loadDemo(dir = DEMO_DIR) {
  const rawAccount = load<Raw>("account.json", dir);
  const accountId: string = rawAccount.accountId;
  const account: Account = {
    name: rawAccount.name,
    slug: accountId,
    isDemo: true,
    notion: rawAccount.integrations?.notion,
    agent: rawAccount.agent,
  };
  const rawTopics = [...load("topics.json", dir), ...load("branches.json", dir)];
  const topics = rawTopics.map((t) => mapNotionTopic(t, accountId));
  // Posts point at their branch when a branch lists them (Notion: Post.Topic relation).
  const branchOf = new Map<string, string>();
  for (const b of load("branches.json", dir)) for (const p of b.Posts ?? []) branchOf.set(p, b.id);
  const titles = new Map(topics.map((t) => [t.sourceId, t.topic]));
  const posts = load("posts.json", dir).map((p) =>
    mapNotionPost({ ...p, Topic: branchOf.get(p.id) ?? p.Topic }, accountId, (id) => titles.get(id))
  );
  const listings = load("listings.json", dir).map((l) => mapListing(l, accountId));
  return {
    account,
    topics,
    content: [...posts, ...listings] as ContentItem[],
    personas: load<Persona[]>("personas.json", dir),
    evalQuestions: load<EvalQuestion[]>("eval-questions.json", dir),
  };
}
