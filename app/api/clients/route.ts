// GET /api/clients
// Returns the dashboard's clients overview as JSON. Same data the dashboard
// server component shows, exposed at an HTTP endpoint so future client-side
// features (live refresh, search-as-you-type, etc.) have something to hit.
//
// Auth flow:
//   1. Clerk session must exist (proxy.ts enforces this for any non-public
//      route, but we re-check here as defence-in-depth — never trust the
//      caller to have hit our middleware).
//   2. The user must have a DB row (getOrCreateUserFromClerk).
//   3. The DB row must be ACTIVE (not BLOCKED).
// Any failure returns 401/403 with a generic message — no enumeration.

import { getOrCreateUserFromClerk } from "@/lib/auth";
import { getClientsOverview } from "@/lib/data/clients";

// Prisma's query engine and Google's BigQuery client both need Node APIs.
export const runtime = "nodejs";

// Don't try to cache this — the data is per-user-auditable and we want fresh
// reads on every hit. (Next.js would otherwise statically-render an empty
// version at build time.)
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getOrCreateUserFromClerk();
  if (!user) {
    return Response.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }
  if (user.status !== "ACTIVE") {
    return Response.json(
      { ok: false, error: "Account inactive" },
      { status: 403 },
    );
  }

  try {
    const clients = await getClientsOverview(user);
    return Response.json({ ok: true, clients });
  } catch (err) {
    // queryBigQuery already logged the gory details and rethrew a generic
    // error. Surface a clean message to the client.
    console.error("[api/clients] failed:", err);
    return Response.json(
      { ok: false, error: "Failed to load clients" },
      { status: 500 },
    );
  }
}
