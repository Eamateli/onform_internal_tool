// Top navigation for every authenticated page.
//
// Client component because we need `usePathname()` to highlight the active
// link. Auth-aware bits (whether the Admin link shows, whose UserButton
// renders) live in the server-side layout that mounts this nav.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";

import { cn } from "@/lib/utils";

interface SiteNavProps {
  isAdmin: boolean;
}

const baseLinks: { href: string; label: string }[] = [
  { href: "/dashboard", label: "Dashboard" },
];

export function SiteNav({ isAdmin }: SiteNavProps) {
  const pathname = usePathname() ?? "/";

  const links = [
    ...baseLinks,
    ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-6">
        <Link
          href="/dashboard"
          className="font-heading text-lg font-semibold tracking-tight"
          aria-label="OnForm — go to dashboard"
        >
          OnForm
        </Link>

        <nav className="flex flex-1 items-center gap-1" aria-label="Primary">
          {links.map((link) => {
            // "Starts with" so /clients/<id> highlights Dashboard too (since
            // it's part of the same overall area). Admin section is its own.
            const isActive =
              link.href === "/dashboard"
                ? pathname === "/dashboard" || pathname.startsWith("/clients")
                : pathname === link.href || pathname.startsWith(`${link.href}/`);

            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* UserButton must have something to render into; keep a min-size
            wrapper so the layout doesn't collapse during client-side hydration. */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center">
          <UserButton />
        </div>
      </div>
    </header>
  );
}
