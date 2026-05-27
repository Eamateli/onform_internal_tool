// BigQuery reads for client export (Excel / PDF).
// Fetches a wider slice than the detail page: all transactions (capped) and
// full budget-vs-actual rows for the client.

import { prisma } from "@/lib/prisma";
import { queryBigQuery } from "@/lib/bigquery";
import type { User } from "@prisma/client";

import type {
  CashRunwaySnapshot,
  ClientMaster,
  ProfitLossSnapshot,
  TransactionRow,
} from "@/lib/data/clients";

const DATASET = "finance_data";
const MAX_TRANSACTIONS = 1000;

export interface BudgetVarianceRow {
  period_month: string;
  category: string;
  subcategory: string | null;
  budget_amount: number;
  actual_amount: number;
  variance_amount: number;
  status: string;
}

export interface ClientExportData {
  client: ClientMaster;
  pl: ProfitLossSnapshot | null;
  runway: CashRunwaySnapshot | null;
  transactions: TransactionRow[];
  budgetVariance: BudgetVarianceRow[];
}

export async function getClientExportData(
  clientId: string,
  viewer: User,
): Promise<ClientExportData | null> {
  const projectId = process.env.GOOGLE_PROJECT_ID;
  if (!projectId) throw new Error("GOOGLE_PROJECT_ID is not set");
  if (!/^[\w-]{1,64}$/.test(clientId)) return null;

  const ds = `${projectId}.${DATASET}`;

  const [clientRows, plRows, runwayRows, txRows, budgetRows] =
    await Promise.all([
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
        LIMIT ${MAX_TRANSACTIONS}
        `,
        { clientId },
      ),
      queryBigQuery<BudgetVarianceRow>(
        `
        SELECT
          period_month, category, subcategory,
          budget_amount, actual_amount, variance_amount, status
        FROM \`${ds}.v_budget_vs_actual\`
        WHERE client_id = @clientId
        ORDER BY period_month DESC, category ASC, subcategory ASC
        `,
        { clientId },
      ),
    ]);

  const client = clientRows[0];
  if (!client) return null;

  return {
    client,
    pl: plRows[0] ?? null,
    runway: runwayRows[0] ?? null,
    transactions: txRows,
    budgetVariance: budgetRows,
  };
}

export async function auditClientExport(
  viewer: User,
  client: ClientMaster,
  format: "excel" | "pdf",
): Promise<void> {
  await prisma.auditLog
    .create({
      data: {
        userId: viewer.id,
        action: format === "excel" ? "client.export.excel" : "client.export.pdf",
        resourceType: "Client",
        resourceId: client.client_id,
        metadata: {
          client_name: client.client_name,
          format,
        },
      },
    })
    .catch((err) => {
      console.error(`[client.export.${format}] audit log failed:`, err);
    });
}

export function sanitizeFilename(name: string): string {
  return name
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60)
    .toLowerCase();
}
