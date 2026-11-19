import Link from "next/link";
import { AccountShell } from "@/components/layout/shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText,
  MessageSquare,
  BarChart3,
  Users,
  RefreshCw,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { getAccountStats } from "@/lib/db/queries";
import { getStrategyAccount } from "@/lib/account/strategyAccount";

interface PageProps {
  params: Promise<{ accountId: string }>;
}

export default async function AccountOverviewPage({ params }: PageProps) {
  const { accountId } = await params;
  const account = await getStrategyAccount(accountId);
  const stats = await getAccountStats(accountId);

  // Default values for display if account not found
  const name = account?.name || accountId;
  const isDemo = account?.isDemo || false;

  return (
    <AccountShell accountId={accountId}>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">{name}</h1>
            <div className="mt-1 flex items-center gap-2 text-muted-foreground">
              <span>{accountId}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync All
            </Button>
            {isDemo && (
              <Badge variant="secondary">Demo</Badge>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Link href={`/accounts/${accountId}/listings`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Listings
                </CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">—</div>
                <p className="text-xs text-muted-foreground">
                  MLS sync coming soon
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href={`/accounts/${accountId}/content`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Content Library
                </CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.posts}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.topics} topics
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href={`/accounts/${accountId}/conversations`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Leads
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.leads}</div>
                <p className="text-xs text-muted-foreground">
                  captured from chat
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href={`/accounts/${accountId}/tracking`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Tracking
                </CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">—</div>
                <p className="text-xs text-muted-foreground">
                  Coming soon
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Sync Status */}
        <div>
          <h2 className="mb-4 text-xl font-semibold">Sync Status</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Notion Sync</CardTitle>
                  {account?.notion ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <Badge variant="secondary">Not Connected</Badge>
                  )}
                </div>
                <CardDescription>
                  Sync topics and posts from Notion
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {isDemo ? "Demo data loaded" : "Manual sync"}
                  </div>
                  <Button variant="outline" size="sm">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Sync Now
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Instagram</CardTitle>
                  <Badge variant="secondary">Managed in strategy-app</Badge>
                </div>
                <CardDescription>
                  Connection + tokens live in strategy-app, not here
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  See the account in strategy-app to connect or refresh Instagram.
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="mb-4 text-xl font-semibold">Quick Actions</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <div className="font-medium">Add Listing</div>
                  <div className="text-sm text-muted-foreground">
                    Manually add a new listing
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <MessageSquare className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <div className="font-medium">Test Chatbot</div>
                  <div className="text-sm text-muted-foreground">
                    Preview chat experience
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <div className="font-medium">View Leads</div>
                  <div className="text-sm text-muted-foreground">
                    See captured contacts
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AccountShell>
  );
}
