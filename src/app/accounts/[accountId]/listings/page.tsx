import Link from "next/link";
import { AccountShell } from "@/components/layout/shell";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { getListings } from "@/lib/db/listings";
import { ListingsManager, type ListingRow } from "@/components/listings/ListingsManager";

interface PageProps {
  params: Promise<{ accountId: string }>;
}

export default async function ListingsPage({ params }: PageProps) {
  const { accountId } = await params;
  const listings = await getListings(accountId);
  // Serialize Mongo types (ObjectId/Date) to plain JSON for the client component.
  const rows = JSON.parse(JSON.stringify(listings)) as ListingRow[];

  return (
    <AccountShell accountId={accountId}>
      <div className="mb-4 flex justify-end">
        <Link href={`/accounts/${accountId}/listings/scrape`}>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Scrape tool
          </Button>
        </Link>
      </div>
      <ListingsManager accountId={accountId} initialListings={rows} />
    </AccountShell>
  );
}
