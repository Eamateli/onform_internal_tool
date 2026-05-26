// Auth helpers that bridge Clerk's session with our Postgres `User` table.
//
// Two surfaces:
//   • getOrCreateUserFromClerk() — idempotent "make sure this Clerk user has
//     a User row" routine. Called from the dashboard layout and the webhook.
//     Implements the founding-admin bypass: if the user's email matches
//     FOUNDING_ADMIN_EMAIL and no User row exists, they're created as ADMIN.
//     Everyone else without a matching accepted Invitation is NOT created
//     here (the only legitimate path is the webhook's invitation-aware flow).
//   • requireAdmin() — used in admin API routes / pages to 401/redirect
//     non-admins. Trusts the Clerk session, then re-checks the DB role.

import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { Prisma, type User } from "@/lib/generated/prisma/client";

const FOUNDING_ADMIN_EMAIL = process.env.FOUNDING_ADMIN_EMAIL?.toLowerCase();

// Derive Clerk's user type from currentUser()'s return type to avoid relying
// on an explicit type export that varies across Clerk versions.
type ClerkUser = NonNullable<Awaited<ReturnType<typeof currentUser>>>;

function primaryEmail(clerkUser: ClerkUser): string | null {
  return clerkUser.primaryEmailAddress?.emailAddress?.toLowerCase() ?? null;
}

/**
 * Ensure the currently signed-in Clerk user has a matching `User` row.
 *
 * Returns the DB user, or `null` if there is no signed-in user.
 *
 * Behavior:
 *   1. Look up by `clerkId`. If found → return it (with role/status).
 *   2. If not found, look up by `email`. If found (race condition: webhook
 *      created the row with the email but clerkId might still be empty in
 *      legacy data) → patch in `clerkId` and return.
 *   3. If still nothing and the email matches `FOUNDING_ADMIN_EMAIL` →
 *      create as ADMIN (bootstrap).
 *   4. Otherwise: do NOT create. Return null. Caller decides what to do
 *      (in practice: middleware will already have blocked, or the user
 *      lands on an "awaiting setup" screen).
 */
export async function getOrCreateUserFromClerk(): Promise<User | null> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;

  // Fast path: row already exists for this clerkId.
  const existing = await prisma.user.findUnique({ where: { clerkId } });
  if (existing) return existing;

  const clerkUser = await currentUser();
  if (!clerkUser) return null;
  const email = primaryEmail(clerkUser);
  if (!email) return null;

  // Webhook may have created a User row by email but without clerkId attached
  // (e.g. legacy data, manual seed). Patch clerkId in.
  const byEmail = await prisma.user.findUnique({ where: { email } });
  if (byEmail) {
    return prisma.user.update({
      where: { id: byEmail.id },
      data: { clerkId },
    });
  }

  // Founding-admin bypass — only fires when the env var matches AND there's
  // no existing User row. After the first admin exists, this path is a no-op.
  // Mirrors the webhook's user.created shape (User + Profile + AuditLog in
  // a single transaction) so downstream code doesn't care which path created
  // the row.
  //
  // Concurrency note: in dev, React can fire several server-component renders
  // in parallel, all racing to insert this row. We rely on the DB's unique
  // constraint on `clerkId` as the source of truth and catch P2002 to turn
  // a "lost the race" into a quiet re-fetch.
  if (FOUNDING_ADMIN_EMAIL && email === FOUNDING_ADMIN_EMAIL) {
    try {
      return await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            clerkId,
            email,
            role: "ADMIN",
            status: "ACTIVE",
            profile: {
              create: {
                firstName: clerkUser.firstName ?? null,
                lastName: clerkUser.lastName ?? null,
                avatarUrl: clerkUser.imageUrl ?? null,
              },
            },
          },
        });

        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: "user.bootstrap_founding_admin",
            resourceType: "User",
            resourceId: user.id,
            metadata: { email, role: "ADMIN", via: "lazy_dashboard_load" },
          },
        });

        return user;
      });
    } catch (err) {
      // P2002 = unique constraint violation. Another concurrent request won
      // the create race; just re-fetch what they wrote.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        const row = await prisma.user.findUnique({ where: { clerkId } });
        if (row) return row;
      }
      throw err;
    }
  }

  // Anyone else who somehow has a Clerk session but no Invitation / no DB row
  // is NOT auto-created. Return null and let the caller decide.
  return null;
}

/**
 * Require the current request to be authenticated AND have role: ADMIN.
 * Use in server components and Route Handlers for admin-only paths.
 *
 *   const user = await requireAdmin();  // throws/redirects if not admin
 */
export async function requireAdmin(): Promise<User> {
  const user = await getOrCreateUserFromClerk();
  if (!user) {
    redirect("/sign-in");
  }
  if (user.status !== "ACTIVE") {
    // Blocked users should not even reach admin paths.
    redirect("/sign-in");
  }
  if (user.role !== "ADMIN") {
    redirect("/dashboard");
  }
  return user;
}
