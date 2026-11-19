import { describe, it, expect, beforeAll } from "vitest";
import { runDemo, type DemoResult } from "../run";

describe("demo client end to end (offline)", () => {
  let r: DemoResult;
  beforeAll(async () => {
    r = await runDemo({ mode: "offline", backgroundTraffic: true });
  });

  it("matches at least 17 of 20 eval questions to the right topic", () => {
    expect(r.match.correct).toBeGreaterThanOrEqual(17);
  });

  it("books the fall seller, the downsizer and the buyer (showing)", () => {
    const by = Object.fromEntries(r.personas.map((p) => [p.persona.id, p]));
    expect(by["persona-fall-seller"].booked).toBe(true);
    expect(by["persona-downsizer"].booked).toBe(true);
    expect(by["persona-buyer-listings"].meetingKind).toBe("showing");
  });

  it("moves general → specific, offers the Topic's curated CTA, and briefs the deeper context", () => {
    const seller = r.personas.find((p) => p.persona.id === "persona-fall-seller")!;
    expect(seller.questionTrail.length).toBeGreaterThanOrEqual(3);
    // Specifics are captured along the way…
    expect(seller.questionTrail.join(" | ")).toMatch(/Markham/);
    // …but the offer plays back the agent's curated CTA (Spec §7.5), not a composed question.
    const last = seller.questionTrail.at(-1)!;
    expect(last).toMatch(/spring/i);
    expect(last).not.toMatch(/Markham/);
    // The deeper context (area + reason) still reaches the agent in the brief.
    const brief = r.briefs.find((b) => /jane/i.test(b.text))!;
    expect(brief.text).toMatch(/Markham/);
    expect(brief.text).toMatch(/mom/i);
  });

  it("opens neutral, then lets the visitor pick or describe the post they saw", () => {
    const seller = r.personas.find((p) => p.persona.id === "persona-fall-seller")!;
    expect(seller.transcript[0].text).toMatch(/What brings you here/);
    expect(seller.transcript[0].text).not.toMatch(/post/i);
    const why = seller.transcript.find((t) => t.step === "ask_why_post")!;
    expect(why.text).toMatch(/dig deeper/);
    const downsizer = r.personas.find((p) => p.persona.id === "persona-downsizer")!;
    expect(downsizer.transcript.some((t) => t.step === "confirm_post")).toBe(true);
    expect(r.niche.postsSeen.find((p) => p.postId === "post-demo-001")?.saidSo).toBe(1);
  });

  it("sends the agent a full brief per booking", () => {
    expect(r.briefs.length).toBe(3);
    for (const b of r.briefs) {
      expect(b.text).toMatch(/THE QUESTION/);
      expect(b.text).toMatch(/How the question got specific/);
      expect(b.text).toMatch(/Suggested opener/);
    }
  });

  it("does not book out-of-area or not-ready visitors", () => {
    const by = Object.fromEntries(r.personas.map((p) => [p.persona.id, p]));
    expect(by["persona-out-of-area"].booked).toBe(false);
    expect(by["persona-value-curious"].booked).toBe(false);
    expect(by["persona-value-curious"].leadType).toBe("nurture");
  });

  it("never offers sold listings", () => {
    const buyer = r.personas.find((p) => p.persona.id === "persona-buyer-listings")!;
    expect(buyer.transcript.map((t) => t.text).join(" ")).not.toMatch(/Birch Road/);
  });

  it("logs unanswered questions as post ideas", () => {
    expect(r.niche.unanswered.some((q) => /school district/i.test(q))).toBe(true);
  });

  it("produces a niche report with the booking branch on top", () => {
    expect(r.niche.rows.length).toBeGreaterThan(0);
    const top = r.niche.rows[0];
    expect(top.booked).toBeGreaterThan(0);
    expect(r.niche.nextRound.length).toBeGreaterThan(0);
  });

  it("passes every check", () => {
    expect(r.checks.filter((c) => !c.pass)).toEqual([]);
  });
});
