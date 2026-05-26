import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

// Landing page. Acts as a tiny router:
//   • signed-in  → /dashboard
//   • signed-out → /sign-in
// `auth()` is async in Next.js 16 — must be awaited.
export default async function HomePage() {
  const { userId } = await auth();
  redirect(userId ? "/dashboard" : "/sign-in");
}
