// Admin actions on JoinRequest rows — invite, reject, block.
//
// Called only from authenticated admin API routes. Each action writes an
// AuditLog row inside the same transaction as the state change.

import { randomBytes } from "crypto";

import { clerkClient } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";
import { sendInvitationEmail } from "@/lib/email";
import type { Role, User } from "@prisma/client";

const INVITATION_TTL_MS = 48 * 60 * 60 * 1000;

function opaqueToken(): string {
  return randomBytes(32).toString("hex");
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

type LoadError = "not_found" | "not_pending" | "expired";

const LOAD_ERROR_RESPONSE: Record<
  LoadError,
  { error: string; status: number }
> = {
  not_found: { error: "Request not found", status: 404 },
  not_pending: { error: "Request is no longer pending", status: 409 },
  expired: { error: "Request has expired", status: 409 },
};

type ActionableRequest =
  | { req: NonNullable<Awaited<ReturnType<typeof prisma.joinRequest.findUnique>>> }
  | { error: LoadError };

async function loadActionableRequest(id: string): Promise<ActionableRequest> {
  const req = await prisma.joinRequest.findUnique({ where: { id } });
  if (!req) return { error: "not_found" };
  if (req.status !== "PENDING") return { error: "not_pending" };
  if (req.expiresAt < new Date()) return { error: "expired" };
  return { req };
}

function failLoad(error: LoadError) {
  return { ok: false as const, ...LOAD_ERROR_RESPONSE[error] };
}

export async function inviteJoinRequest(
  requestId: string,
  admin: User,
  role: Role = "USER",
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const loaded = await loadActionableRequest(requestId);
  if ("error" in loaded) {
    return failLoad(loaded.error);
  }
  const { req } = loaded;

  const existingUser = await prisma.user.findUnique({
    where: { email: req.email },
    select: { id: true },
  });
  if (existingUser) {
    return { ok: false, error: "A user with this email already exists", status: 409 };
  }

  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
  const token = opaqueToken();

  const invitation = await prisma.$transaction(async (tx) => {
    // Revoke any stale pending invitation for this email so the webhook
    // always picks up the fresh one.
    await tx.invitation.updateMany({
      where: { email: req.email, status: "PENDING" },
      data: { status: "REVOKED" },
    });

    const inv = await tx.invitation.create({
      data: {
        email: req.email,
        role,
        token,
        status: "PENDING",
        invitedById: admin.id,
        expiresAt,
      },
    });

    await tx.joinRequest.update({
      where: { id: req.id },
      data: {
        status: "INVITED",
        decidedAt: new Date(),
        decidedById: admin.id,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: admin.id,
        action: "request.invited",
        resourceType: "JoinRequest",
        resourceId: req.id,
        metadata: {
          email: req.email,
          role,
          invitationId: inv.id,
        },
      },
    });

    return inv;
  });

  // Clerk Restricted mode — must allow this email to complete sign-up.
  try {
    const clerk = await clerkClient();
    await clerk.invitations.createInvitation({
      emailAddress: req.email,
      redirectUrl: `${appUrl()}/sign-up`,
      expiresInDays: 2,
    });
  } catch (err) {
    console.error("[admin] Clerk createInvitation failed:", err);
    // Roll back our invitation so admin can retry cleanly.
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: "REVOKED" },
    });
    await prisma.joinRequest.update({
      where: { id: req.id },
      data: { status: "PENDING", decidedAt: null, decidedById: null },
    });
    return {
      ok: false,
      error: "Failed to send Clerk invitation — try again",
      status: 502,
    };
  }

  // Branded email (best-effort — Clerk also emails in Restricted mode).
  await sendInvitationEmail({
    email: req.email,
    role,
    signUpUrl: `${appUrl()}/sign-up`,
    expiresAt,
  });

  return { ok: true };
}

export async function rejectJoinRequest(
  requestId: string,
  admin: User,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const loaded = await loadActionableRequest(requestId);
  if ("error" in loaded) {
    return failLoad(loaded.error);
  }
  const { req } = loaded;

  await prisma.$transaction(async (tx) => {
    await tx.joinRequest.update({
      where: { id: req.id },
      data: {
        status: "REJECTED",
        decidedAt: new Date(),
        decidedById: admin.id,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: admin.id,
        action: "request.rejected",
        resourceType: "JoinRequest",
        resourceId: req.id,
        metadata: { email: req.email },
      },
    });
  });

  return { ok: true };
}

export async function blockJoinRequest(
  requestId: string,
  admin: User,
  reason?: string,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const loaded = await loadActionableRequest(requestId);
  if ("error" in loaded) {
    return failLoad(loaded.error);
  }
  const { req } = loaded;

  const blockReason = reason?.trim() || "Blocked from access request review";

  await prisma.$transaction(async (tx) => {
    await tx.block.upsert({
      where: { kind_value: { kind: "EMAIL", value: req.email } },
      create: {
        kind: "EMAIL",
        value: req.email,
        reason: blockReason,
        blockedById: admin.id,
      },
      update: { reason: blockReason, blockedById: admin.id },
    });

    if (req.ipAddress) {
      await tx.block.upsert({
        where: { kind_value: { kind: "IP", value: req.ipAddress } },
        create: {
          kind: "IP",
          value: req.ipAddress,
          reason: blockReason,
          blockedById: admin.id,
        },
        update: { reason: blockReason, blockedById: admin.id },
      });
    }

    await tx.joinRequest.update({
      where: { id: req.id },
      data: {
        status: "BLOCKED",
        decidedAt: new Date(),
        decidedById: admin.id,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: admin.id,
        action: "request.blocked",
        resourceType: "JoinRequest",
        resourceId: req.id,
        metadata: {
          email: req.email,
          ip: req.ipAddress,
          reason: blockReason,
        },
      },
    });
  });

  return { ok: true };
}
