// Admin → Users tab — list with promote / demote / block / unblock / remove.

import { UserActions } from "@/components/admin/user-actions";
import { listUsers } from "@/lib/data/admin";
import { requireAdmin } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const currentAdmin = await requireAdmin();
  const users = await listUsers();

  if (users.length === 0) {
    return <Empty />;
  }

  return (
    <Card>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="pr-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => {
              const displayName = [u.profile?.firstName, u.profile?.lastName]
                .filter(Boolean)
                .join(" ");
              return (
                <TableRow key={u.id}>
                  <TableCell className="pl-4 font-medium">
                    {displayName || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {u.email}
                  </TableCell>
                  <TableCell>
                    <RoleBadge role={u.role} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={u.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {formatDate(u.createdAt)}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <UserActions
                      userId={u.id}
                      email={u.email}
                      role={u.role}
                      status={u.status}
                      isSelf={u.id === currentAdmin.id}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function Empty() {
  return (
    <div className="rounded-xl border border-dashed border-border px-6 py-14 text-center text-sm text-muted-foreground">
      No users yet.
    </div>
  );
}

function RoleBadge({ role }: { role: "ADMIN" | "USER" }) {
  if (role === "ADMIN") {
    return (
      <Badge className="bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 dark:ring-indigo-900/60">
        Admin
      </Badge>
    );
  }
  return <Badge variant="secondary">User</Badge>;
}

function StatusBadge({ status }: { status: "ACTIVE" | "BLOCKED" }) {
  if (status === "ACTIVE") {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/60">
        Active
      </Badge>
    );
  }
  return (
    <Badge className={cn("bg-rose-100 text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100")}>
      Blocked
    </Badge>
  );
}

function formatDate(d: Date): string {
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
