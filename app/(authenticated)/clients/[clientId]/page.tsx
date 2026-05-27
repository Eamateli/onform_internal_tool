// Per-client detail page.
//
// URL: /clients/<clientId>  (e.g. /clients/client_001)
//
// Data shape comes straight from BigQuery via `getClientDetail()`:
//   • client master row  → name / industry / status / annual revenue
//   • latest P&L row     → revenue / gross profit / EBITDA / margin
//   • latest cash runway → cash on hand / net monthly / runway category
//   • recent transactions (10) → mini table
//
// Auth gating happens in the parent (authenticated) layout. We still
// `requireActiveUserOrRedirect` here defensively in case someone navigates
// straight to this route under unusual conditions.

import Link from "next/link";
import { notFound } from "next/navigation";

import { ArrowLeft, ExternalLink, Plus } from "lucide-react";

import { getOrCreateUserFromClerk } from "@/lib/auth";
import {
  getClientDetail,
  type CashRunwaySnapshot,
  type ClientMaster,
  type ProfitLossSnapshot,
  type TransactionRow,
} from "@/lib/data/clients";
import { ClientExportButtons } from "@/components/client-export-buttons";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

interface PageProps {
  // In Next.js 16, route params are async.
  params: Promise<{ clientId: string }>;
}

export default async function ClientDetailPage({ params }: PageProps) {
  const { clientId } = await params;

  const dbUser = await getOrCreateUserFromClerk();
  if (!dbUser || dbUser.status !== "ACTIVE") {
    // Layout would already have intercepted, but belt-and-braces.
    notFound();
  }

  const detail = await getClientDetail(clientId, dbUser);
  if (!detail) notFound();

  const { client, pl, runway, transactions } = detail;

  return (
    <div className="space-y-8">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to dashboard
      </Link>

      <ClientHeader
        client={client}
        period={pl?.period_month ?? null}
        clientId={clientId}
      />

      <Scorecards pl={pl} runway={runway} annualRevenue={client.annual_revenue} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <RecentTransactions transactions={transactions} />
          <MakeYourTablePlaceholder />
        </div>
        <Connections />
      </div>
    </div>
  );
}

// ─── Header ─────────────────────────────────────────────────────────────────

function ClientHeader({
  client,
  period,
  clientId,
}: {
  client: ClientMaster;
  period: string | null;
  clientId: string;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-2">
        <h1 className="font-heading text-2xl font-medium tracking-tight">
          {client.client_name}
        </h1>
        <div className="flex flex-wrap items-center gap-1.5">
          {client.industry ? (
            <Badge variant="outline">{client.industry}</Badge>
          ) : null}
          <StatusBadge status={client.status} />
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        {period ? (
          <p className="text-xs text-muted-foreground">
            Latest period · {formatMonth(period)}
          </p>
        ) : null}
        <ClientExportButtons clientId={clientId} />
      </div>
    </header>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "Active") {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/60">
        {status}
      </Badge>
    );
  }
  return <Badge variant="secondary">{status}</Badge>;
}

// ─── Scorecards ─────────────────────────────────────────────────────────────

function Scorecards({
  pl,
  runway,
  annualRevenue,
}: {
  pl: ProfitLossSnapshot | null;
  runway: CashRunwaySnapshot | null;
  annualRevenue: number;
}) {
  // We show 5 KPIs. Two come from the master row (annual revenue acts as a
  // size indicator), three from the latest P&L, one each from cash runway.
  // Fall back to "—" when the corresponding view has no data yet.
  const tone = (net: number | null): ScoreTone =>
    net === null ? "neutral" : net > 0 ? "positive" : net < 0 ? "negative" : "neutral";

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
      <Scorecard label="Annual revenue" value={formatGBP(annualRevenue)} />
      <Scorecard label="Monthly revenue" value={formatGBP(pl?.revenue ?? null)} />
      <Scorecard
        label="Gross profit"
        value={formatGBP(pl?.gross_profit ?? null)}
        sub={pl ? `${Math.round(((pl.gross_profit / pl.revenue) * 100 || 0))}% margin` : null}
      />
      <Scorecard
        label="EBITDA"
        value={formatGBP(pl?.ebitda ?? null)}
        sub={pl ? `${pl.ebitda_margin_percent}% margin` : null}
        tone={tone(pl?.ebitda ?? null)}
      />
      <Scorecard
        label="Cash on hand"
        value={formatGBP(runway?.current_cash ?? null)}
        sub={runway ? formatRunway(runway.runway_category) : null}
        tone={tone(runway?.net_monthly_cashflow ?? null)}
      />
    </div>
  );
}

type ScoreTone = "positive" | "neutral" | "negative";

function Scorecard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string | null;
  tone?: ScoreTone;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle
          className={cn(
            "text-xl font-semibold tracking-tight",
            tone === "positive" && "text-emerald-600 dark:text-emerald-400",
            tone === "negative" && "text-rose-600 dark:text-rose-400",
          )}
        >
          {value}
        </CardTitle>
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {sub ? (
          <p className="text-xs text-muted-foreground">{sub}</p>
        ) : null}
      </CardHeader>
    </Card>
  );
}

// ─── Transactions ───────────────────────────────────────────────────────────

function RecentTransactions({
  transactions,
}: {
  transactions: TransactionRow[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent transactions</CardTitle>
        <p className="text-xs text-muted-foreground">
          Last {transactions.length || 0} entries from the warehouse.
        </p>
      </CardHeader>
      <CardContent className="px-0">
        {transactions.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No transactions recorded yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="pr-4 text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((tx) => (
                <TableRow key={tx.transaction_id}>
                  <TableCell className="pl-4 text-muted-foreground">
                    {formatDate(tx.transaction_date)}
                  </TableCell>
                  <TableCell>
                    <div className="leading-tight">
                      <span className="font-medium">{tx.category}</span>
                      {tx.subcategory ? (
                        <span className="ml-1 text-xs text-muted-foreground">
                          / {tx.subcategory}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={tx.type === "Revenue" ? "secondary" : "outline"}
                      className={cn(
                        tx.type === "Revenue" &&
                          "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/60",
                      )}
                    >
                      {tx.type}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className={cn(
                      "pr-4 text-right font-medium tabular-nums",
                      tx.amount > 0 && "text-emerald-700 dark:text-emerald-400",
                      tx.amount < 0 && "text-rose-700 dark:text-rose-400",
                    )}
                  >
                    {formatGBP(tx.amount)}
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

function MakeYourTablePlaceholder() {
  return (
    <Card className="border-dashed bg-muted/20">
      <CardContent className="py-8 text-center">
        <p className="text-sm text-muted-foreground">
          Make your table{" "}
          <span className="text-muted-foreground/70">(coming soon)</span>
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Connections ────────────────────────────────────────────────────────────

function Connections() {
  // We don't yet store per-client URLs for Xero / Shopify in the warehouse,
  // so for now these point at the providers' main app. Wire per-client URLs
  // in once we add a `client_connections` table.
  const dataStudioUrl =
    process.env.NEXT_PUBLIC_DATA_STUDIO_DASHBOARD_URL || "https://lookerstudio.google.com/";

  const links: { label: string; href: string; note: string }[] = [
    { label: "Xero", href: "https://go.xero.com/", note: "Open accounting" },
    { label: "Shopify", href: "https://www.shopify.com/admin", note: "Open store admin" },
    { label: "Data Studio", href: dataStudioUrl, note: "Open live dashboard" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Connections</CardTitle>
        <p className="text-xs text-muted-foreground">
          Jump into the source systems.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {links.map((link) => (
          // Plain <a> styled like an outline button. This shadcn build uses
          // Base UI's Button which doesn't support `asChild`, so we apply
          // `buttonVariants()` directly to the anchor.
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "h-auto w-full justify-between py-2",
            )}
          >
            <span className="flex flex-col items-start text-left">
              <span className="font-medium leading-tight">{link.label}</span>
              <span className="text-[11px] text-muted-foreground">
                {link.note}
              </span>
            </span>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          </a>
        ))}
        <div
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "h-auto w-full cursor-not-allowed justify-between py-2 opacity-60",
          )}
          aria-disabled="true"
        >
          <span className="flex flex-col items-start text-left">
            <span className="font-medium leading-tight">Add Connection</span>
            <span className="text-[11px] text-muted-foreground">
              Coming soon
            </span>
          </span>
          <Plus className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Formatters ─────────────────────────────────────────────────────────────

const GBP = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

function formatGBP(value: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return GBP.format(value);
}

function formatMonth(yyyymmdd: string): string {
  // "2024-01-01" → "January 2024"
  const d = new Date(yyyymmdd);
  if (Number.isNaN(d.getTime())) return yyyymmdd;
  return d.toLocaleString("en-GB", { month: "long", year: "numeric" });
}

function formatDate(yyyymmdd: string): string {
  // "2024-01-25" → "25 Jan"
  const d = new Date(yyyymmdd);
  if (Number.isNaN(d.getTime())) return yyyymmdd;
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short" });
}

function formatRunway(category: string): string {
  return category
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}
