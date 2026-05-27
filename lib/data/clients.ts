// Single source of truth for "what does the clients data look like?".
// Both the /api/clients route and the dashboard / per-client pages call
// into here, so we never accidentally render different shapes of the same
// data.
//
// Writes an AuditLog row on every successful read for compliance — we want
// "who looked at which client when". Audit writes are fire-and-forget so a
// logging hiccup never breaks a read.

import { prisma } from "@/lib/prisma";
import { queryBigQuery } from "@/lib/bigquery";
import type { User } from "@prisma/client";

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

// ─── Per-client detail ──────────────────────────────────────────────────────

export interface ClientMaster {
  client_id: string;
  client_name: string;
  industry: string | null;
  status: string;
  annual_revenue: number;
}

export interface ProfitLossSnapshot {
  period_month: string; // YYYY-MM-DD
  revenue: number;
  cogs: number;
  gross_profit: number;
  operating_expenses: number;
  ebitda: number;
  ebitda_margin_percent: number;
}

export interface CashRunwaySnapshot {
  current_cash: number;
  cash_as_of: string;
  avg_revenue: number;
  avg_burn: number;
  net_monthly_cashflow: number;
  runway_category: string;
}

export interface TransactionRow {
  transaction_id: string;
  type: string;
  category: string;
  subcategory: string | null;
  amount: number;
  source: string | null;
  transaction_date: string;
}

export interface ClientDetail {
  client: ClientMaster;
  pl: ProfitLossSnapshot | null;
  runway: CashRunwaySnapshot | null;
  transactions: TransactionRow[];
}

/**
 * Fetch everything we need to render `/clients/[clientId]`.
 *
 * Runs four BigQuery jobs in parallel:
 *   1. The client master row (one row, or none → returns `null`)
 *   2. The most recent P&L snapshot (might be missing for fresh clients)
 *   3. The cash runway snapshot (might be missing for fresh clients)
 *   4. The 10 most recent transactions
 *
 * Returns `null` (not an empty object) when the clientId doesn't exist, so
 * the caller can `notFound()`. All values use parameterised queries — no
 * string concatenation, even though clientId comes from a typed URL segment.
 */
export async function getClientDetail(
  clientId: string,
  viewer: User,
): Promise<ClientDetail | null> {
  const projectId = process.env.GOOGLE_PROJECT_ID;
  if (!projectId) throw new Error("GOOGLE_PROJECT_ID is not set");

  // Defence in depth: refuse clearly malformed ids before sending anything
  // to BigQuery. Real ids look like "client_001". Anything else is bogus.
  if (!/^[\w-]{1,64}$/.test(clientId)) return null;

  const ds = `${projectId}.${DATASET}`;

  const [clientRows, plRows, runwayRows, txRows] = await Promise.all([
    queryBigQuery<ClientMaster>(
      `
      SELECT
        client_id, client_name, industry, status,
        revenue AS annual_revenue
      FROM \`${ds}.clients\`
      WHERE client_id = @clientId
      LIMIT 1
      `,
      { clientId },
    ),
    queryBigQuery<ProfitLossSnapshot>(
      `
      SELECT
        period_month, revenue, cogs, gross_profit,
        operating_expenses, ebitda, ebitda_margin_percent
      FROM \`${ds}.v_profit_loss\`
      WHERE client_id = @clientId
      ORDER BY period_month DESC
      LIMIT 1
      `,
      { clientId },
    ),
    queryBigQuery<CashRunwaySnapshot>(
      `
      SELECT
        current_cash, cash_as_of, avg_revenue, avg_burn,
        net_monthly_cashflow,
        runway_months AS runway_category
      FROM \`${ds}.v_cash_runway\`
      WHERE client_id = @clientId
      LIMIT 1
      `,
      { clientId },
    ),
    queryBigQuery<TransactionRow>(
      `
      SELECT
        transaction_id, type, category, subcategory, amount, source,
        transaction_date
      FROM \`${ds}.transactions\`
      WHERE client_id = @clientId
      ORDER BY transaction_date DESC, transaction_id DESC
      LIMIT 10
      `,
      { clientId },
    ),
  ]);

  const client = clientRows[0];
  if (!client) return null;

  prisma.auditLog
    .create({
      data: {
        userId: viewer.id,
        action: "client.detail.viewed",
        resourceType: "Client",
        resourceId: client.client_id,
        metadata: {
          client_name: client.client_name,
          tx_count: txRows.length,
        },
      },
    })
    .catch((err) => {
      console.error("[client.detail] audit log failed:", err);
    });

  return {
    client,
    pl: plRows[0] ?? null,
    runway: runwayRows[0] ?? null,
    transactions: txRows,
  };
}
