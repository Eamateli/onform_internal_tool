// Admin route group layout.
//
// Single point of:
//   • Role gate (requireAdmin redirects non-admins to /dashboard).
//   • Tab nav with badge counts for the three sub-routes.
//   • Page heading (subtitle is set by individual tabs via their own h-tags).
//
// All three tabs (requests, users, invitations) inherit this layout so the
// header + tabs stay stable while the body changes.

import { requireAdmin } from "@/lib/auth";
import { getAdminBadgeCounts } from "@/lib/data/admin";
import { AdminTabs } from "@/components/admin-tabs";
import { AuditLogPanel } from "@/components/admin/audit-log-panel";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Throws redirect if not ADMIN. Cached for the whole request so the page
  // below doesn't re-check.
  await requireAdmin();

  const counts = await getAdminBadgeCounts();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-medium tracking-tight">
          Admin
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage access requests, users and invitations.
        </p>
      </header>

      <AdminTabs counts={counts} />

      <div>{children}</div>

      <AuditLogPanel />
    </div>
  );
}
