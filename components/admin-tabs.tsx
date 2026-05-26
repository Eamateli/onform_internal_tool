// Tab navigation for the admin panel. Underline-style tabs (GitHub /
// Vercel inspired). Each tab is a real route under /admin so URLs are
// shareable / bookmarkable.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export interface AdminTabsProps {
  counts: {
    pendingRequests: number;
    pendingInvitations: number;
    activeUsers: number;
  };
}

interface TabDef {
  href: string;
  label: string;
  badge: number;
  // Tinted badge when there's something demanding attention (pending requests).
  // Neutral badge otherwise (just a count).
  tone: "neutral" | "attention";
}

export function AdminTabs({ counts }: AdminTabsProps) {
  const pathname = usePathname() ?? "/admin/requests";

  const tabs: TabDef[] = [
    {
      href: "/admin/requests",
      label: "Requests",
      badge: counts.pendingRequests,
      tone: counts.pendingRequests > 0 ? "attention" : "neutral",
    },
    {
      href: "/admin/users",
      label: "Users",
      badge: counts.activeUsers,
      tone: "neutral",
    },
    {
      href: "/admin/invitations",
      label: "Invitations",
      badge: counts.pendingInvitations,
      tone: counts.pendingInvitations > 0 ? "attention" : "neutral",
    },
  ];

  return (
    <nav
      className="flex items-center gap-1 border-b border-border"
      aria-label="Admin sections"
    >
      {tabs.map((tab) => {
        const isActive =
          pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span>{tab.label}</span>
            {tab.badge > 0 ? (
              <span
                className={cn(
                  "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-medium tabular-nums",
                  tab.tone === "attention"
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                    : "bg-muted text-muted-foreground",
                )}
                aria-label={`${tab.badge} ${tab.label.toLowerCase()}`}
              >
                {tab.badge}
              </span>
            ) : null}
            {isActive ? (
              <span
                aria-hidden="true"
                className="absolute -bottom-px left-0 right-0 h-0.5 bg-foreground"
              />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
