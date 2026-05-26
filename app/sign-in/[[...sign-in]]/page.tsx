import Link from "next/link";
import { SignIn } from "@clerk/nextjs";

// The folder name `[[...sign-in]]` is a Next.js *optional catch-all* segment.
// Clerk's hosted flow may push the user to sub-paths like
// `/sign-in/factor-one`, `/sign-in/sso-callback`, etc. — this single page
// handles all of them so we never hit a 404 mid-flow.
export default function SignInPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6">
      <SignIn />
      {/* Sign-up is locked (Clerk Restricted mode) so we route new users to
          the request-access flow instead of the unreachable sign-up page. */}
      <p className="text-xs text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link
          href="/request-access"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Request access
        </Link>
      </p>
    </main>
  );
}
