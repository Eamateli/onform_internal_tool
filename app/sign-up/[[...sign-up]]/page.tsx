import { SignUp } from "@clerk/nextjs";

// Same optional catch-all pattern as /sign-in — Clerk handles all the
// multi-step sign-up sub-routes (email verification, profile, etc.).
export default function SignUpPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <SignUp />
    </main>
  );
}
