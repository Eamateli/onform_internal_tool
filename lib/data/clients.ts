// Single source of truth for "what does the clients overview look like?".
// Both the /api/clients route and the dashboard server component call into
// here, so we never accidentally render different shapes of the same data.
//
// Writes an AuditLog row on every successful read. This is "any client list
// view by any user" → expect one row per dashboard load. We accept the volume
// for now; if it becomes noisy in production we'll switch to logging only
// at the API edge, or to a sampled rollup.

import { prisma } from "@/lib/prisma";
import { queryBigQuery } from "@/lib/bigquery";
import type { User } from "@/lib/generated/prisma/client";

// Mirrors the columns we SELECT below. BigQuery FLOAT → JS number. STRING → string.
// Anything nullable in BQ (LEFT JOIN can produce nulls for the runway columns
// if a client has no cash data yet) is typed as `| null`.
export interface ClientOverview {
  client_id: string;
  client_name: string;
  industry: string | null;
  status: string;
  annual_revenue: number;
  current_cash: number | null;
  cash_as_of: string | null; // YYYY-MM-DD
  avg_revenue: number | null;
  avg_burn: number | null;
  net_monthly_cashflow: number | null;
  runway_category: string | null; // e.g. "CASH_POSITIVE"
}

// Hard-coded dataset names. The `onform-data-warehouse` project ID comes
// from env so the same SQL works against a staging copy if we ever set one up.
const DATASET = "finance_data";

/**
 * Fetch every client with their latest cash/runway snapshot.
 *
 * `viewer` is the User row of whoever is doing the reading — used purely
 * for audit logging. Must be ACTIVE (caller's responsibility to gate; we
 * don't double-check here so we don't paper over a missing auth check).
 */
export async function getClientsOverview(viewer: User): Promise<ClientOverview[]> {
  const projectId = process.env.GOOGLE_PROJECT_ID;
  if (!projectId) throw new Error("GOOGLE_PROJECT_ID is not set");

  const sql = `
    SELECT
      c.client_id        AS client_id,
      c.client_name      AS client_name,
      c.industry         AS industry,
      c.status           AS status,
      c.revenue          AS annual_revenue,
      r.current_cash     AS current_cash,
      r.cash_as_of       AS cash_as_of,
      r.avg_revenue      AS avg_revenue,
      r.avg_burn         AS avg_burn,
      r.net_monthly_cashflow AS net_monthly_cashflow,
      r.runway_months    AS runway_category
    FROM \`${projectId}.${DATASET}.clients\` AS c
    LEFT JOIN \`${projectId}.${DATASET}.v_cash_runway\` AS r
      ON c.client_id = r.client_id
    ORDER BY c.client_name
  `;

  const rows = await queryBigQuery<ClientOverview>(sql);

  // Fire-and-forget audit log. Don't block the response if logging fails —
  // we'd rather serve the data and lose one log entry than 500 the user.
  prisma.auditLog
    .create({
      data: {
        userId: viewer.id,
        action: "clients.overview.viewed",
        resourceType: "ClientsOverview",
        resourceId: null,
        metadata: { count: rows.length },
      },
    })
    .catch((err) => {
      console.error("[clients.overview] audit log failed:", err);
    });

  return rows;
}
