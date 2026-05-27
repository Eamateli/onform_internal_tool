// Shared auth + param validation for client export routes.

import { getOrCreateUserFromClerk } from "@/lib/auth";
import { enforceUserRateLimit } from "@/lib/rate-limit";
import type { User } from "@prisma/client";

export async function authorizeClientExport(): Promise<User | Response> {
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
  const limited = enforceUserRateLimit(user.id);
  if (limited) return limited;
  return user;
}

export function parseClientId(raw: string): string | null {
  if (!/^[\w-]{1,64}$/.test(raw)) return null;
  return raw;
}
