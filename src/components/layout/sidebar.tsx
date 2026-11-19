"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  LayoutDashboard,
  Building2,
  MessageSquare,
  BarChart3,
  Settings,
  Globe,
  FileText,
  Home,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, description: "Overview" },
  { name: "Accounts", href: "/accounts", icon: Building2, description: "Manage clients" },
  { name: "Conversations", href: "/conversations", icon: MessageSquare, description: "Chat history" },
  { name: "Analytics", href: "/analytics", icon: BarChart3, description: "Performance" },
  { name: "Settings", href: "/settings", icon: Settings, description: "Configuration" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [isCollapsed, setIsCollapsed] = useState(false);
  // next-themes: theme is unknown on the server, so gate theme-dependent UI
  // until mounted to avoid a hydration mismatch on the toggle icon/label.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && theme === "dark";

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300",
        isCollapsed ? "w-16" : "w-56"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-sidebar-border px-4 py-4">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-lg shadow-emerald-500/20">
          <Zap className="h-5 w-5 text-white" />
        </div>
        {!isCollapsed && (
          <div className="overflow-hidden">
            <h1 className="text-lg font-bold">Agent</h1>
            <p className="truncate text-[10px] text-muted-foreground">Website Platform</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3">
        <div className="space-y-1 px-2">
          {navigation.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all",
                  isActive
                    ? "border border-emerald-500/30 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                title={isCollapsed ? item.name : undefined}
              >
                <div
                  className={cn(
                    "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg",
                    isActive
                      ? "bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-md shadow-emerald-500/30"
                      : "bg-muted group-hover:bg-secondary"
                  )}
                >
                  <Icon className={cn("h-4 w-4", isActive && "text-white")} />
                </div>
                {!isCollapsed && (
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium">{item.name}</span>
                    {item.description && (
                      <p className="truncate text-[10px] text-muted-foreground">
                        {item.description}
                      </p>
                    )}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Quick Stats */}
      <div className="border-t border-sidebar-border p-2">
        {!isCollapsed && (
          <p className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Status
          </p>
        )}
        <div
          className="flex items-center gap-3 rounded-lg bg-emerald-500/10 px-3 py-2"
          title={isCollapsed ? "3 Active Accounts" : undefined}
        >
          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded bg-emerald-500/20">
            <Building2 className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <span className="text-xs font-medium text-emerald-400">3 Active Accounts</span>
            </div>
          )}
        </div>
      </div>

      {/* Theme Toggle & Collapse */}
      <div className="border-t border-sidebar-border p-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
            {!isCollapsed && <span className="text-xs">{isDark ? "Light" : "Dark"}</span>}
          </button>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center justify-center rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}

export function AccountSidebar({ accountId }: { accountId: string }) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && theme === "dark";
  const basePath = `/accounts/${accountId}`;

  const accountNav = [
    { name: "Overview", href: basePath, icon: Home, description: "Account summary" },
    { name: "Listings", href: `${basePath}/listings`, icon: FileText, description: "Property listings" },
    { name: "Content", href: `${basePath}/content`, icon: FileText, description: "Social content" },
    { name: "Conversations", href: `${basePath}/conversations`, icon: MessageSquare, description: "Chat history" },
    { name: "Tracking", href: `${basePath}/tracking`, icon: BarChart3, description: "Analytics" },
    { name: "Settings", href: `${basePath}/settings`, icon: Settings, description: "Configuration" },
  ];

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300",
        isCollapsed ? "w-16" : "w-56"
      )}
    >
      {/* Back to Dashboard */}
      <div className="flex items-center gap-3 border-b border-sidebar-border px-4 py-4">
        <Link
          href="/"
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-muted transition-colors hover:bg-secondary"
          title="Back to Dashboard"
        >
          <LayoutDashboard className="h-5 w-5 text-muted-foreground" />
        </Link>
        {!isCollapsed && (
          <div className="overflow-hidden">
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
              Dashboard
            </Link>
          </div>
        )}
      </div>

      {/* Account Name */}
      <div className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-lg shadow-emerald-500/20">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          {!isCollapsed && (
            <div className="min-w-0 overflow-hidden">
              <div className="truncate font-semibold capitalize">
                {accountId.replace(/-/g, " ")}
              </div>
              <div className="text-[10px] text-muted-foreground">Account</div>
            </div>
          )}
        </div>
      </div>

      {/* Account Navigation */}
      <nav className="flex-1 overflow-y-auto py-3">
        <div className="space-y-1 px-2">
          {accountNav.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== basePath && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all",
                  isActive
                    ? "border border-emerald-500/30 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                title={isCollapsed ? item.name : undefined}
              >
                <div
                  className={cn(
                    "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg",
                    isActive
                      ? "bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-md shadow-emerald-500/30"
                      : "bg-muted group-hover:bg-secondary"
                  )}
                >
                  <Icon className={cn("h-4 w-4", isActive && "text-white")} />
                </div>
                {!isCollapsed && (
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium">{item.name}</span>
                    {item.description && (
                      <p className="truncate text-[10px] text-muted-foreground">
                        {item.description}
                      </p>
                    )}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Theme Toggle & Collapse */}
      <div className="border-t border-sidebar-border p-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
            {!isCollapsed && <span className="text-xs">{isDark ? "Light" : "Dark"}</span>}
          </button>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center justify-center rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
