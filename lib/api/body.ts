// Shared JSON body parsing + Zod validation for API routes.

import { z } from "zod";

/** POST routes that accept an empty JSON object `{}`. */
export const EmptyBodySchema = z.object({}).strict();

export async function parseJsonBody<T>(
  req: Request,
  schema: z.ZodType<T>,
): Promise<
  { ok: true; data: T } | { ok: false; response: Response }
> {
  let body: unknown = {};
  try {
    const text = await req.text();
    if (text) body = JSON.parse(text);
  } catch {
    return {
      ok: false,
      response: Response.json(
        { ok: false, error: "Invalid JSON" },
        { status: 400 },
      ),
    };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      response: Response.json(
        {
          ok: false,
          error: "Invalid input",
          issues: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      ),
    };
  }

  return { ok: true, data: parsed.data };
}
