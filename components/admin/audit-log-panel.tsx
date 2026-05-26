// Recent audit log entries for the admin panel footer.

import { listRecentAuditLogs } from "@/lib/data/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export async function AuditLogPanel() {
  const logs = await listRecentAuditLogs();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent activity</CardTitle>
        <p className="text-xs text-muted-foreground">
          Last {logs.length} sensitive actions recorded in the audit log.
        </p>
      </CardHeader>
      <CardContent className="px-0">
        {logs.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No audit entries yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">When</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead className="pr-4">Resource</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="pl-4 text-muted-foreground tabular-nums">
                    {formatWhen(log.createdAt)}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{log.action}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {log.user?.email ?? "system"}
                  </TableCell>
                  <TableCell className="pr-4 text-muted-foreground">
                    {log.resourceType ?? "—"}
                    {log.resourceId ? (
                      <span className="ml-1 font-mono text-[10px] text-muted-foreground/80">
                        {log.resourceId.slice(0, 8)}…
                      </span>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function formatWhen(d: Date): string {
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
