/**
 * How specific is the visitor's question? Decides when to make the offer.
 *
 * Dimensions: area (in service area) · property · timing · reason/worry.
 * Offer when the visitor is talking about THEIR situation and at least
 * OFFER_AT dimensions are known (or they've been exploring a while).
 */

import type { Facts, Dimension } from "./types";

export const OFFER_AT = 3;
// Leaner flow (Spec §7): a couple of mirrors/labels, then go for the meeting.
export const MAX_EXPLORE_TURNS = 2;

export function specificity(f: Facts): { score: number; missing: Dimension[] } {
  const have = {
    area: !!f.area,
    property: !!(f.propertyType || f.beds),
    timeline: !!f.timeline,
    reason: !!(f.motivation || f.worry),
  };
  const order: Dimension[] =
    f.intent === "buyer" ? ["area", "reason", "timeline", "property"] : ["property", "area", "reason", "timeline"];
  const missing = order.filter((d) => !have[d as keyof typeof have]);
  // property + area are usually asked together; treat as one ask for sellers
  return { score: Object.values(have).filter(Boolean).length, missing };
}

export function readyForOffer(f: Facts, exploreTurns: number): boolean {
  if (!f.personal) return false;
  if (f.inServiceArea === false) return false; // out-of-area is handled earlier, belt-and-suspenders
  // Once it's about THEIR situation: offer as soon as there's one concrete anchor
  // (area / property / timeline / reason) or after a couple of exchanges.
  const { score } = specificity(f);
  return score >= 1 || exploreTurns >= MAX_EXPLORE_TURNS;
}

/** Offline composer for the visitor's specific question (live mode: the extractor writes it). */
export function composeQuestion(f: Facts, opts: { topicTitle?: string; listingTitle?: string; downsizing?: boolean }): string | undefined {
  if (!f.personal) return undefined;
  const home = [f.beds && `${f.beds}-bed`, f.propertyType].filter(Boolean).join(" ") || "home";
  const where = f.area ? ` in ${f.area}` : "";
  const when = f.timeline && !(f.motivation ?? "").includes(f.timeline) ? ` ${f.timeline}` : "";
  const why = f.motivation ? `, given ${lower(f.motivation)}` : "";
  const worry = f.worry ? ` (worried ${stripWorry(f.worry)})` : "";
  if (f.intent === "buyer") {
    const target = opts.listingTitle ? `Is ${opts.listingTitle.split(",")[0]} right for us` : `Which ${f.beds ? `${f.beds}-bed ` : ""}homes${where} fit us`;
    const deadline = f.timeline ? `, before ${f.timeline.replace(/^(in|by)\s+/i, "")}` : "";
    return `${target}${why}${deadline}?`;
  }
  if (opts.downsizing) return `Is it time to sell my ${home}${where} and downsize${why}?`;
  return `Should I sell my ${home}${where}${when}${why}${worry}?`;
}

function lower(s: string) {
  return s.charAt(0).toLowerCase() + s.slice(1);
}
function stripWorry(s: string) {
  return lower(s).replace(/^(and\s+)?(i'?m|we'?re|i am|we are)\s+(worried|nervous|scared|afraid)\s*(that\s+)?/i, "").replace(/^(worried|nervous)\s+/, "");
}
