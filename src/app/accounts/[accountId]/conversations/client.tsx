"use client";

import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  MessageSquare,
  Search,
  User,
  Mail,
  Clock,
  ArrowRight,
  ExternalLink,
} from "lucide-react";

// Mock conversations
const conversations = [
  {
    id: "conv-1",
    visitor: "Anonymous",
    email: null,
    phase: "probe",
    topic: "waterfront",
    messages: [
      {
        role: "user",
        content: "I'm looking for waterfront property on the north shore.",
        time: "2:30 PM",
      },
      {
        role: "assistant",
        content:
          "So you're looking for waterfront property on the north shore. That's a beautiful area! What's driving your interest in that location specifically?",
        time: "2:30 PM",
      },
      {
        role: "user",
        content: "We want a summer cottage close to the beach.",
        time: "2:31 PM",
      },
      {
        role: "assistant",
        content:
          "A summer cottage close to the beach sounds wonderful. Are you looking for something move-in ready, or would you be open to building on a vacant lot?",
        time: "2:31 PM",
      },
    ],
    discoveries: [
      { category: "goal", value: "Summer cottage near beach" },
      { category: "current_state", value: "Looking for waterfront" },
    ],
    startedAt: "2:30 PM today",
    lastActivity: "5 min ago",
  },
  {
    id: "conv-2",
    visitor: "Sarah M.",
    email: "sarah@example.com",
    phase: "captured",
    topic: "lots",
    messages: [
      {
        role: "user",
        content: "What lots do you have available in Park Corner?",
        time: "1:15 PM",
      },
      {
        role: "assistant",
        content:
          "We have several beautiful lots in Park Corner! One that stands out is Lot 24-1 Blue Water Avenue - a 2.67-acre ocean view lot. Would you like more details on that one?",
        time: "1:15 PM",
        citations: [{ title: "Lot 24-1 Blue Water Av", url: "#" }],
      },
      {
        role: "user",
        content: "Yes, that sounds interesting. What's the price?",
        time: "1:16 PM",
      },
      {
        role: "assistant",
        content:
          "The lot is listed at $269,000. It's a stunning property with ocean views. Based on what you've shared, I think a quick call could help clarify if this is the right fit. Would you like to schedule a time to chat?",
        time: "1:16 PM",
      },
      {
        role: "user",
        content: "Sure, my email is sarah@example.com",
        time: "1:18 PM",
      },
    ],
    discoveries: [
      { category: "goal", value: "Looking for lots in Park Corner" },
      { category: "budget", value: "Interested in $269k listing" },
    ],
    startedAt: "1:15 PM today",
    lastActivity: "1 hour ago",
  },
  {
    id: "conv-3",
    visitor: "Anonymous",
    email: null,
    phase: "mirror",
    topic: null,
    messages: [
      {
        role: "user",
        content: "What's the price range for lots?",
        time: "11:30 AM",
      },
      {
        role: "assistant",
        content:
          "So you're interested in knowing the price range for lots. Our listings range from around $29,000 for cottage lots up to $269,000 for premium ocean view properties. What kind of lot are you envisioning?",
        time: "11:30 AM",
      },
    ],
    discoveries: [],
    startedAt: "11:30 AM today",
    lastActivity: "3 hours ago",
  },
];

const phaseColors: Record<string, string> = {
  mirror: "bg-blue-100 text-blue-800",
  probe: "bg-purple-100 text-purple-800",
  label: "bg-amber-100 text-amber-800",
  cta: "bg-green-100 text-green-800",
  captured: "bg-emerald-100 text-emerald-800",
  ended: "bg-gray-100 text-gray-800",
};

interface ConversationsClientProps {
  accountId: string;
}

export function ConversationsClient({ accountId }: ConversationsClientProps) {
  const [selectedId, setSelectedId] = useState(conversations[0].id);
  const selected = conversations.find((c) => c.id === selectedId);

  return (
    <AccountShell accountId={accountId}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Conversations</h1>
          <p className="text-muted-foreground">
            View and manage chatbot conversations
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{conversations.length}</div>
              <div className="text-sm text-muted-foreground">Total Today</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">
                {conversations.filter((c) => c.phase !== "captured" && c.phase !== "ended").length}
              </div>
              <div className="text-sm text-muted-foreground">Active</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">
                {conversations.filter((c) => c.phase === "captured").length}
              </div>
              <div className="text-sm text-muted-foreground">Leads Captured</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">4.2</div>
              <div className="text-sm text-muted-foreground">Avg. Messages</div>
            </CardContent>
          </Card>
        </div>

        {/* Conversations Panel */}
        <div className="grid gap-6 lg:grid-cols-[350px_1fr]">
          {/* List */}
          <Card className="h-[600px]">
            <CardHeader className="pb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search conversations..." className="pl-9" />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[520px]">
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => setSelectedId(conv.id)}
                    className={`cursor-pointer border-b p-4 transition-colors hover:bg-muted/50 ${
                      selectedId === conv.id ? "bg-muted" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                          {conv.email ? (
                            <Mail className="h-4 w-4 text-primary" />
                          ) : (
                            <User className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium">{conv.visitor}</div>
                          <div className="text-xs text-muted-foreground">
                            {conv.email || "No email yet"}
                          </div>
                        </div>
                      </div>
                      <Badge className={phaseColors[conv.phase]}>
                        {conv.phase}
                      </Badge>
                    </div>
                    <p className="mt-2 line-clamp-1 text-sm text-muted-foreground">
                      {conv.messages[conv.messages.length - 1].content}
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {conv.lastActivity}
                      <span className="mx-1">·</span>
                      {conv.messages.length} messages
                    </div>
                  </div>
                ))}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Detail */}
          {selected && (
            <Card className="h-[600px] flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {selected.visitor}
                      <Badge className={phaseColors[selected.phase]}>
                        {selected.phase}
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      Started {selected.startedAt}
                      {selected.topic && ` · Topic: ${selected.topic}`}
                    </CardDescription>
                  </div>
                  {selected.email && (
                    <Button variant="outline" size="sm">
                      <Mail className="mr-2 h-4 w-4" />
                      {selected.email}
                    </Button>
                  )}
                </div>
              </CardHeader>

              <Separator />

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {selected.messages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex ${
                        msg.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        <p className="text-sm">{msg.content}</p>
                        {"citations" in msg && msg.citations && (
                          <div className="mt-2 space-y-1">
                            {msg.citations.map((cite, j) => (
                              <a
                                key={j}
                                href={cite.url}
                                className="flex items-center gap-1 text-xs underline opacity-75 hover:opacity-100"
                              >
                                <ExternalLink className="h-3 w-3" />
                                {cite.title}
                              </a>
                            ))}
                          </div>
                        )}
                        <div
                          className={`mt-1 text-xs ${
                            msg.role === "user"
                              ? "text-primary-foreground/70"
                              : "text-muted-foreground"
                          }`}
                        >
                          {msg.time}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <Separator />

              {/* Discoveries */}
              {selected.discoveries.length > 0 && (
                <div className="p-4">
                  <div className="text-sm font-medium mb-2">Discoveries</div>
                  <div className="flex flex-wrap gap-2">
                    {selected.discoveries.map((d, i) => (
                      <Badge key={i} variant="outline">
                        <span className="font-medium capitalize">
                          {d.category}:
                        </span>
                        <span className="ml-1">{d.value}</span>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </AccountShell>
  );
}
