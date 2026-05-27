import { demoteUser } from "@/lib/admin/users";
import { EmptyBodySchema, parseJsonBody } from "@/lib/api/body";
import { requireAdminForApi } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminForApi();
  if (admin instanceof Response) return admin;

  const body = await parseJsonBody(req, EmptyBodySchema);
  if (!body.ok) return body.response;

  const { id } = await ctx.params;
  const result = await demoteUser(id, admin);
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: result.status });
  }
  return Response.json({ ok: true });
}
