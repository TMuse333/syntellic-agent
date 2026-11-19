import { NextRequest, NextResponse } from "next/server";
import {
  getListings,
  upsertListing,
  scrapedToListing,
  type ListingPatch,
} from "@/lib/db/listings";
import { scrapeParagonListing, isParagonUrl, closeBrowser } from "@/lib/scraper/paragon";
import { notifyListingUpdate } from "@/lib/notify/listingUpdate";
import type { Listing } from "@/lib/db/schemas";

interface RouteParams {
  params: Promise<{ accountId: string }>;
}

// GET /api/accounts/[accountId]/listings
// ?public=1 → only public listings (what a client website pulls)
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { accountId } = await params;
  const publicOnly = request.nextUrl.searchParams.get("public") === "1";
  const listings = await getListings(accountId, { publicOnly });
  return NextResponse.json({ success: true, count: listings.length, listings });
}

// POST /api/accounts/[accountId]/listings
// Body: { url: paragonLink, status?, overrides? } → scrape + persist
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { accountId } = await params;
  try {
    const body = await request.json();
    const { url, status, overrides } = body as {
      url?: string;
      status?: Listing["status"];
      overrides?: ListingPatch;
    };

    if (!url || typeof url !== "string") {
      return NextResponse.json({ success: false, error: "A Paragon URL is required" }, { status: 400 });
    }
    if (!isParagonUrl(url)) {
      return NextResponse.json({ success: false, error: "Only Paragon MLS URLs are supported" }, { status: 400 });
    }

    const result = await scrapeParagonListing(url);
    await closeBrowser();

    if (!result.success || !result.listing) {
      return NextResponse.json({ success: false, error: result.error || "Scrape failed" }, { status: 502 });
    }

    const listing = scrapedToListing(accountId, result.listing, status ?? "listed");
    // Apply any manual overrides the agent supplied for missing/incorrect data.
    if (overrides) Object.assign(listing, overrides);

    await upsertListing(listing);
    await notifyListingUpdate(accountId, listing, "added");
    return NextResponse.json({ success: true, listing });
  } catch (error) {
    await closeBrowser();
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
