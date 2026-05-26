# OnForm Internal Tool — Progress Log

> Running log of what's been built. Append after each completed step.
> Phase numbering follows `.cursorrules` § 6.
> Note: scaffold uses **Next.js 16 + React 19 + Tailwind v4** (rules were written for v14 — adapted in flight).

---

## Phase 0 — Environment ✅

- [x] Node v20.18.2 (LTS), npm 10.9.3, git 2.43.0 verified on WSL2
- [x] Cursor IDE in use
- [x] Workspace folder: `~/Workspace/Product-Build-MRR/internal-tools/onform-internal-tool`

## Phase 1 — Create Next.js project ✅

- [x] Scaffolded with `create-next-app@latest .` using flags: `--typescript --eslint --tailwind --app --no-src-dir --import-alias "@/*" --use-npm --no-turbopack`
- [x] Resulting stack: Next.js 16.2.6, React 19.2.4, TypeScript 5, Tailwind CSS v4, ESLint 9 (flat config)
- [x] `.gitignore` already excludes `.env*` (Clerk/DB/BQ secrets will be safe)
- [x] Annotated `AGENTS.md` so any AI agent in this repo knows `.cursorrules` is the source of truth
- [x] Created this `Progress.md`
- [x] `npm run dev` running (Turbopack, ready in 464ms) — reachable at `http://localhost:3000`
- [x] Committed: `Phase 1: scaffold Next.js 16 (App Router, TS, Tailwind v4)`

## Phase 2 — Clerk authentication ✅

- [x] Installed `@clerk/nextjs@7.4.1` (Next.js 16 compatible, ships with GHSA-26hh-7cqf-hhc6 patch)
- [x] Created `.env.local.example` template; fixed `.gitignore` to allow `*.example` tracking
- [x] Created `proxy.ts` at project root (Next.js 16's rename of `middleware.ts`) using `clerkMiddleware` + `createRouteMatcher`. Public routes: `/`, `/sign-in(.*)`, `/sign-up(.*)`, `/api/webhooks(.*)`. Everything else `auth.protect()`.
- [x] Wrapped `app/layout.tsx` with `<ClerkProvider>`, updated metadata to "OnForm Internal Tool"
- [x] `app/sign-in/[[...sign-in]]/page.tsx` — Clerk `<SignIn />` centered
- [x] `app/sign-up/[[...sign-up]]/page.tsx` — Clerk `<SignUp />` centered
- [x] `app/dashboard/page.tsx` — server component, greets user by first name, shows email, `<UserButton />` for sign-out
- [x] `app/page.tsx` — async `auth()` → redirect `/dashboard` or `/sign-in`
- [x] User signed up + reached `/dashboard` (verified via screenshot)
- [x] `.clerk/` auto-added to `.gitignore` (keyless cache)

### Adaptations from .cursorrules (v14 → v16)

| Rule wording | What we did |
|---|---|
| `middleware.ts` | `proxy.ts` (Next.js 16 rename) |
| `AFTER_SIGN_IN_URL` env var | `SIGN_IN_FALLBACK_REDIRECT_URL` (current Clerk name) |
| sync `auth()` calls | `await auth()` everywhere (now async) |

### Follow-ups (carried into Phase 3)

- Current Clerk instance is **keyless** (unclaimed dev sandbox). User to claim it via the Clerk banner on `localhost:3000`, then paste real keys into `.env.local` and flip **Sign-up mode = Restricted**.

---

## Access-control architecture decision: **Option C** (request → invitation)

Discussed and locked in 2026-05-26. The `.cursorrules` Phase 3 webhook spec ("anyone who signs up becomes a USER") is replaced with the following.

### Flow

1. Stranger visits public `/request-access` page (no sign-in) → submits email + name + optional reason → row created in `JoinRequest` table with `status: PENDING`.
2. Admin sees badge on the **Requests** tab. Per request: **Invite** (sends Clerk invitation with role), **Reject** (silent — no email sent), **Block** (email added to blocklist; future requests auto-rejected).
3. Invited user clicks the magic link in their email → completes Clerk sign-up → `user.created` webhook fires → server creates `User` row using the role embedded in the matching invitation; `JoinRequest.status → ACCEPTED`.
4. Admin can also bypass the request queue and invite anyone proactively.
5. For existing users, admin can: promote USER → ADMIN, demote ADMIN → USER (with safety: can't demote self / last admin), remove (revokes session + soft-delete), block (revoke + email blocklisted).

### Policy decisions

| Decision | Value |
|---|---|
| Founding admin email | `e.a.mateli@gmail.com` (env var `FOUNDING_ADMIN_EMAIL`) |
| Rejection notification | **Silent** (no email to requester) |
| Request expiry | **48 hours** — pending requests past 48h auto-expire (cron / on-read check) |
| Block scope | **Email-only** (no IP block). IP rate-limiting handled separately in Phase 7. |
| Clerk sign-up mode | **Restricted** (only invited emails can complete sign-up). Defense at Clerk's layer. |

### Plan impact on later phases

- **Phase 3**: schema gains `JoinRequest` model and `User.status` field. Webhook reads matching `Invitation`, copies role into `User`. Founding-admin bypass: if `clerkUser.email === FOUNDING_ADMIN_EMAIL` and no `User` row exists, create with `role: ADMIN`.
- **Phase 5**: admin panel grows three tabs — **Requests** (with badge), **Users** (promote/demote/remove), **Invitations** (resend/revoke). Public `/request-access` page added at the same time.
- **Phase 7**: rate-limit `/api/request-access` (5/hr per IP), Zod validation on all admin POST bodies, audit-log every admin decision.

## Phase 3 — Prisma + Railway PostgreSQL

Not started.

## Phase 4 — BigQuery connection

Not started. Service account JSON to be confirmed.

## Phase 5 — UI (dashboard, client detail, admin)

Not started. Style direction: **minimalist, modern, friendly**.

## Phase 6 — Exports (Excel + PDF)

Not started.

## Phase 7 — Security hardening

Not started.

## Phase 8 — Deploy to Vercel

Not started.

## Phase 9 — Teaching pass (Pass 2)

Deferred until app is deployed (per user preference).

---

## Open questions / follow-ups

- Confirm BigQuery service account JSON exists for `onform-data-warehouse` (needed in Phase 4).
- Clerk and Resend accounts to be created when their phases begin.
- Decide on shadcn/ui base color in Phase 5 (rules suggest Slate; we may pick something warmer to match "cute" UI direction).
