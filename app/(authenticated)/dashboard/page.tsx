// Dashboard — list of every client in the warehouse with their headline
// financial health metrics. Auth gate lives in the parent layout; by the
// time this renders we know `dbUser.status === "ACTIVE"`.

import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";

import { getOrCreateUserFromClerk } from "@/lib/auth";
import { getClientsOverview, type ClientOverview } from "@/lib/data/clients";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default async function DashboardPage() {
  // Layout already verified `dbUser?.status === "ACTIVE"` before rendering us;
  // this call is free thanks to React.cache() in lib/auth.ts.
  const dbUser = await getOrCreateUserFromClerk();
  if (!dbUser) return null; // defensive — layout would already have intercepted

  const clerkUser = await currentUser();
  const firstName = clerkUser?.firstName;
  const email = clerkUser?.primaryEmailAddress?.emailAddress;

  const clients = await getClientsOverview(dbUser);

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-medium tracking-tight">
            Welcome{firstName ? `, ${firstName}` : ""}.
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Signed in as {email ?? "unknown"} ·{" "}
            <span className="font-medium text-foreground">{dbUser.role}</span>
          </p>
        </div>
        <span className="text-xs text-muted-foreground">
          {clients.length} client{clients.length === 1 ? "" : "s"}
        </span>
      </header>

      <ClientsGrid clients={clients} />
    </div>
  );
}

function ClientsGrid({ clients }: { clients: ClientOverview[] }) {
  if (clients.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-6 py-14 text-center text-sm text-muted-foreground">
        No clients in the warehouse yet.
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {clients.map((c) => (
        <li key={c.client_id}>
          <ClientCard client={c} />
        </li>
      ))}
    </ul>
  );
}

function ClientCard({ client }: { client: ClientOverview }) {
  const health = healthFromCashflow(client.net_monthly_cashflow);

  return (
    <Link
      href={`/clients/${client.client_id}`}
      className="group/link block h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      aria-label={`View ${client.client_name}`}
    >
      <Card className="h-full transition group-hover/link:shadow-md group-hover/link:ring-foreground/20">
        <CardHeader>
          <CardTitle className="flex items-start justify-between gap-3">
            <span className="min-w-0 truncate">{client.client_name}</span>
            <HealthDot tone={health.tone} label={health.label} />
          </CardTitle>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {client.industry ? (
              <Badge variant="outline">{client.industry}</Badge>
            ) : null}
            <StatusBadge status={client.status} />
          </div>
        </CardHeader>

        <CardContent>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-3">
            <Metric label="Annual revenue" value={formatGBP(client.annual_revenue)} />
            <Metric label="Cash on hand" value={formatGBP(client.current_cash)} />
            <Metric
              label="Net monthly"
              value={formatGBP(client.net_monthly_cashflow)}
              tone={health.tone}
            />
            <Metric label="Runway" value={formatRunway(client.runway_category)} />
          </dl>
        </CardContent>
      </Card>
    </Link>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: HealthTone;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-0.5 truncate font-medium",
          tone === "positive" && "text-emerald-600 dark:text-emerald-400",
          tone === "negative" && "text-rose-600 dark:text-rose-400",
          !tone && "text-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  // "Active" gets a positive tint; everything else (Onboarding, Paused, etc.)
  // is muted neutral so it doesn't compete visually.
  if (status === "Active") {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/60">
        {status}
      </Badge>
    );
  }
  return <Badge variant="secondary">{status}</Badge>;
}

type HealthTone = "positive" | "neutral" | "negative";

function HealthDot({ tone, label }: { tone: HealthTone; label: string }) {
  return (
    <span
      title={label}
      aria-label={label}
      className={cn(
        "mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full",
        tone === "positive" && "bg-emerald-500",
        tone === "negative" && "bg-rose-500",
        tone === "neutral" && "bg-zinc-400",
      )}
    />
  );
}

function healthFromCashflow(net: number | null): {
  tone: HealthTone;
  label: string;
} {
  if (net === null) return { tone: "neutral", label: "No cashflow data" };
  if (net > 0) return { tone: "positive", label: "Cash positive" };
  if (net < 0) return { tone: "negative", label: "Burning cash" };
  return { tone: "neutral", label: "Break-even" };
}

const GBP = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

function formatGBP(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "—";
  return GBP.format(value);
}

function formatRunway(category: string | null): string {
  if (!category) return "—";
  return category
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}
