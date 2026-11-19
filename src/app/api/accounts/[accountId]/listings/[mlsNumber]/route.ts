import { NextRequest, NextResponse } from "next/server";
import { updateListing, deleteListing, type ListingPatch } from "@/lib/db/listings";
import { notifyListingUpdate } from "@/lib/notify/listingUpdate";

interface RouteParams {
  params: Promise<{ accountId: string; mlsNumber: string }>;
}

// PATCH /api/accounts/[accountId]/listings/[mlsNumber]
// Body: subset of editable fields (status, price, description, isPublic, …)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { accountId, mlsNumber } = await params;
  try {
    const patch = (await request.json()) as ListingPatch;
    const updated = await updateListing(accountId, mlsNumber, patch);
    if (!updated) {
      return NextResponse.json({ success: false, error: "Listing not found" }, { status: 404 });
    }
    const action = "status" in patch ? "status" : "updated";
    await notifyListingUpdate(accountId, updated, action);
    return NextResponse.json({ success: true, listing: updated });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// DELETE /api/accounts/[accountId]/listings/[mlsNumber]
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { accountId, mlsNumber } = await params;
  const deleted = await deleteListing(accountId, mlsNumber);
  if (!deleted) {
    return NextResponse.json({ success: false, error: "Listing not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
