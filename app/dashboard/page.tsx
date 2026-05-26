import { currentUser } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";

// Server component. Auth is enforced upstream by proxy.ts — by the time this
// renders we are guaranteed a signed-in user. `currentUser()` then fetches
// the full Clerk profile on the server (no client-side token round-trip).
export default async function DashboardPage() {
  const user = await currentUser();
  const firstName = user?.firstName;
  const email = user?.primaryEmailAddress?.emailAddress;

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <span className="text-lg font-semibold tracking-tight">OnForm</span>
        {/* UserButton handles its own state + sign-out menu on the client. */}
        <UserButton />
      </header>

      <section className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome{firstName ? `, ${firstName}` : ""}.
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Signed in as {email ?? "unknown"}.
        </p>

        <div className="mt-10 rounded-2xl border border-dashed border-zinc-300 px-6 py-14 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          Your client dashboard will appear here once BigQuery is wired up
          (Phase 4).
        </div>
      </section>
    </main>
  );
}
