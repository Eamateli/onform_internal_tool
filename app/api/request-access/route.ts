// Public "request access" endpoint.
//
// This is the only unauthenticated write endpoint in the app. Treat it as
// hostile: validate strictly, rate-limit aggressively (Phase 7), and never
// reveal whether an email/IP is blocked, already a user, or already pending.
// All non-success outcomes return the SAME generic 200 response — a silent
// drop — to prevent enumeration attacks.

import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { notifyAdminsOfNewRequest } from "@/lib/email";
import { enforceIpRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

// 48 hour expiry, as agreed in Progress.md.
const REQUEST_EXPIRY_MS = 48 * 60 * 60 * 1000;

const RequestAccessSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  fullName: z.string().trim().min(1).max(120).optional().or(z.literal("")),
  reason: z.string().trim().max(500).optional().or(z.literal("")),
});

// Generic success response — used both for actual success and for silent
// drops (blocked email, blocked IP, duplicate, already-a-user).
const GENERIC_SUCCESS = {
  ok: true,
  message:
    "Thanks — if your request is approved, you'll receive an invitation email.",
};

export async function POST(req: Request) {
  // Tighter cap on the public write endpoint (10/min per IP).
  const limited = enforceIpRateLimit(req, 10);
  if (limited) return limited;

  // Parse + validate.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 },
    );
  }

  const parsed = RequestAccessSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        error: "Invalid input",
        issues: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const email = parsed.data.email;
  const fullName = parsed.data.fullName?.trim() || null;
  const reason = parsed.data.reason?.trim() || null;
  const ip = extractIp(req);

  try {
    // Blocklist check — both email and IP. Silent drop on hit.
    const blockHit = await prisma.block.findFirst({
      where: {
        OR: [
          { kind: "EMAIL", value: email },
          ...(ip ? [{ kind: "IP" as const, value: ip }] : []),
        ],
      },
      select: { id: true, kind: true },
    });
    if (blockHit) {
      console.warn(
        `[request-access] silent-drop: blocked by ${blockHit.kind} (${email} / ${ip ?? "no-ip"})`,
      );
      return Response.json(GENERIC_SUCCESS);
    }

    // Already a user? Don't reveal — return generic success.
    const alreadyUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (alreadyUser) {
      return Response.json(GENERIC_SUCCESS);
    }

    // Already a pending request for this email? Don't duplicate.
    const existing = await prisma.joinRequest.findFirst({
      where: {
        email,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (existing) {
      return Response.json(GENERIC_SUCCESS);
    }

    // Create the request and notify admins (best-effort, never fail the request).
    const now = new Date();
    const created = await prisma.joinRequest.create({
      data: {
        email,
        fullName,
        reason,
        ipAddress: ip,
        status: "PENDING",
        expiresAt: new Date(now.getTime() + REQUEST_EXPIRY_MS),
      },
    });

    // Audit log — anonymous action, userId stays null.
    await prisma.auditLog.create({
      data: {
        userId: null,
        action: "request.created",
        resourceType: "JoinRequest",
        resourceId: created.id,
        metadata: { email, ip, hasReason: !!reason },
      },
    });

    // Fire-and-forget admin notification. Resolved promise is awaited so
    // serverless functions don't terminate before it sends, but failures
    // inside `notifyAdminsOfNewRequest` are already swallowed there.
    await notifyAdminsOfNewRequest({ email, fullName, reason });

    return Response.json(GENERIC_SUCCESS);
  } catch (err) {
    console.error("[request-access] unexpected error:", err);
    // Even on internal errors, return generic 200 so we don't reveal
    // whether the email collided with anything. Log loudly server-side.
    return Response.json(GENERIC_SUCCESS);
  }
}

// Pull the first plausible client IP out of the proxy headers.
// `x-forwarded-for` is `client, proxy1, proxy2, …` — the leftmost is the
// real client. We trust whatever Vercel/Cloudflare set; locally this will
// usually be `::1` or `127.0.0.1`.
function extractIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip") ?? null;
}
