import { describe, it, expect } from "vitest";
import type { Topic, Post, Lead, Session, Account } from "../schemas";

/**
 * Tests verifying field names match System Spec section 3 exactly.
 * These tests ensure type-level compliance with the spec.
 */

describe("Topic schema matches Spec section 3", () => {
  it("has all required Spec fields", () => {
    // Type-level test: if this compiles, the fields exist with correct types
    const topic: Topic = {
      accountId: "acc-123",
      sourceId: "notion-page-id",

      // Spec section 3 Topic fields
      topic: "Should I sell this fall, or wait for spring?",
      audience: "Homeowners considering selling",
      whyItMatters: "Timing affects price and competition",
      personalQuestionCta: "What would MY home sell for this fall?",
      localAngle: "In Stratford, fall inventory is typically lower",
      fromLibrary: "library-topic-id",
      source: "Client question",
      status: "Active",
      priority: "High",

      // App fields per Definition of done
      embedding: [0.1, 0.2],
      embeddingText: "embedded text",
      syncedAt: new Date(),
    };

    expect(topic.topic).toBe("Should I sell this fall, or wait for spring?");
    expect(topic.audience).toBeDefined();
    expect(topic.whyItMatters).toBeDefined();
    expect(topic.personalQuestionCta).toBeDefined();
    expect(topic.localAngle).toBeDefined();
    expect(topic.status).toMatch(/^(Idea|Active|Covered)$/);
  });
});

describe("Post (content_library) schema matches Spec section 3", () => {
  it("has all required Spec fields", () => {
    const post: Post = {
      accountId: "acc-123",
      sourceId: "notion-page-id",

      // Identity
      post: "Is fall a bad time to sell?",
      status: "Posted",
      postDate: new Date(),
      type: "Carousel",

      // Strategy
      topicId: "topic-123",
      topicTitle: "Should I sell this fall?",
      questionAnswered: "Is fall actually a bad time to sell your home?",
      decisionStage: 1,
      level: "L5",
      versionOf: undefined,

      // Information
      pattern: "Myth vs truth",
      beliefBefore: "Fall is a bad time to sell",
      beliefAfter: "Fall can actually be ideal due to lower competition",
      surprise: "Homes sell faster in fall in this market",

      // Packaging
      humanNatureLever: "curiosity gap",
      literaryDevice: "contrast",
      videoFormat: "Animated explainer",

      // Execution
      caption: "Think fall is a bad time to sell? Here's what the data says...",
      cta: "DM keyword",
      mediaUrl: "https://cdn.example.com/video.mp4",

      // Measurement
      successMetric: "Saves",
      answerCheck: ["Direct", "Specific", "So what", "Next step", "Accurate"],
      igPostLink: "https://instagram.com/p/123",
      strategyNotes: "Test timing-focused content",

      // App fields
      embedding: [0.1, 0.2],
      embeddingText: "embedded text",
      syncedAt: new Date(),
    };

    // Verify all Identity fields
    expect(post.post).toBeDefined();
    expect(post.status).toMatch(/^(Idea|Draft|Ready for review|Approved|Scheduled|Posted)$/);
    expect(post.type).toMatch(/^(Carousel|Listing graphic|Listing video|Video explainer)$/);

    // Verify all Strategy fields
    expect(post.questionAnswered).toBeDefined();
    expect(post.decisionStage).toBeGreaterThanOrEqual(1);
    expect(post.decisionStage).toBeLessThanOrEqual(6);
    expect(post.level).toMatch(/^L[1-7]$/);

    // Verify all Information fields
    expect(post.beliefBefore).toBeDefined();
    expect(post.beliefAfter).toBeDefined();

    // Verify all Packaging fields
    expect(post.humanNatureLever).toMatch(/^(curiosity gap|social proof|loss aversion|specificity|authority)$/);
    expect(post.literaryDevice).toMatch(/^(contrast|story|concrete numbers|metaphor|repetition)$/);

    // Verify all Execution fields
    expect(post.caption).toBeDefined();
    expect(post.cta).toMatch(/^(DM keyword|Link|Book a call|None)$/);
    expect(post.mediaUrl).toBeDefined();

    // Verify all Measurement fields
    expect(post.successMetric).toMatch(/^(Reach|Saves|DMs|Profile visits|Link taps)$/);
    expect(post.answerCheck).toContain("Direct");
  });
});

describe("Lead schema matches Spec section 3", () => {
  it("has all required Spec fields", () => {
    const lead: Lead = {
      accountId: "acc-123",
      name: "Jane Smith",
      contact: "jane@example.com",
      preferredTime: "Morning",
      consent: true,
      situationSummary: "Thinking of selling a 3-bed in Stratford; worried about price",
      entryReason: "Came from IG post 'Is fall a bad time to sell?' via bio link",
      entryPostId: "post-123",
      topicId: "topic-123",
      topic: "Should I sell this fall?",
      contentViewed: [
        { postId: "post-123", title: "Is fall bad?", watchPct: 85 }
      ],
      shiftMoment: "Asked 'what would mine go for?' after 2nd video",
      personalQuestion: "What would MY home sell for this fall?",
      stageReached: 4,
      suggestedOpener: "You mentioned price was the big worry…",
      utm: { source: "instagram", medium: "bio", content: "post-123" },
      createdAt: new Date(),
    };

    expect(lead.accountId).toBeDefined();
    expect(lead.consent).toBe(true);
    expect(lead.situationSummary).toBeDefined();
    expect(lead.entryReason).toBeDefined();
    expect(lead.contentViewed).toBeInstanceOf(Array);
    expect(lead.stageReached).toBeGreaterThanOrEqual(1);
    expect(lead.stageReached).toBeLessThanOrEqual(6);
  });
});

describe("Session schema matches Spec section 6 + 8", () => {
  it("has all required session tracking fields", () => {
    const session: Session = {
      accountId: "acc-123",

      // Attribution (section 6)
      entryPostId: "post-123",
      entryTopicId: "topic-123",
      utm: { source: "instagram", medium: "bio", content: "post-123" },

      // Content viewed (section 6)
      pagesViewed: [
        { postId: "post-123", title: "Is fall bad?", watchPct: 85, viewedAt: new Date() }
      ],

      // Tracking events (section 8)
      events: [
        { event: "site_visit", timestamp: new Date() },
        { event: "entry_post", timestamp: new Date(), postId: "post-123" },
        { event: "video_play", timestamp: new Date(), postId: "post-123" },
        { event: "video_watch_pct", timestamp: new Date(), postId: "post-123", pct: 85 },
        { event: "chat_start", timestamp: new Date() },
        { event: "topic_matched", timestamp: new Date(), topicId: "topic-123" },
      ],

      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(session.accountId).toBeDefined();
    expect(session.entryPostId).toBeDefined();
    expect(session.pagesViewed).toBeInstanceOf(Array);
    expect(session.events).toBeInstanceOf(Array);
    expect(session.events[0].event).toBe("site_visit");
  });
});

describe("Account schema matches Spec section 4 (rewritten 2026-10-24)", () => {
  it("has per-account config read read-only from strategy.accounts", () => {
    const account: Account = {
      name: "Demo Realty",
      slug: "demo-realty",
      isDemo: false,
      notion: {
        postsDataSourceId: "collection://123",
        topicsDataSourceId: "collection://456",
      },
      driveFolderId: "folder-123",
    };

    expect(account.notion?.postsDataSourceId).toBeDefined();
    expect(account.notion?.topicsDataSourceId).toBeDefined();
    expect(account.driveFolderId).toBeDefined();
  });

  it("supports isDemo flag for demo accounts", () => {
    const demoAccount: Account = {
      name: "Sam Rivers - Demo Realty",
      slug: "demo",
      isDemo: true,
    };

    expect(demoAccount.isDemo).toBe(true);
  });
});
