// Admin → Invitations tab — list with resend / revoke on pending invites.

import { InvitationActions } from "@/components/admin/invitation-actions";
import { listInvitations } from "@/lib/data/admin";
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

export default async function InvitationsPage() {
  const invitations = await listInvitations();

  if (invitations.length === 0) {
    return <Empty />;
  }

  return (
    <Card>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sent by</TableHead>
              <TableHead>Sent</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead className="pr-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invitations.map((inv) => {
              const isExpired =
                inv.status === "PENDING" && inv.expiresAt < new Date();
              const effective = isExpired ? "EXPIRED" : inv.status;
              return (
                <TableRow key={inv.id}>
                  <TableCell className="pl-4 font-medium">{inv.email}</TableCell>
                  <TableCell>
                    <RoleBadge role={inv.role} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={effective} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {inv.invitedBy?.email ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {formatDate(inv.createdAt)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "tabular-nums",
                      isExpired
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-muted-foreground",
                    )}
                  >
                    {formatDate(inv.expiresAt)}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <InvitationActions
                      invitationId={inv.id}
                      email={inv.email}
                      canAct={inv.status === "PENDING"}
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
      No invitations sent yet. Approving a request from the{" "}
      <span className="font-medium text-foreground">Requests</span> tab will
      create one here.
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

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING:
      "bg-amber-100 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300",
    ACCEPTED:
      "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300",
    REVOKED:
      "bg-rose-100 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300",
    EXPIRED: "bg-muted text-muted-foreground",
  };
  return <Badge className={cn("hover:bg-current/0", styles[status])}>{status}</Badge>;
}

function formatDate(d: Date): string {
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
