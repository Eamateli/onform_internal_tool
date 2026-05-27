// Simple in-memory rate limiter (per key, sliding window).
// Good enough for a single-instance dev / small Vercel deployment.
// Swap for @upstash/ratelimit when you need cross-region consistency.

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;

type Bucket = { count: number; resetAt: number };

const store = new Map<string, Bucket>();

// Prune stale entries occasionally so the Map doesn't grow forever.
let opsSincePrune = 0;

function pruneStale(now: number) {
  opsSincePrune++;
  if (opsSincePrune < 100) return;
  opsSincePrune = 0;
  for (const [key, bucket] of store) {
    if (bucket.resetAt <= now) store.delete(key);
  }
}

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterMs: number };

export function checkRateLimit(
  key: string,
  max = MAX_REQUESTS,
  windowMs = WINDOW_MS,
): RateLimitResult {
  const now = Date.now();
  pruneStale(now);

  const bucket = store.get(key);
  if (!bucket || bucket.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (bucket.count >= max) {
    return { ok: false, retryAfterMs: bucket.resetAt - now };
  }

  bucket.count++;
  return { ok: true };
}

export function rateLimitResponse(retryAfterMs: number): Response {
  const retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / 1000));
  return Response.json(
    { ok: false, error: "Too many requests — try again shortly" },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) },
    },
  );
}

export function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export function enforceUserRateLimit(userId: string): Response | null {
  const result = checkRateLimit(`user:${userId}`);
  if (!result.ok) return rateLimitResponse(result.retryAfterMs);
  return null;
}

export function enforceIpRateLimit(
  req: Request,
  max = MAX_REQUESTS,
): Response | null {
  const result = checkRateLimit(`ip:${clientIp(req)}`, max);
  if (!result.ok) return rateLimitResponse(result.retryAfterMs);
  return null;
}
