// Admin actions on User rows — promote, demote, block, unblock, remove.

import { clerkClient } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";

type ActionResult =
  | { ok: true }
  | { ok: false; error: string; status: number };

async function loadUser(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

async function countActiveAdmins(excludeId?: string): Promise<number> {
  return prisma.user.count({
    where: {
      role: "ADMIN",
      status: "ACTIVE",
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
}

function cannotSelf(admin: User, targetId: string): ActionResult | null {
  if (admin.id === targetId) {
    return { ok: false, error: "You cannot perform this action on yourself", status: 409 };
  }
  return null;
}

async function guardLastAdmin(target: User): Promise<ActionResult | null> {
  if (target.role !== "ADMIN") return null;
  const others = await countActiveAdmins(target.id);
  if (others === 0) {
    return {
      ok: false,
      error: "Cannot modify the last active admin",
      status: 409,
    };
  }
  return null;
}

export async function promoteUser(
  userId: string,
  admin: User,
): Promise<ActionResult> {
  const target = await loadUser(userId);
  if (!target) return { ok: false, error: "User not found", status: 404 };
  if (target.status !== "ACTIVE") {
    return { ok: false, error: "User is not active", status: 409 };
  }
  if (target.role === "ADMIN") {
    return { ok: false, error: "User is already an admin", status: 409 };
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: target.id },
      data: { role: "ADMIN" },
    });
    await tx.auditLog.create({
      data: {
        userId: admin.id,
        action: "user.promoted",
        resourceType: "User",
        resourceId: target.id,
        metadata: { email: target.email, from: "USER", to: "ADMIN" },
      },
    });
  });

  return { ok: true };
}

export async function demoteUser(
  userId: string,
  admin: User,
): Promise<ActionResult> {
  const self = cannotSelf(admin, userId);
  if (self) return self;

  const target = await loadUser(userId);
  if (!target) return { ok: false, error: "User not found", status: 404 };
  if (target.role !== "ADMIN") {
    return { ok: false, error: "User is not an admin", status: 409 };
  }

  const last = await guardLastAdmin(target);
  if (last) return last;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: target.id },
      data: { role: "USER" },
    });
    await tx.auditLog.create({
      data: {
        userId: admin.id,
        action: "user.demoted",
        resourceType: "User",
        resourceId: target.id,
        metadata: { email: target.email, from: "ADMIN", to: "USER" },
      },
    });
  });

  return { ok: true };
}

export async function blockUser(
  userId: string,
  admin: User,
): Promise<ActionResult> {
  const self = cannotSelf(admin, userId);
  if (self) return self;

  const target = await loadUser(userId);
  if (!target) return { ok: false, error: "User not found", status: 404 };
  if (target.status === "BLOCKED") {
    return { ok: false, error: "User is already blocked", status: 409 };
  }

  const last = await guardLastAdmin(target);
  if (last) return last;

  await prisma.$transaction(async (tx) => {
    await tx.block.upsert({
      where: { kind_value: { kind: "EMAIL", value: target.email } },
      create: {
        kind: "EMAIL",
        value: target.email,
        reason: "Blocked by admin",
        blockedById: admin.id,
      },
      update: {
        reason: "Blocked by admin",
        blockedById: admin.id,
      },
    });
    await tx.user.update({
      where: { id: target.id },
      data: { status: "BLOCKED" },
    });
    await tx.auditLog.create({
      data: {
        userId: admin.id,
        action: "user.blocked",
        resourceType: "User",
        resourceId: target.id,
        metadata: { email: target.email },
      },
    });
  });

  try {
    const clerk = await clerkClient();
    await clerk.users.banUser(target.clerkId);
  } catch (err) {
    console.error("[admin] Clerk banUser failed:", err);
  }

  return { ok: true };
}

export async function unblockUser(
  userId: string,
  admin: User,
): Promise<ActionResult> {
  const target = await loadUser(userId);
  if (!target) return { ok: false, error: "User not found", status: 404 };
  if (target.status !== "BLOCKED") {
    return { ok: false, error: "User is not blocked", status: 409 };
  }

  await prisma.$transaction(async (tx) => {
    await tx.block.deleteMany({
      where: { kind: "EMAIL", value: target.email },
    });
    await tx.user.update({
      where: { id: target.id },
      data: { status: "ACTIVE" },
    });
    await tx.auditLog.create({
      data: {
        userId: admin.id,
        action: "user.unblocked",
        resourceType: "User",
        resourceId: target.id,
        metadata: { email: target.email },
      },
    });
  });

  try {
    const clerk = await clerkClient();
    await clerk.users.unbanUser(target.clerkId);
  } catch (err) {
    console.error("[admin] Clerk unbanUser failed:", err);
  }

  return { ok: true };
}

export async function removeUser(
  userId: string,
  admin: User,
): Promise<ActionResult> {
  const self = cannotSelf(admin, userId);
  if (self) return self;

  const target = await loadUser(userId);
  if (!target) return { ok: false, error: "User not found", status: 404 };

  const last = await guardLastAdmin(target);
  if (last) return last;

  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: "user.removed_by_admin",
      resourceType: "User",
      resourceId: target.id,
      metadata: { email: target.email, role: target.role },
    },
  });

  try {
    const clerk = await clerkClient();
    await clerk.users.deleteUser(target.clerkId);
  } catch (err) {
    console.error("[admin] Clerk deleteUser failed:", err);
    return {
      ok: false,
      error: "Failed to remove user from Clerk — try again",
      status: 502,
    };
  }

  // Webhook usually deletes the row; delete locally too for immediate UI.
  await prisma.user.delete({ where: { id: target.id } }).catch(() => null);

  return { ok: true };
}
