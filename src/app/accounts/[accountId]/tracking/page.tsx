import { AccountShell } from "@/components/layout/shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart3,
  Users,
  MousePointer,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Globe,
  Smartphone,
  Monitor,
} from "lucide-react";

// Mock analytics data
const stats = {
  pageViews: { value: 1420, change: 12 },
  sessions: { value: 380, change: 8 },
  avgDuration: { value: "2:34", change: -5 },
  bounceRate: { value: "42%", change: -3 },
};

const topPages = [
  { path: "/", views: 450, avgTime: "1:20" },
  { path: "/listings", views: 320, avgTime: "2:45" },
  { path: "/listings/lot-24-1-blue-water-av", views: 180, avgTime: "3:12" },
  { path: "/contact", views: 145, avgTime: "1:05" },
  { path: "/about", views: 98, avgTime: "1:45" },
];

const recentEvents = [
  {
    type: "page_view",
    url: "/listings/lot-24-1-blue-water-av",
    visitor: "Session #a3f2",
    time: "2 min ago",
    device: "mobile",
  },
  {
    type: "chat_started",
    url: "/",
    visitor: "Session #b7c1",
    time: "5 min ago",
    device: "desktop",
  },
  {
    type: "page_view",
    url: "/contact",
    visitor: "Session #a3f2",
    time: "8 min ago",
    device: "mobile",
  },
  {
    type: "form_submit",
    url: "/contact",
    visitor: "Session #d4e9",
    time: "15 min ago",
    device: "desktop",
  },
  {
    type: "page_view",
    url: "/listings",
    visitor: "Session #f1a2",
    time: "20 min ago",
    device: "desktop",
  },
];

const utmSources = [
  { source: "google", medium: "organic", sessions: 145, leads: 3 },
  { source: "facebook", medium: "social", sessions: 89, leads: 2 },
  { source: "direct", medium: "(none)", sessions: 78, leads: 1 },
  { source: "instagram", medium: "social", sessions: 45, leads: 2 },
  { source: "google", medium: "cpc", sessions: 23, leads: 0 },
];

interface PageProps {
  params: Promise<{ accountId: string }>;
}

export default async function TrackingPage({ params }: PageProps) {
  const { accountId } = await params;

  return (
    <AccountShell accountId={accountId}>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Tracking & Analytics</h1>
          <p className="text-muted-foreground">
            Website traffic and visitor behavior
          </p>
        </div>

        {/* Overview Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Page Views
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.pageViews.value.toLocaleString()}
              </div>
              <div className="flex items-center text-xs">
                {stats.pageViews.change > 0 ? (
                  <ArrowUpRight className="h-4 w-4 text-green-600" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 text-red-600" />
                )}
                <span
                  className={
                    stats.pageViews.change > 0 ? "text-green-600" : "text-red-600"
                  }
                >
                  {Math.abs(stats.pageViews.change)}% from last week
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Sessions
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.sessions.value}</div>
              <div className="flex items-center text-xs">
                {stats.sessions.change > 0 ? (
                  <ArrowUpRight className="h-4 w-4 text-green-600" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 text-red-600" />
                )}
                <span
                  className={
                    stats.sessions.change > 0 ? "text-green-600" : "text-red-600"
                  }
                >
                  {Math.abs(stats.sessions.change)}% from last week
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg. Duration
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avgDuration.value}</div>
              <div className="flex items-center text-xs">
                {stats.avgDuration.change > 0 ? (
                  <ArrowUpRight className="h-4 w-4 text-green-600" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 text-red-600" />
                )}
                <span
                  className={
                    stats.avgDuration.change > 0
                      ? "text-green-600"
                      : "text-red-600"
                  }
                >
                  {Math.abs(stats.avgDuration.change)}% from last week
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Bounce Rate
              </CardTitle>
              <MousePointer className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.bounceRate.value}</div>
              <div className="flex items-center text-xs">
                {stats.bounceRate.change < 0 ? (
                  <ArrowDownRight className="h-4 w-4 text-green-600" />
                ) : (
                  <ArrowUpRight className="h-4 w-4 text-red-600" />
                )}
                <span
                  className={
                    stats.bounceRate.change < 0
                      ? "text-green-600"
                      : "text-red-600"
                  }
                >
                  {Math.abs(stats.bounceRate.change)}% from last week
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Top Pages */}
          <Card>
            <CardHeader>
              <CardTitle>Top Pages</CardTitle>
              <CardDescription>Most viewed pages this week</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Page</TableHead>
                    <TableHead className="text-right">Views</TableHead>
                    <TableHead className="text-right">Avg. Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topPages.map((page, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-sm">
                        {page.path}
                      </TableCell>
                      <TableCell className="text-right">{page.views}</TableCell>
                      <TableCell className="text-right">{page.avgTime}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Traffic Sources */}
          <Card>
            <CardHeader>
              <CardTitle>Traffic Sources</CardTitle>
              <CardDescription>Where visitors come from</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source / Medium</TableHead>
                    <TableHead className="text-right">Sessions</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {utmSources.map((source, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <span className="font-medium">{source.source}</span>
                        <span className="text-muted-foreground">
                          {" "}
                          / {source.medium}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {source.sessions}
                      </TableCell>
                      <TableCell className="text-right">
                        {source.leads > 0 ? (
                          <Badge variant="default">{source.leads}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Recent Events */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Events</CardTitle>
            <CardDescription>Live activity feed</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentEvents.map((event, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      {event.device === "mobile" ? (
                        <Smartphone className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Monitor className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            event.type === "form_submit"
                              ? "default"
                              : event.type === "chat_started"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {event.type.replace("_", " ")}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {event.visitor}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-sm">
                        <Globe className="h-3 w-3 text-muted-foreground" />
                        <span className="font-mono">{event.url}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">{event.time}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AccountShell>
  );
}
