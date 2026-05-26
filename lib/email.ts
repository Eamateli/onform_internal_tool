// Thin Resend wrapper + project-specific notification helpers.
//
// Design choices:
//   • Best-effort: email failures are logged but never throw. We don't want a
//     Resend outage to block a JoinRequest from being saved.
//   • If RESEND_API_KEY is missing or still the placeholder, we no-op with a
//     console warning. This lets us run the rest of the app locally before
//     Resend is configured.
//   • Resend's free tier sends from `onboarding@resend.dev` until a real
//     domain is verified. That's the default `FROM` for now.

import { Resend } from "resend";
import { prisma } from "@/lib/prisma";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_CONFIGURED =
  !!RESEND_API_KEY && !RESEND_API_KEY.includes("replace_me");

const DEFAULT_FROM = "OnForm <onboarding@resend.dev>";

// Lazy-create the client so we don't crash on import when the key is absent.
let resendClient: Resend | null = null;
function getResend(): Resend | null {
  if (!RESEND_CONFIGURED) return null;
  if (!resendClient) resendClient = new Resend(RESEND_API_KEY);
  return resendClient;
}

export async function sendEmail(args: {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const client = getResend();
  if (!client) {
    console.warn(
      `[email] Resend not configured — skipping email to ${
        Array.isArray(args.to) ? args.to.join(", ") : args.to
      }`,
    );
    return { ok: false, error: "Resend not configured" };
  }

  try {
    const { error } = await client.emails.send({
      from: args.from ?? DEFAULT_FROM,
      to: args.to,
      subject: args.subject,
      html: args.html,
    });
    if (error) {
      console.error("[email] Resend returned error:", error);
      return { ok: false, error: String(error) };
    }
    return { ok: true };
  } catch (err) {
    console.error("[email] Resend threw:", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// Looks up every ADMIN user and emails them about a new join request.
// Called best-effort from /api/request-access. Failure here MUST NOT block
// the request from being saved.
export async function notifyAdminsOfNewRequest(req: {
  email: string;
  fullName?: string | null;
  reason?: string | null;
}): Promise<void> {
  let admins: { email: string }[] = [];
  try {
    admins = await prisma.user.findMany({
      where: { role: "ADMIN", status: "ACTIVE" },
      select: { email: true },
    });
  } catch (err) {
    console.error("[email] Failed to look up admins:", err);
    return;
  }

  if (admins.length === 0) {
    console.warn("[email] No active admins to notify of new request.");
    return;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const subject = `New access request — ${req.email}`;
  const html = `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px;">
      <h2 style="margin: 0 0 16px; font-size: 18px;">New OnForm access request</h2>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr><td style="padding: 6px 0; color: #6b7280;">Email</td><td style="padding: 6px 0;"><strong>${escapeHtml(req.email)}</strong></td></tr>
        ${req.fullName ? `<tr><td style="padding: 6px 0; color: #6b7280;">Name</td><td style="padding: 6px 0;">${escapeHtml(req.fullName)}</td></tr>` : ""}
        ${req.reason ? `<tr><td style="padding: 6px 0; color: #6b7280; vertical-align: top;">Reason</td><td style="padding: 6px 0;">${escapeHtml(req.reason)}</td></tr>` : ""}
      </table>
      <p style="margin: 24px 0 0;">
        <a href="${appUrl}/admin/requests" style="background: #111827; color: white; padding: 10px 16px; border-radius: 8px; text-decoration: none; font-size: 14px;">Review request →</a>
      </p>
      <p style="margin: 24px 0 0; font-size: 12px; color: #9ca3af;">You're receiving this because you're an admin on OnForm Internal Tool.</p>
    </div>
  `;

  // Send one email per admin (small N — no need to batch).
  await Promise.all(
    admins.map((admin) =>
      sendEmail({ to: admin.email, subject, html }).catch((err) => {
        console.error(`[email] Failed sending to ${admin.email}:`, err);
      }),
    ),
  );
}

// Minimal HTML escaper — defence-in-depth against XSS through email content
// (admin name/email/reason are user-supplied).
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
