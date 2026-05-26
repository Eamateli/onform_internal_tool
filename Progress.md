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

- ✅ Keyless instance claimed; real Clerk app is `OnFromFinance` (rename to "OnForm Internal Tool" later if desired — purely cosmetic).
- ✅ Real publishable + secret keys pasted into `.env.local`.
- ✅ **Restricted mode enabled** at Clerk dashboard → Configure → Protect → Restrictions → "Enable restricted mode" (toggle ON). Sign-ups now require an invitation.

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
| Block scope | **Email AND IP**. Stored in a `Block` table (`kind: EMAIL \| IP`, `value`, `reason`, `blockedBy`). Requester IP captured on `JoinRequest` (from `x-forwarded-for` headers) so it's available at block time. Caveat: shared NAT can sweep in legitimate users from the same network. |
| Admin notification on new request | **Email via Resend to every `role: ADMIN` user** when a `JoinRequest` is created. Subject: "New access request — {email}". Body: email, name, reason, link to admin panel. Best-effort: if Resend fails the request is still saved. Brings Resend setup forward from Phase 5 → Phase 3. |
| Clerk sign-up mode | **Restricted** (only invited emails can complete sign-up). Defense at Clerk's layer. |

### Plan impact on later phases

- **Phase 3**: schema gains
  - `JoinRequest` (incl. `ipAddress` so blocks can capture it),
  - `Invitation` (already in `.cursorrules`),
  - `Block` (`kind: EMAIL | IP`, `value`, `reason`, `blockedBy`, `createdAt`),
  - `User.status` (`ACTIVE` / `BLOCKED`).

  Webhook reads matching `Invitation`, copies role into `User`. Founding-admin bypass: if `clerkUser.email === FOUNDING_ADMIN_EMAIL` and no `User` row exists, create with `role: ADMIN`.

  Resend setup is **pulled forward from Phase 5** because admins need to receive an email on every new `JoinRequest`. Will introduce `lib/email.ts` + `RESEND_API_KEY` env var here.
- **Phase 5**: admin panel grows three tabs — **Requests** (with badge), **Users** (promote / demote / remove / block), **Invitations** (resend / revoke). Public `/request-access` page added at the same time.
- **Phase 7**: rate-limit `/api/request-access` (5/hr per IP), Zod validation on all admin POST bodies, audit-log every admin decision. `/api/request-access` must check both the EMAIL and IP blocklists before accepting a submission.

## Phase 3 — Prisma + Postgres (Neon) ⏳

> Note: Railway free tier ended → switched to **Neon** (3GB free Postgres). Same Postgres under the hood — no schema changes needed.

### 3a. Schema scaffolded and pushed ✅

- [x] Installed `@prisma/client@6.19.3`, `prisma@6.19.3`, `resend@6.12.4`, `zod@4.4.3`, `dotenv@17.4.2`
- [x] `prisma init` → `prisma.config.ts` + `prisma/schema.prisma`
- [x] Configured `prisma.config.ts` to load `.env.local` (single source of truth — deleted auto-created `.env`)
- [x] Schema written: `User` (with `UserStatus` ACTIVE/BLOCKED), `Profile`, `Invitation` (PENDING/ACCEPTED/EXPIRED/REVOKED), `JoinRequest` (PENDING/INVITED/REJECTED/EXPIRED/BLOCKED, with `ipAddress` + `expiresAt`), `Block` (kind EMAIL/IP), `AuditLog` (action + resource + metadata Json)
- [x] Generator output set to `../lib/generated/prisma` (outside Next.js's `app/` route tree)
- [x] `.gitignore` ignores `/lib/generated`
- [x] npm scripts: `db:push`, `db:generate`, `db:studio`, `postinstall: prisma generate`
- [x] `npm run db:push` → all 6 tables + 5 enums materialized on Neon

### 3b. Lib helpers (next)

- [ ] `lib/prisma.ts` — singleton PrismaClient (dev hot-reload safe)
- [ ] `lib/email.ts` — Resend wrapper + `notifyAdminsOfNewRequest()` helper
- [ ] `lib/auth.ts` — `getOrCreateUserFromClerk()` (founding-admin bypass), `requireAdmin()`

### 3c. API routes (next)

- [ ] `app/api/webhooks/clerk/route.ts` — svix-verified, invitation-aware user creation
- [ ] `app/api/request-access/route.ts` — public POST, blocklist check, admin notification
- [ ] Test webhook end-to-end via ngrok

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
