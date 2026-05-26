import { z } from "zod";

import { blockJoinRequest } from "@/lib/admin/join-requests";
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

  let body: unknown = {};
  try {
    const text = await req.text();
    if (text) body = JSON.parse(text);
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BlockSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const result = await blockJoinRequest(id, admin, parsed.data.reason);
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: result.status });
  }
  return Response.json({ ok: true });
}
