// Public "request access" page — the only on-ramp for new users since Clerk
// sign-up is locked to invitations.
//
// Flow:
//   1. Visitor fills email (+ optional name / reason).
//   2. POSTs to /api/request-access (existing endpoint, Phase 3c).
//   3. Endpoint silently drops anything blocked / duplicate / already-a-user
//      and ALWAYS returns the same generic success message — we surface that
//      same message here so the page leaks no information.
//   4. Admin gets emailed; admin can later invite or reject (Phase 5e).
//
// Lives outside (authenticated) — proxy.ts whitelists `/request-access`.

"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface FieldErrors {
  email?: string;
  fullName?: string;
  reason?: string;
}

export default function RequestAccessPage() {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [genericMessage, setGenericMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    const form = e.currentTarget;
    const data = new FormData(form);

    // Honeypot: a `<input name="website">` field is rendered off-screen.
    // Real users never fill it; bots happily auto-fill any field they see.
    // If it's non-empty we lie: tell the bot we succeeded and skip the call.
    if ((data.get("website") as string)?.length) {
      setSubmitting(true);
      setTimeout(() => {
        setSubmitting(false);
        setSubmitted(true);
        setGenericMessage(
          "Thanks — if your request is approved, you'll receive an invitation email.",
        );
      }, 600);
      return;
    }

    const payload = {
      email: (data.get("email") as string)?.trim() ?? "",
      fullName: ((data.get("fullName") as string) ?? "").trim() || undefined,
      reason: ((data.get("reason") as string) ?? "").trim() || undefined,
    };

    setSubmitting(true);
    setErrors({});

    try {
      const res = await fetch("/api/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        issues?: Record<string, string[]>;
      };

      if (res.status === 400 && json.issues) {
        // Validation failed — surface field-level errors so the user can fix.
        setErrors({
          email: json.issues.email?.[0],
          fullName: json.issues.fullName?.[0],
          reason: json.issues.reason?.[0],
        });
        return;
      }

      // Treat anything else as success. The endpoint deliberately returns
      // 200 + a generic message for every non-validation outcome to prevent
      // enumeration (blocked email, already-a-user, etc.).
      setSubmitted(true);
      setGenericMessage(
        json.message ??
          "Thanks — if your request is approved, you'll receive an invitation email.",
      );
    } catch {
      // Network or unknown server error — still avoid leaking. Show generic
      // success so a noisy network can't be used as a probe.
      setSubmitted(true);
      setGenericMessage(
        "Thanks — if your request is approved, you'll receive an invitation email.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link
            href="/"
            className="font-heading text-lg font-semibold tracking-tight"
          >
            OnForm
          </Link>
        </div>

        {submitted ? (
          <SuccessCard message={genericMessage} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Request access</CardTitle>
              <p className="text-sm text-muted-foreground">
                Access is invite-only. Tell us a little about yourself and an
                admin will be in touch if approved.
              </p>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                {/* Honeypot — visually hidden from humans + screen readers,
                    but present in the DOM so naive bots fill it. */}
                <div
                  aria-hidden="true"
                  className="absolute -left-[9999px] top-0 h-0 w-0 overflow-hidden"
                  tabIndex={-1}
                >
                  <label>
                    Website
                    <input
                      type="text"
                      name="website"
                      tabIndex={-1}
                      autoComplete="off"
                    />
                  </label>
                </div>

                <Field
                  id="email"
                  label="Work email"
                  required
                  error={errors.email}
                >
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="you@company.com"
                    disabled={submitting}
                    aria-invalid={!!errors.email}
                  />
                </Field>

                <Field id="fullName" label="Full name" error={errors.fullName}>
                  <Input
                    id="fullName"
                    name="fullName"
                    type="text"
                    autoComplete="name"
                    placeholder="Jane Smith"
                    disabled={submitting}
                    aria-invalid={!!errors.fullName}
                  />
                </Field>

                <Field
                  id="reason"
                  label="Why do you need access?"
                  hint="Optional — helps the admin decide."
                  error={errors.reason}
                >
                  <Textarea
                    id="reason"
                    name="reason"
                    rows={3}
                    placeholder="e.g. I'm working with the OnForm team on the Q1 close."
                    disabled={submitting}
                    aria-invalid={!!errors.reason}
                  />
                </Field>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    "Send request"
                  )}
                </Button>

                <p className="pt-2 text-center text-xs text-muted-foreground">
                  Already have access?{" "}
                  <Link
                    href="/sign-in"
                    className="font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    Sign in
                  </Link>
                </p>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}

function Field({
  id,
  label,
  required,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="flex items-center justify-between">
        <span>
          {label}
          {required ? (
            <span className="ml-0.5 text-muted-foreground">*</span>
          ) : null}
        </span>
        {hint ? (
          <span className="text-xs font-normal text-muted-foreground">
            {hint}
          </span>
        ) : null}
      </Label>
      {children}
      {error ? (
        <p className={cn("text-xs text-rose-600 dark:text-rose-400")}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function SuccessCard({ message }: { message: string | null }) {
  return (
    <Card>
      <CardHeader className="items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <CardTitle className="mt-3">Request received</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground">
          {message ??
            "Thanks — if your request is approved, you'll receive an invitation email."}
        </p>
        <Link
          href="/sign-in"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "w-full",
          )}
        >
          Back to sign in
        </Link>
      </CardContent>
    </Card>
  );
}
