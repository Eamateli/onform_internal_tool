import { currentUser } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";

import { getOrCreateUserFromClerk } from "@/lib/auth";
import { getClientsOverview, type ClientOverview } from "@/lib/data/clients";

// Server component. Auth is enforced upstream by proxy.ts — by the time this
// renders we are guaranteed a signed-in Clerk user. We still:
//   • Lazy-provision the DB User row (idempotent; founding-admin bypass etc).
//   • Pull the client list directly via the shared lib (no self-HTTP fetch).
export default async function DashboardPage() {
  const dbUser = await getOrCreateUserFromClerk();
  const clerkUser = await currentUser();
  const firstName = clerkUser?.firstName;
  const email = clerkUser?.primaryEmailAddress?.emailAddress;

  // Fetch clients only for ACTIVE provisioned users. Anyone else sees a
  // contextual message instead.
  const clients =
    dbUser?.status === "ACTIVE" ? await getClientsOverview(dbUser) : null;

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <span className="text-lg font-semibold tracking-tight">OnForm</span>
        <UserButton />
      </header>

      <section className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Welcome{firstName ? `, ${firstName}` : ""}.
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Signed in as {email ?? "unknown"}
              {dbUser ? (
                <>
                  {" "}
                  · <span className="font-medium">{dbUser.role}</span>
                </>
              ) : null}
            </p>
          </div>
          {clients ? (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {clients.length} client{clients.length === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>

        <div className="mt-10">
          {dbUser === null ? <NotProvisioned /> : null}
          {dbUser?.status === "BLOCKED" ? <Blocked /> : null}
          {clients ? <ClientsGrid clients={clients} /> : null}
        </div>
      </section>
    </main>
  );
}

function ClientsGrid({ clients }: { clients: ClientOverview[] }) {
  if (clients.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 px-6 py-14 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
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
    <article className="group flex h-full flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {client.client_name}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {client.industry ? (
              <Badge tone="neutral">{client.industry}</Badge>
            ) : null}
            <Badge tone={client.status === "Active" ? "success" : "neutral"}>
              {client.status}
            </Badge>
          </div>
        </div>
        <HealthDot tone={health.tone} title={health.label} />
      </header>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
        <Metric label="Annual revenue" value={formatGBP(client.annual_revenue)} />
        <Metric label="Cash on hand" value={formatGBP(client.current_cash)} />
        <Metric
          label="Net monthly"
          value={formatGBP(client.net_monthly_cashflow)}
          tone={health.tone}
        />
        <Metric label="Runway" value={formatRunway(client.runway_category)} />
      </dl>
    </article>
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
  const valueClass =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "negative"
        ? "text-rose-600 dark:text-rose-400"
        : "text-zinc-900 dark:text-zinc-100";
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </dt>
      <dd className={`mt-0.5 truncate font-medium ${valueClass}`}>{value}</dd>
    </div>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "neutral" | "success";
}) {
  const cls =
    tone === "success"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/60"
      : "bg-zinc-100 text-zinc-700 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${cls}`}
    >
      {children}
    </span>
  );
}

type HealthTone = "positive" | "neutral" | "negative";

function HealthDot({ tone, title }: { tone: HealthTone; title: string }) {
  const cls =
    tone === "positive"
      ? "bg-emerald-500"
      : tone === "negative"
        ? "bg-rose-500"
        : "bg-zinc-400";
  return (
    <span
      title={title}
      aria-label={title}
      className={`mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${cls}`}
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
  // Warehouse stores "CASH_POSITIVE" / "RUNWAY_<X>_MONTHS" / etc. Make it friendly.
  return category.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

function NotProvisioned() {
  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 px-6 py-10 text-sm text-amber-900 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-200">
      <p className="font-medium">Account not yet provisioned.</p>
      <p className="mt-1 text-amber-800/80 dark:text-amber-200/80">
        Your Clerk session is valid but you don&apos;t have an active account
        in our system. An admin needs to invite you before you can access
        client data.
      </p>
    </div>
  );
}

function Blocked() {
  return (
    <div className="rounded-2xl border border-rose-300 bg-rose-50 px-6 py-10 text-sm text-rose-900 dark:border-rose-800/40 dark:bg-rose-950/30 dark:text-rose-200">
      <p className="font-medium">This account has been blocked.</p>
      <p className="mt-1 text-rose-800/80 dark:text-rose-200/80">
        Contact your administrator if you believe this is in error.
      </p>
    </div>
  );
}
