import Link from "next/link";
import { SignIn } from "@clerk/nextjs";

import { clerkAppearance } from "@/lib/clerk-appearance";

// The folder name `[[...sign-in]]` is a Next.js *optional catch-all* segment.
// Clerk's hosted flow may push the user to sub-paths like
// `/sign-in/factor-one`, `/sign-in/sso-callback`, etc. — this single page
// handles all of them so we never hit a 404 mid-flow.
export default function SignInPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center p-6">
      {/* Outer shell = one card. Clerk's inner card is borderless inside it.
          Restricted mode hides Clerk's built-in "Sign up" footer, so we add our own. */}
      <div className="w-full max-w-[25rem] overflow-hidden rounded-xl border bg-card shadow-sm">
        <SignIn
          appearance={{
            ...clerkAppearance,
            elements: {
              ...clerkAppearance.elements,
              footerAction: { display: "none" },
              rootBox: { width: "100%" },
              card: {
                width: "100%",
                boxShadow: "none",
                border: "none",
                borderRadius: "0",
              },
            },
          }}
        />
        <p className="border-t px-6 py-4 text-center text-xs text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link
            href="/request-access"
            className="font-medium text-emerald-600 underline-offset-4 hover:text-emerald-700 hover:underline dark:text-emerald-400"
          >
            Request access
          </Link>
        </p>
      </div>

      <p className="mt-6 max-w-md text-center text-[11px] italic leading-relaxed text-muted-foreground/55">
        <span className="font-medium not-italic">Disclaimer:</span> This tool is
        provided solely for demonstration and technical portfolio purposes. It is
        not affiliated with, endorsed by, sponsored by, or operated on behalf of
        OnForm Finance or any related entity. The creator expressly disclaims
        any official, contractual, or representational relationship with OnForm.
        Any data, trademarks, or references are used for illustrative purposes
        only. Nothing herein constitutes financial, accounting, or legal advice.
      </p>
    </main>
  );
}
