import { z } from "zod";

import { blockJoinRequest } from "@/lib/admin/join-requests";
import { parseJsonBody } from "@/lib/api/body";
import { requireAdminForApi } from "@/lib/auth";

export const runtime = "nodejs";

const BlockSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminForApi();
  if (admin instanceof Response) return admin;

  const { id } = await ctx.params;

  const parsed = await parseJsonBody(req, BlockSchema);
  if (!parsed.ok) return parsed.response;

  const result = await blockJoinRequest(id, admin, parsed.data.reason);
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: result.status });
  }
  return Response.json({ ok: true });
}
