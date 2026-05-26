// Shared Clerk invitation helpers for admin flows.

import { clerkClient } from "@clerk/nextjs/server";

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

/** Revoke every pending Clerk invitation for an email address. */
export async function revokeClerkInvitationsForEmail(
  email: string,
): Promise<void> {
  const clerk = await clerkClient();
  const { data } = await clerk.invitations.getInvitationList({
    query: email,
    status: "pending",
  });
  await Promise.all(
    data.map((inv) => clerk.invitations.revokeInvitation(inv.id)),
  );
}

/** Create a Clerk invitation (Restricted mode allow-list). */
export async function createClerkInvitation(email: string): Promise<void> {
  const clerk = await clerkClient();
  await clerk.invitations.createInvitation({
    emailAddress: email,
    redirectUrl: `${appUrl()}/sign-up`,
    expiresInDays: 2,
    ignoreExisting: true,
  });
}
