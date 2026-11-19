import Link from "next/link";
import { Shell } from "@/components/layout/shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  MessageSquare,
  BarChart3,
  ArrowUpRight,
  Users,
  Clock,
} from "lucide-react";

// Mock data - will come from DB
const accounts = [
  {
    id: "greg-caseley",
    name: "Greg Caseley",
    domain: "gregcaseley.com",
    type: "Real Estate",
    stats: {
      listings: 10,
      conversations: 24,
      pageViews: 1420,
      leads: 8,
    },
    status: "active",
    lastSync: "2 hours ago",
  },
  {
    id: "syntellic",
    name: "Syntellic",
    domain: "syntellic.com",
    type: "Agency",
    stats: {
      listings: 0,
      conversations: 156,
      pageViews: 3200,
      leads: 42,
    },
    status: "active",
    lastSync: "1 hour ago",
  },
  {
    id: "demo-account",
    name: "Demo Account",
    domain: "demo.example.com",
    type: "Demo",
    stats: {
      listings: 5,
      conversations: 12,
      pageViews: 450,
      leads: 3,
    },
    status: "inactive",
    lastSync: "3 days ago",
  },
];

const recentConversations = [
  {
    id: "conv-1",
    account: "greg-caseley",
    visitor: "Anonymous",
    lastMessage: "I'm looking for waterfront property...",
    phase: "probe",
    time: "5 min ago",
  },
  {
    id: "conv-2",
    account: "syntellic",
    visitor: "john@example.com",
    lastMessage: "How do you handle content strategy?",
    phase: "label",
    time: "12 min ago",
  },
  {
    id: "conv-3",
    account: "greg-caseley",
    visitor: "Anonymous",
    lastMessage: "What's the price range for lots?",
    phase: "mirror",
    time: "1 hour ago",
  },
];

export default function DashboardPage() {
  return (
    <Shell>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Manage your client websites and monitor activity
          </p>
        </div>

        {/* Overview Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Accounts
              </CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">3</div>
              <p className="text-xs text-muted-foreground">2 active</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Conversations Today
              </CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">18</div>
              <p className="text-xs text-green-600">+12% from yesterday</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Page Views
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">5,070</div>
              <p className="text-xs text-muted-foreground">This week</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Leads Captured
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">53</div>
              <p className="text-xs text-green-600">+8 this week</p>
            </CardContent>
          </Card>
        </div>

        {/* Accounts Grid */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Accounts</h2>
            <Link
              href="/accounts/new"
              className="text-sm text-primary hover:underline"
            >
              + Add Account
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {accounts.map((account) => (
              <Link key={account.id} href={`/accounts/${account.id}`}>
                <Card className="transition-shadow hover:shadow-md cursor-pointer h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base">
                            {account.name}
                          </CardTitle>
                          <CardDescription className="text-xs">
                            {account.domain}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge
                        variant={
                          account.status === "active" ? "default" : "secondary"
                        }
                      >
                        {account.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Listings</div>
                        <div className="font-semibold">
                          {account.stats.listings}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Conversations</div>
                        <div className="font-semibold">
                          {account.stats.conversations}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Page Views</div>
                        <div className="font-semibold">
                          {account.stats.pageViews.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Leads</div>
                        <div className="font-semibold">{account.stats.leads}</div>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Last sync: {account.lastSync}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Conversations */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Recent Conversations</h2>
            <Link
              href="/conversations"
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              View all
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {recentConversations.map((conv) => (
                  <Link
                    key={conv.id}
                    href={`/accounts/${conv.account}/conversations/${conv.id}`}
                    className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{conv.visitor}</span>
                          <span className="text-xs text-muted-foreground">
                            on {conv.account}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {conv.lastMessage}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="capitalize">
                        {conv.phase}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {conv.time}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Shell>
  );
}
