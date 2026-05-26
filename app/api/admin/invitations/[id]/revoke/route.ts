import { revokeInvitation } from "@/lib/admin/invitations";
import { requireAdminForApi } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminForApi();
  if (admin instanceof Response) return admin;
  const { id } = await ctx.params;
  const result = await revokeInvitation(id, admin);
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: result.status });
  }
  return Response.json({ ok: true });
}
