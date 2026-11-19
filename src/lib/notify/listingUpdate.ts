/**
 * Notify the operator when an agent (e.g. Greg) adds or updates a listing.
 *
 * Inert by default: logs to the server console. If RESEND_API_KEY and
 * LISTINGS_NOTIFY_EMAIL are set, it also emails via Resend (same service the
 * site already uses). Never throws — notification must not fail the request.
 * Swap in Notion later by implementing another branch here.
 */

import type { Listing } from "../db/schemas";
import { LISTING_STATUS_LABELS } from "../db/schemas";

type Action = "added" | "status" | "updated";

export async function notifyListingUpdate(
  accountId: string,
  listing: Pick<Listing, "sourceId" | "title" | "status" | "openHouse">,
  action: Action
): Promise<void> {
  const verb =
    action === "added" ? "added a new listing" : action === "status" ? "changed a listing status" : "updated a listing";
  const openHouse = listing.openHouse ? " · open house ON" : "";
  const subject = `[${accountId}] Greg ${verb}: ${listing.title}`;
  const text = [
    `Account: ${accountId}`,
    `Action: ${verb}`,
    `Listing: ${listing.title} (MLS ${listing.sourceId})`,
    `Status: ${LISTING_STATUS_LABELS[listing.status] ?? listing.status}${openHouse}`,
  ].join("\n");

  // Always leave a server-side trace.
  console.log(`[listing-notify] ${subject}`);

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.LISTINGS_NOTIFY_EMAIL;
  if (!apiKey || !to) return; // not configured yet → log-only

  try {
    const from = process.env.LISTINGS_FROM_EMAIL || "listings@syntellic.ai";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ from, to, subject, text }),
    });
    if (!res.ok) {
      console.error(`[listing-notify] Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
  } catch (err) {
    console.error("[listing-notify] failed:", err);
  }
}
