/**
 * Listings: persistence + management for property listings.
 *
 * Listings live in the shared `content_library` collection as `kind: "listing"`
 * documents, keyed by { accountId, sourceId } where sourceId is the MLS number.
 * Agents ingest them by pasting a Paragon link (scrape → map → upsert), manage
 * status in the dashboard, and each agent's website reads them back via the
 * public API. Gracefully degrades to empty/no-op when Mongo isn't configured.
 */

import { getDb, isMongoConfigured } from "./mongodb";
import { COLLECTIONS, type Listing } from "./schemas";
import type { ScrapedListing } from "../scraper/types";

/** Fields an agent may edit by hand after ingest. */
export type ListingPatch = Partial<
  Pick<
    Listing,
    | "status"
    | "openHouse"
    | "openHouseAt"
    | "price"
    | "beds"
    | "baths"
    | "sqft"
    | "lotSize"
    | "propertyType"
    | "address"
    | "city"
    | "province"
    | "neighbourhood"
    | "description"
    | "features"
    | "isPublic"
  >
>;

/** Map a freshly scraped Paragon listing onto our stored Listing shape. */
export function scrapedToListing(
  accountId: string,
  scraped: ScrapedListing,
  status: Listing["status"] = "listed"
): Listing {
  const now = new Date();
  const place = [scraped.address, scraped.city].filter(Boolean).join(", ");
  return {
    accountId,
    sourceId: scraped.mlsNumber,
    kind: "listing",
    title: place || scraped.mlsNumber,
    isPublic: true,
    status,
    mlsNumber: scraped.mlsNumber,
    price: scraped.price || 0,
    beds: scraped.beds ?? 0,
    baths: scraped.baths ?? 0,
    propertyType: scraped.propertyType ?? "",
    address: scraped.address,
    city: scraped.city,
    province: scraped.province || undefined,
    sqft: scraped.sqft ?? undefined,
    lotSize: scraped.lotSize ?? undefined,
    features: [],
    description: scraped.description ?? "",
    images: (scraped.images ?? []).map((img) => ({ url: img.url })),
    sourceUrl: scraped.sourceUrl,
    syncedAt: now,
    updatedAt: now,
  };
}

/** All listings for an account. Pass { publicOnly } for website consumption. */
export async function getListings(
  accountId: string,
  opts: { publicOnly?: boolean } = {}
): Promise<Listing[]> {
  if (!isMongoConfigured()) return [];
  try {
    const db = await getDb();
    const filter: Record<string, unknown> = { accountId, kind: "listing" };
    if (opts.publicOnly) filter.isPublic = true;
    return await db
      .collection<Listing>(COLLECTIONS.content)
      .find(filter)
      .sort({ updatedAt: -1 })
      .toArray();
  } catch {
    console.error("Failed to fetch listings:", accountId);
    return [];
  }
}

export async function getListing(
  accountId: string,
  mlsNumber: string
): Promise<Listing | null> {
  if (!isMongoConfigured()) return null;
  try {
    const db = await getDb();
    return await db
      .collection<Listing>(COLLECTIONS.content)
      .findOne({ accountId, kind: "listing", sourceId: mlsNumber });
  } catch {
    console.error("Failed to fetch listing:", mlsNumber);
    return null;
  }
}

/** Upsert by { accountId, sourceId }. Re-ingesting a link refreshes its data. */
export async function upsertListing(listing: Listing): Promise<Listing> {
  const db = await getDb();
  await db.collection<Listing>(COLLECTIONS.content).updateOne(
    { accountId: listing.accountId, kind: "listing", sourceId: listing.sourceId },
    { $set: listing },
    { upsert: true }
  );
  return listing;
}

export async function updateListing(
  accountId: string,
  mlsNumber: string,
  patch: ListingPatch
): Promise<Listing | null> {
  const db = await getDb();
  const result = await db
    .collection<Listing>(COLLECTIONS.content)
    .findOneAndUpdate(
      { accountId, kind: "listing", sourceId: mlsNumber },
      { $set: { ...patch, updatedAt: new Date() } },
      { returnDocument: "after" }
    );
  return result ?? null;
}

export async function deleteListing(
  accountId: string,
  mlsNumber: string
): Promise<boolean> {
  const db = await getDb();
  const result = await db
    .collection<Listing>(COLLECTIONS.content)
    .deleteOne({ accountId, kind: "listing", sourceId: mlsNumber });
  return result.deletedCount > 0;
}
