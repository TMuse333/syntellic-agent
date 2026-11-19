"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  ExternalLink,
  Image as ImageIcon,
  MoreVertical,
  Loader2,
  Globe,
  EyeOff,
  Trash2,
  CalendarClock,
} from "lucide-react";

export type ListingStatus = "listed" | "price_adjustment" | "accepted_offer" | "closed";

const STATUS_LABELS: Record<ListingStatus, string> = {
  listed: "Listed",
  price_adjustment: "Price adjustment",
  accepted_offer: "Accepted offer",
  closed: "Closed",
};

// Serializable form of a stored Listing (Dates/ObjectId come over as strings).
export interface ListingRow {
  _id?: string;
  sourceId: string;
  mlsNumber?: string;
  status: ListingStatus;
  openHouse?: boolean;
  openHouseAt?: string;
  title: string;
  address: string;
  city: string;
  price: number;
  isPublic: boolean;
  images?: { url: string }[];
  sourceUrl?: string;
  updatedAt?: string;
}

const STATUSES: ListingStatus[] = ["listed", "price_adjustment", "accepted_offer", "closed"];

// On-market statuses render with the accent badge; closed is muted.
function statusVariant(s: ListingStatus): "default" | "secondary" {
  return s === "closed" ? "secondary" : "default";
}

export function ListingsManager({
  accountId,
  initialListings,
  canAdd = true,
}: {
  accountId: string;
  initialListings: ListingRow[];
  // Add-by-Paragon-link needs the scraper (local only today). Hide it where
  // scraping isn't available (e.g. the deployed client-facing route).
  canAdd?: boolean;
}) {
  const router = useRouter();
  const [listings, setListings] = useState<ListingRow[]>(initialListings);
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // mlsNumber being mutated

  const base = `/api/accounts/${accountId}/listings`;

  async function refresh() {
    const res = await fetch(base);
    const data = await res.json();
    if (data.success) setListings(data.listings);
  }

  async function handleAdd() {
    if (!url.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to add listing");
      setUrl("");
      await refresh();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add listing");
    } finally {
      setAdding(false);
    }
  }

  async function patch(mls: string, body: Partial<ListingRow>) {
    setBusy(mls);
    try {
      const res = await fetch(`${base}/${encodeURIComponent(mls)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setListings((prev) =>
          prev.map((l) => (l.sourceId === mls ? { ...l, ...body } : l))
        );
      }
    } finally {
      setBusy(null);
    }
  }

  async function remove(mls: string) {
    setBusy(mls);
    try {
      const res = await fetch(`${base}/${encodeURIComponent(mls)}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setListings((prev) => prev.filter((l) => l.sourceId !== mls));
      }
    } finally {
      setBusy(null);
    }
  }

  const liveCount = listings.filter((l) => l.status !== "closed").length;
  const closedCount = listings.filter((l) => l.status === "closed").length;
  const openHouseCount = listings.filter((l) => l.openHouse).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Listings</h1>
        <p className="text-slate-500 dark:text-slate-400">
          {canAdd
            ? "Paste a Paragon MLS link to pull a listing in. Manage status and what shows on the website."
            : "Manage status and what shows on the website."}
        </p>
      </div>

      {/* Add by link */}
      {canAdd && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Add a listing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                placeholder="Paste Paragon link (e.g. https://collaboration.settings…/Report/…)"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !adding && handleAdd()}
                disabled={adding}
              />
              <Button onClick={handleAdd} disabled={adding || !url.trim()}>
                {adding ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Scraping…
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Add
                  </>
                )}
              </Button>
            </div>
            {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Total" value={listings.length} />
        <StatCard label="On market" value={liveCount} />
        <StatCard label="Closed" value={closedCount} />
        <StatCard label="Open house" value={openHouseCount} />
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>All listings</CardTitle>
        </CardHeader>
        <CardContent>
          {listings.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No listings yet. Paste a Paragon link above to add the first one.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>MLS #</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Images</TableHead>
                  <TableHead>On site</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listings.map((l) => (
                  <TableRow key={l.sourceId} className={busy === l.sourceId ? "opacity-50" : ""}>
                    <TableCell className="font-mono text-sm">{l.mlsNumber || l.sourceId}</TableCell>
                    <TableCell className="font-medium">{l.address || l.title}</TableCell>
                    <TableCell>{l.city}</TableCell>
                    <TableCell className="text-right">
                      {l.price ? `$${l.price.toLocaleString()}` : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge variant={statusVariant(l.status)}>{STATUS_LABELS[l.status]}</Badge>
                        {l.openHouse && (
                          <Badge variant="outline" className="border-amber-500/50 text-amber-600">
                            Open house
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <ImageIcon className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                        <span>{l.images?.length ?? 0}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {l.isPublic ? (
                        <Globe className="h-4 w-4 text-green-600" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-slate-400" />
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" disabled={busy === l.sourceId}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {l.sourceUrl && (
                            <DropdownMenuItem
                              onClick={() => window.open(l.sourceUrl, "_blank", "noreferrer")}
                            >
                              <ExternalLink className="mr-2 h-4 w-4" />
                              View on Paragon
                            </DropdownMenuItem>
                          )}
                          {STATUSES.filter((s) => s !== l.status).map((s) => (
                            <DropdownMenuItem
                              key={s}
                              onClick={() => patch(l.sourceId, { status: s })}
                            >
                              Mark as {STATUS_LABELS[s]}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => patch(l.sourceId, { openHouse: !l.openHouse })}
                          >
                            <CalendarClock className="mr-2 h-4 w-4" />
                            {l.openHouse ? "Clear open house" : "Set open house"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => patch(l.sourceId, { isPublic: !l.isPublic })}
                          >
                            {l.isPublic ? (
                              <>
                                <EyeOff className="mr-2 h-4 w-4" />
                                Hide from site
                              </>
                            ) : (
                              <>
                                <Globe className="mr-2 h-4 w-4" />
                                Show on site
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => remove(l.sourceId)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
      </CardContent>
    </Card>
  );
}
