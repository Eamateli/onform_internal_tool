// Admin actions on Invitation rows — resend, revoke.

import { randomBytes } from "crypto";

import { prisma } from "@/lib/prisma";
import { sendInvitationEmail } from "@/lib/email";
import type { User } from "@prisma/client";

import {
  createClerkInvitation,
  revokeClerkInvitationsForEmail,
} from "@/lib/admin/clerk-invitations";

const INVITATION_TTL_MS = 48 * 60 * 60 * 1000;

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

type ActionResult =
  | { ok: true }
  | { ok: false; error: string; status: number };

export async function revokeInvitation(
  invitationId: string,
  admin: User,
): Promise<ActionResult> {
  const inv = await prisma.invitation.findUnique({ where: { id: invitationId } });
  if (!inv) return { ok: false, error: "Invitation not found", status: 404 };
  if (inv.status !== "PENDING") {
    return { ok: false, error: "Invitation is no longer pending", status: 409 };
  }

  await revokeClerkInvitationsForEmail(inv.email);

  await prisma.$transaction(async (tx) => {
    await tx.invitation.update({
      where: { id: inv.id },
      data: { status: "REVOKED" },
    });
    await tx.auditLog.create({
      data: {
        userId: admin.id,
        action: "invitation.revoked",
        resourceType: "Invitation",
        resourceId: inv.id,
        metadata: { email: inv.email },
      },
    });
  });

  return { ok: true };
}

export async function resendInvitation(
  invitationId: string,
  admin: User,
): Promise<ActionResult> {
  const inv = await prisma.invitation.findUnique({ where: { id: invitationId } });
  if (!inv) return { ok: false, error: "Invitation not found", status: 404 };
  if (inv.status !== "PENDING") {
    return {
      ok: false,
      error: "Only pending invitations can be resent",
      status: 409,
    };
  }

  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
  const token = randomBytes(32).toString("hex");

  await revokeClerkInvitationsForEmail(inv.email);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.invitation.update({
      where: { id: inv.id },
      data: { status: "REVOKED" },
    });

    const fresh = await tx.invitation.create({
      data: {
        email: inv.email,
        role: inv.role,
        token,
        status: "PENDING",
        invitedById: admin.id,
        expiresAt,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: admin.id,
        action: "invitation.resent",
        resourceType: "Invitation",
        resourceId: fresh.id,
        metadata: {
          email: inv.email,
          previousInvitationId: inv.id,
        },
      },
    });

    return fresh;
  });

  try {
    await createClerkInvitation(inv.email);
  } catch (err) {
    console.error("[admin] Clerk createInvitation on resend failed:", err);
    await prisma.invitation.update({
      where: { id: updated.id },
      data: { status: "REVOKED" },
    });
    return {
      ok: false,
      error: "Failed to send Clerk invitation — try again",
      status: 502,
    };
  }

  await sendInvitationEmail({
    email: inv.email,
    role: inv.role,
    signUpUrl: `${appUrl()}/sign-up`,
    expiresAt,
  });

  return { ok: true };
}
