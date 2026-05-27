// GET /api/clients/[clientId]/export/excel
// Downloads a three-sheet Excel workbook: Summary, Transactions, Budget vs Actual.

import {
  auditClientExport,
  getClientExportData,
  sanitizeFilename,
} from "@/lib/data/client-export";
import { authorizeClientExport, parseClientId } from "@/lib/exports/auth";
import { buildClientExcel } from "@/lib/exports/excel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ clientId: string }> },
) {
  const user = await authorizeClientExport();
  if (user instanceof Response) return user;

  const { clientId: rawId } = await ctx.params;
  const clientId = parseClientId(rawId);
  if (!clientId) {
    return Response.json({ ok: false, error: "Invalid client id" }, { status: 400 });
  }

  try {
    const data = await getClientExportData(clientId, user);
    if (!data) {
      return Response.json({ ok: false, error: "Client not found" }, { status: 404 });
    }

    const buffer = await buildClientExcel(data);
    await auditClientExport(user, data.client, "excel");

    const slug = sanitizeFilename(data.client.client_name);
    const filename = `${slug || clientId}-report.xlsx`;

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[api/clients/export/excel] failed:", err);
    return Response.json(
      { ok: false, error: "Failed to generate export" },
      { status: 500 },
    );
  }
}
