import { z } from "zod";

import { inviteJoinRequest } from "@/lib/admin/join-requests";
import { parseJsonBody } from "@/lib/api/body";
import { requireAdminForApi } from "@/lib/auth";

export const runtime = "nodejs";

const InviteSchema = z.object({
  role: z.enum(["USER", "ADMIN"]).default("USER"),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminForApi();
  if (admin instanceof Response) return admin;

  const { id } = await ctx.params;

  const parsed = await parseJsonBody(req, InviteSchema);
  if (!parsed.ok) return parsed.response;

  const result = await inviteJoinRequest(id, admin, parsed.data.role);
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: result.status });
  }
  return Response.json({ ok: true });
}
