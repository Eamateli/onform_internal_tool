import { SignIn } from "@clerk/nextjs";

// The folder name `[[...sign-in]]` is a Next.js *optional catch-all* segment.
// Clerk's hosted flow may push the user to sub-paths like
// `/sign-in/factor-one`, `/sign-in/sso-callback`, etc. — this single page
// handles all of them so we never hit a 404 mid-flow.
export default function SignInPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <SignIn />
    </main>
  );
}
