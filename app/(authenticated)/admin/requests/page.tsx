// Admin → Requests tab — invite / reject / block wired in Phase 5e.

import { listJoinRequests } from "@/lib/data/admin";
import { RequestActions } from "@/components/admin/request-actions";
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

export default async function RequestsPage() {
  const requests = await listJoinRequests();

  if (requests.length === 0) {
    return <Empty />;
  }

  const now = new Date();

  return (
    <Card>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Received</TableHead>
              <TableHead className="pr-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((r) => {
              const isExpired = r.status === "PENDING" && r.expiresAt < now;
              const canAct = r.status === "PENDING" && !isExpired;
              return (
                <TableRow key={r.id}>
                  <TableCell className="pl-4 font-medium">{r.email}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.fullName ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-[24ch] truncate text-muted-foreground">
                    {r.reason ?? "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} expiresAt={r.expiresAt} />
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {formatDate(r.createdAt)}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <RequestActions
                      requestId={r.id}
                      email={r.email}
                      canAct={canAct}
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
      No access requests yet. New requests appear here as people submit the
      public form at{" "}
      <span className="font-mono text-foreground">/request-access</span>.
    </div>
  );
}

function StatusBadge({
  status,
  expiresAt,
}: {
  status: "PENDING" | "INVITED" | "REJECTED" | "EXPIRED" | "BLOCKED";
  expiresAt: Date;
}) {
  const isExpired = status === "PENDING" && expiresAt < new Date();
  const effective = isExpired ? "EXPIRED" : status;

  const styles: Record<string, string> = {
    PENDING:
      "bg-amber-100 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300",
    INVITED:
      "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300",
    REJECTED:
      "bg-rose-100 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300",
    EXPIRED: "bg-muted text-muted-foreground",
    BLOCKED:
      "bg-zinc-200 text-zinc-700 ring-1 ring-zinc-300 dark:bg-zinc-800/60 dark:text-zinc-300",
  };

  return (
    <Badge className={cn("hover:bg-current/0", styles[effective])}>
      {effective}
    </Badge>
  );
}

function formatDate(d: Date): string {
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
