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

import { cache } from "react";

import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { enforceUserRateLimit } from "@/lib/rate-limit";
import { Prisma, type Profile, type User } from "@prisma/client";

const FOUNDING_ADMIN_EMAIL = process.env.FOUNDING_ADMIN_EMAIL?.toLowerCase();

/** User row plus optional Profile — returned by getOrCreateUserFromClerk. */
export type AppUser = User & { profile: Profile | null };

// Derive Clerk's user type from currentUser()'s return type to avoid relying
// on an explicit type export that varies across Clerk versions.
type ClerkUser = NonNullable<Awaited<ReturnType<typeof currentUser>>>;

function primaryEmail(clerkUser: ClerkUser): string | null {
  return clerkUser.primaryEmailAddress?.emailAddress?.toLowerCase() ?? null;
}

const userWithProfile = { include: { profile: true } as const };

/**
 * Ensure the currently signed-in Clerk user has a matching `User` row.
 *
 * Returns the DB user (with profile), or `null` if there is no signed-in user.
 *
 * Avoid calling `currentUser()` in page components — this helper hits Clerk's
 * backend API only on the slow path (no DB row yet). The fast path is a
 * single Prisma read.
 */
export const getOrCreateUserFromClerk = cache(async (): Promise<AppUser | null> => {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;

  // Fast path: row already exists for this clerkId.
  const existing = await prisma.user.findUnique({
    where: { clerkId },
    ...userWithProfile,
  });
  if (existing) return existing;

  const clerkUser = await currentUser();
  if (!clerkUser) return null;
  const email = primaryEmail(clerkUser);
  if (!email) return null;

  // Webhook may have created a User row by email but without clerkId attached
  // (e.g. legacy data, manual seed). Patch clerkId in.
  const byEmail = await prisma.user.findUnique({
    where: { email },
    ...userWithProfile,
  });
  if (byEmail) {
    return prisma.user.update({
      where: { id: byEmail.id },
      data: { clerkId },
      ...userWithProfile,
    });
  }

  // Founding-admin bypass — only fires when the env var matches AND there's
  // no existing User row. After the first admin exists, this path is a no-op.
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
          ...userWithProfile,
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
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        const row = await prisma.user.findUnique({
          where: { clerkId },
          ...userWithProfile,
        });
        if (row) return row;
      }
      throw err;
    }
  }

  return null;
});

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

/**
 * Same gate as `requireAdmin()` but for Route Handlers — returns JSON errors
 * instead of redirecting (redirects are wrong for fetch() callers).
 */
export async function requireAdminForApi(): Promise<
  User | Response
> {
  const user = await getOrCreateUserFromClerk();
  if (!user) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (user.status !== "ACTIVE") {
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  if (user.role !== "ADMIN") {
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  const limited = enforceUserRateLimit(user.id);
  if (limited) return limited;
  return user;
}
