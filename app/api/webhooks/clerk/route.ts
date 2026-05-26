// Clerk webhook handler — keeps our Postgres `User` table in sync with Clerk.
//
// This route is PUBLIC at the network level (it's exempted in proxy.ts) but
// every request is cryptographically verified via Clerk's `verifyWebhook`,
// which checks the Svix signature against CLERK_WEBHOOK_SIGNING_SECRET.
//
// Events we handle:
//   • user.created  — someone just finished Clerk sign-up. Find the matching
//     PENDING Invitation (created by an admin) and provision a User row with
//     the role that invitation specified. Founding-admin bypass applies when
//     no invitation exists and the email matches FOUNDING_ADMIN_EMAIL.
//   • user.deleted  — admin removed the Clerk user. Drop our DB row to match.
//
// Anything we don't recognise we ack with 200 (Clerk re-delivers on non-2xx;
// we don't want infinite retries for events we just don't care about).

import { verifyWebhook } from "@clerk/backend/webhooks";
import type { UserJSON, UserDeletedJSON } from "@clerk/backend";

import { prisma } from "@/lib/prisma";

// Force the Node runtime — Prisma's query engine can't run on edge.
export const runtime = "nodejs";

const FOUNDING_ADMIN_EMAIL =
  process.env.FOUNDING_ADMIN_EMAIL?.toLowerCase() ?? null;

export async function POST(req: Request) {
  let evt: Awaited<ReturnType<typeof verifyWebhook>>;
  try {
    evt = await verifyWebhook(req);
  } catch (err) {
    console.error("[webhook:clerk] signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    switch (evt.type) {
      case "user.created":
        await handleUserCreated(evt.data);
        break;
      case "user.deleted":
        await handleUserDeleted(evt.data);
        break;
      default:
        // Quietly ack any other event (session.created, organization.*, etc.).
        break;
    }
    return Response.json({ ok: true });
  } catch (err) {
    console.error(`[webhook:clerk] ${evt.type} handler crashed:`, err);
    // 500 → Clerk will retry. Good for transient DB blips, bad for poison
    // events. We log loudly so we can decide whether to clean up by hand.
    return new Response("Handler error", { status: 500 });
  }
}

async function handleUserCreated(data: UserJSON) {
  const clerkId = data.id;
  const email = data.email_addresses
    ?.find((e) => e.id === data.primary_email_address_id)
    ?.email_address.toLowerCase();

  if (!email) {
    console.error("[webhook:clerk] user.created with no primary email", { clerkId });
    return;
  }

  // Idempotency: if a row already exists for this Clerk user, do nothing.
  const existing = await prisma.user.findUnique({ where: { clerkId } });
  if (existing) return;

  // Find a matching invitation. Order by createdAt desc so the most recent
  // invitation wins if (somehow) there are duplicates.
  const invitation = await prisma.invitation.findFirst({
    where: {
      email: { equals: email, mode: "insensitive" },
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  const isFoundingAdmin =
    FOUNDING_ADMIN_EMAIL !== null && email === FOUNDING_ADMIN_EMAIL;

  if (!invitation && !isFoundingAdmin) {
    // In Restricted mode this should be impossible — Clerk won't let anyone
    // sign up without an invitation. Log it so we know if our gate slipped.
    console.error(
      "[webhook:clerk] user.created with no matching invitation + not founding admin",
      { clerkId, email },
    );
    return;
  }

  const role = invitation?.role ?? "ADMIN"; // founding admin path
  const firstName = data.first_name ?? null;
  const lastName = data.last_name ?? null;
  const avatarUrl = data.image_url ?? null;

  // Wrap in a transaction so the User + Profile + Invitation + AuditLog
  // either all land together or none of them do.
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        clerkId,
        email,
        role,
        status: "ACTIVE",
        profile: {
          create: { firstName, lastName, avatarUrl },
        },
      },
    });

    if (invitation) {
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      });
      // Any JoinRequest tied to this email gets resolved too.
      await tx.joinRequest.updateMany({
        where: { email, status: { in: ["PENDING", "INVITED"] } },
        data: { status: "INVITED", decidedAt: new Date(), decidedById: invitation.invitedById },
      });
    }

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: isFoundingAdmin ? "user.bootstrap_founding_admin" : "user.created_from_invitation",
        resourceType: "User",
        resourceId: user.id,
        metadata: {
          email,
          role,
          invitationId: invitation?.id ?? null,
        },
      },
    });
  });

  console.log(`[webhook:clerk] User provisioned: ${email} (${role})`);
}

async function handleUserDeleted(data: UserDeletedJSON) {
  const clerkId = data.id;
  if (!clerkId) return;

  const existing = await prisma.user.findUnique({ where: { clerkId } });
  if (!existing) return;

  await prisma.$transaction(async (tx) => {
    await tx.user.delete({ where: { id: existing.id } });
    await tx.auditLog.create({
      data: {
        userId: null, // user is gone — keep the audit row but no FK
        action: "user.deleted_from_clerk",
        resourceType: "User",
        resourceId: existing.id,
        metadata: { email: existing.email, role: existing.role },
      },
    });
  });

  console.log(`[webhook:clerk] User removed: ${existing.email}`);
}
