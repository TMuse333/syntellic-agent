import { getStrategyAccount } from "@/lib/account/strategyAccount";
import { getListings } from "@/lib/db/listings";
import { ListingsManager, type ListingRow } from "@/components/listings/ListingsManager";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ accountId: string }>;
}

/**
 * Client-facing listings manager — the URL you share with an agent (e.g. Greg).
 * Same manager as the admin view, but with no admin chrome: no sidebar, no other
 * accounts, scoped to this one account. No auth yet (single-client); the URL is
 * the only gate.
 */
export default async function ManageListingsPage({ params }: PageProps) {
  const { accountId } = await params;
  const [account, listings] = await Promise.all([
    getStrategyAccount(accountId).catch(() => null),
    getListings(accountId),
  ]);
  const rows = JSON.parse(JSON.stringify(listings)) as ListingRow[];
  const name = account?.agent?.fullName || account?.name || accountId;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Listings
            </div>
            <div className="text-lg font-semibold">{name}</div>
          </div>
          {account?.agent?.brokerage && (
            <div className="text-sm text-muted-foreground">{account.agent.brokerage}</div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <ListingsManager accountId={accountId} initialListings={rows} canAdd={false} />
      </main>
    </div>
  );
}
