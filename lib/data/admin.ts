// Read-side helpers for the admin panel. Write actions (invite / reject /
// block / promote / demote / revoke) live in their own server actions under
// app/(authenticated)/admin/_actions/ and ship in sub-phases 5e + 5f.

import { prisma } from "@/lib/prisma";

// ─── Counts (used by the tab nav badge) ─────────────────────────────────────

export async function getAdminBadgeCounts() {
  const now = new Date();
  const [pendingRequests, pendingInvitations, activeUsers] = await Promise.all([
    prisma.joinRequest.count({
      where: { status: "PENDING", expiresAt: { gt: now } },
    }),
    prisma.invitation.count({
      where: { status: "PENDING", expiresAt: { gt: now } },
    }),
    prisma.user.count({ where: { status: "ACTIVE" } }),
  ]);
  return { pendingRequests, pendingInvitations, activeUsers };
}

// ─── Requests tab ───────────────────────────────────────────────────────────

export async function listJoinRequests() {
  // Most recent first. We don't filter to PENDING here — admins want to see
  // recent rejected / expired ones too for context. The UI groups them.
  return prisma.joinRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

// ─── Users tab ──────────────────────────────────────────────────────────────

export async function listUsers() {
  return prisma.user.findMany({
    orderBy: [{ status: "asc" }, { role: "asc" }, { createdAt: "desc" }],
    include: {
      profile: {
        select: { firstName: true, lastName: true, avatarUrl: true },
      },
    },
    take: 200,
  });
}

// ─── Invitations tab ────────────────────────────────────────────────────────

export async function listInvitations() {
  return prisma.invitation.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      invitedBy: {
        select: { email: true },
      },
    },
    take: 100,
  });
}

// ─── Audit log (admin footer) ───────────────────────────────────────────────

export async function listRecentAuditLogs() {
  return prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      user: {
        select: { email: true },
      },
    },
  });
}
