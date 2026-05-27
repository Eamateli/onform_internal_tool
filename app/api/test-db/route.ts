// Sanity check for our DB connection. Lives only for development / Phase 4
// troubleshooting. Locked behind auth so a casual visitor can't probe it.
//
// Returns counts that let you confirm:
//   • Prisma can talk to Neon
//   • Tables exist
//   • Webhooks have run (userCount > 0 after sign-up)

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { enforceUserRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const limited = enforceUserRateLimit(userId);
  if (limited) return limited;

  try {
    const [userCount, adminCount, pendingRequests, pendingInvitations] =
      await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { role: "ADMIN", status: "ACTIVE" } }),
        prisma.joinRequest.count({ where: { status: "PENDING" } }),
        prisma.invitation.count({ where: { status: "PENDING" } }),
      ]);

    return Response.json({
      ok: true,
      userCount,
      adminCount,
      pendingRequests,
      pendingInvitations,
    });
  } catch (err) {
    console.error("[test-db] error:", err);
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
