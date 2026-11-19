/**
 * One-time seed: import Greg Caseley's current listings (which live hardcoded in
 * the website repo's src/data/listings.json) into website-agent's Mongo
 * content_library so the admin view / API / preview reflect reality. From here
 * on, Greg manages them through the UI.
 *
 * Run:  node --env-file=.env.local scripts/seed-greg-listings.mjs
 * Images: Blob/absolute URLs kept as-is; repo-local /images/... paths are made
 * absolute against the live site so any app can load them.
 */

import { readFileSync } from "node:fs";
import { MongoClient } from "mongodb";

const ACCOUNT_ID = "greg-caseley";
const SITE_ORIGIN = "https://www.peislandrealty.ca";
const SOURCE_JSON =
  "/Users/thomasmusial/Desktop/syntellic/clients/greg-caseley/src/data/listings.json";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "website-agent";
if (!uri) {
  console.error("MONGODB_URI not set. Run with: node --env-file=.env.local scripts/seed-greg-listings.mjs");
  process.exit(1);
}

function absolutize(src) {
  if (!src) return src;
  return /^https?:\/\//.test(src) ? src : `${SITE_ORIGIN}${src.startsWith("/") ? "" : "/"}${src}`;
}

// PropertyListing (website repo) -> Listing (website-agent content_library)
function toListing(l, now) {
  const street = l.address?.street ?? "";
  const city = l.address?.city ?? "";
  // Map the website's simple status onto the lifecycle the agent manages.
  const STATUS_MAP = { active: "listed", pending: "accepted_offer", sold: "closed", draft: "listed" };
  const status = STATUS_MAP[l.status] ?? "listed";
  return {
    accountId: ACCOUNT_ID,
    sourceId: l.mlsNumber,
    kind: "listing",
    title: [street, city].filter(Boolean).join(", ") || l.mlsNumber,
    url: l.slug ? `${SITE_ORIGIN}/listings/${l.slug}` : undefined,
    isPublic: true,
    status,
    mlsNumber: l.mlsNumber,
    price: l.price ?? 0,
    beds: l.bedrooms ?? 0,
    baths: l.bathrooms ?? 0,
    propertyType: l.propertyType ?? "",
    address: street,
    city,
    province: l.address?.province || "PE",
    sqft: l.squareFootage || undefined,
    lotSize: l.lotSize || undefined,
    features: l.features ?? [],
    description: l.description ?? "",
    images: (l.images ?? []).map((img) => ({ url: absolutize(img.src), alt: img.alt })),
    syncedAt: now,
    updatedAt: now,
  };
}

async function main() {
  const data = JSON.parse(readFileSync(SOURCE_JSON, "utf8"));
  const listings = data.listings ?? [];
  const now = new Date();

  const client = new MongoClient(uri);
  await client.connect();
  const col = client.db(dbName).collection("content_library");

  let upserted = 0;
  for (const raw of listings) {
    const doc = toListing(raw, now);
    const res = await col.updateOne(
      { accountId: ACCOUNT_ID, kind: "listing", sourceId: doc.sourceId },
      { $set: doc },
      { upsert: true }
    );
    upserted++;
    const imgNote = `${doc.images.length} img${doc.images.length === 1 ? "" : "s"}`;
    console.log(`  ${res.upsertedCount ? "+ added " : "~ updated"} ${doc.sourceId}  ${doc.status.padEnd(7)} ${doc.title}  (${imgNote})`);
  }

  const total = await col.countDocuments({ accountId: ACCOUNT_ID, kind: "listing" });
  console.log(`\nSeeded ${upserted} listings. content_library now holds ${total} for ${ACCOUNT_ID}.`);
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
