// Next.js 16 renamed `middleware.ts` to `proxy.ts`. Same purpose: code that
// runs at the network boundary BEFORE any page or API route is rendered.
//
// Clerk's clerkMiddleware() reads the session cookie on every request and
// attaches it to the request context. Calling `await auth.protect()` for a
// given request will:
//   • redirect anonymous browser requests to /sign-in, or
//   • return a 401 for unauthenticated API requests.
//
// Anything matched by `isPublicRoute` skips the protect() call — those routes
// stay reachable without a session.
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  // Clerk's own webhook endpoint authenticates via Svix signature, not session.
  "/api/webhooks(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static asset extensions.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run on API routes.
    "/(api|trpc)(.*)",
  ],
};
