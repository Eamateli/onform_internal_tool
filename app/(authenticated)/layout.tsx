// Route-group layout for every page that requires a fully-provisioned account.
//
// What this layout owns:
//   • Decoration: top nav + page-width container.
//   • Pre-flight account check: anyone who's signed in to Clerk but doesn't
//     have an ACTIVE User row in our DB sees a friendly callout INSTEAD of
//     the requested page. The actual page server-components don't run in
//     that case (Next.js still evaluates them, but they're trained to
//     short-circuit on the same check — see dashboard).
//   • Role-gated nav items (Admin link only for ADMIN users).
//
// Auth at the network layer is handled by `proxy.ts` — by the time we run,
// `auth()` is guaranteed to have a userId. This layout assumes that.

import { getOrCreateUserFromClerk } from "@/lib/auth";
import { SiteNav } from "@/components/site-nav";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Cached for the duration of this request (see `lib/auth.ts`), so the
  // dashboard / admin pages calling this again won't issue a second DB read.
  const dbUser = await getOrCreateUserFromClerk();
  const isAdmin = dbUser?.role === "ADMIN" && dbUser.status === "ACTIVE";

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <SiteNav isAdmin={isAdmin} />

      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        {dbUser === null ? (
          <AwaitingProvisioning />
        ) : dbUser.status !== "ACTIVE" ? (
          <Blocked />
        ) : (
          children
        )}
      </main>
    </div>
  );
}

function AwaitingProvisioning() {
  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 px-6 py-10 text-sm text-amber-900 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-200">
      <p className="font-medium">Account not yet provisioned.</p>
      <p className="mt-1 text-amber-800/80 dark:text-amber-200/80">
        Your Clerk session is valid but you don&apos;t have an active account
        in our system. An admin needs to invite you before you can access
        client data.
      </p>
    </div>
  );
}

function Blocked() {
  return (
    <div className="rounded-2xl border border-rose-300 bg-rose-50 px-6 py-10 text-sm text-rose-900 dark:border-rose-800/40 dark:bg-rose-950/30 dark:text-rose-200">
      <p className="font-medium">This account has been blocked.</p>
      <p className="mt-1 text-rose-800/80 dark:text-rose-200/80">
        Contact your administrator if you believe this is in error.
      </p>
    </div>
  );
}
