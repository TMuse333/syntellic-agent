/**
 * Notify the operator when an agent (e.g. Greg) adds or updates a listing.
 *
 * Routing: if NOTIFY_URL is set, the event flows through the notify gateway
 * (which fans out to Slack/email and owns channel routing). Otherwise it falls
 * back to a direct Resend email (kept until prod cutover per CMD/NOTIFY-01) and
 * is otherwise a console-only no-op. Never throws — notification must not fail
 * the request.
 */

import type { Listing } from "../db/schemas";
import { LISTING_STATUS_LABELS } from "../db/schemas";
import { sendNotification } from "./client";

type Action = "added" | "status" | "updated";

// Canonical events (NOTIFY-01 contract): open-house changes fold into listing.updated.
const EVENT: Record<Action, string> = {
  added: "listing.added",
  status: "listing.status_changed",
  updated: "listing.updated",
};

export async function notifyListingUpdate(
  accountId: string,
  listing: Pick<Listing, "sourceId" | "title" | "status" | "openHouse">,
  action: Action
): Promise<void> {
  // Preferred path: the notify gateway owns channel routing (accountId+event → Slack).
  if (process.env.NOTIFY_URL) {
    await sendNotification({
      accountId,
      event: EVENT[action],
      visibility: "internal",
      data: {
        mlsNumber: listing.sourceId,
        title: listing.title,
        status: listing.status,
        statusLabel: LISTING_STATUS_LABELS[listing.status] ?? listing.status,
        openHouse: !!listing.openHouse,
      },
      idempotencyKey: `${accountId}:${listing.sourceId}:${action}:${listing.status}:${listing.openHouse ? "oh" : "x"}`,
    });
    return;
  }

  // Fallback (pre-cutover): direct Resend email + console trace.
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
