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

### 3b. Lib helpers ✅

- [x] `lib/prisma.ts` — singleton PrismaClient cached on `globalThis` (dev hot-reload safe); imports from `@/lib/generated/prisma/client` (Prisma 6's new generator output)
- [x] `lib/email.ts` — Resend wrapper. `sendEmail()` no-ops gracefully if `RESEND_API_KEY` is missing/placeholder. `notifyAdminsOfNewRequest()` queries every ACTIVE admin and emails them; failures logged, never thrown.
- [x] `lib/auth.ts` — `getOrCreateUserFromClerk()` (founding-admin bypass via `FOUNDING_ADMIN_EMAIL`), `requireAdmin()` (redirect non-admins / blocked users)

### 3c. API routes ✅

- [x] `app/api/webhooks/clerk/route.ts` — uses `verifyWebhook` from `@clerk/backend/webhooks` (signature check via `CLERK_WEBHOOK_SIGNING_SECRET`). Handles `user.created` (invitation-aware + founding-admin bypass, wrapped in a Prisma transaction, AuditLog) and `user.deleted` (drops DB row, AuditLog).
- [x] `app/api/request-access/route.ts` — public POST. Zod-validated body, IP captured from `x-forwarded-for`, blocklist check (EMAIL + IP), dedupe on existing PENDING request and existing User. **Silent-drop pattern**: every non-success outcome returns the same generic 200 response to prevent enumeration. Admin email fired best-effort via `notifyAdminsOfNewRequest`.
- [x] `app/api/test-db/route.ts` — authed sanity check: returns counts (users / admins / pending requests / pending invitations).

### 3d. Configure Clerk webhook ✅

- [x] ngrok forwarding `https://151d-87-202-174-42.ngrok-free.app → localhost:3000`
- [x] Clerk webhook endpoint added (subscribed to `user.created` + `user.deleted`)
- [x] Signing secret copied into `.env.local` as `CLERK_WEBHOOK_SIGNING_SECRET` (renamed from earlier `CLERK_WEBHOOK_SECRET` — Clerk SDK's `verifyWebhook` looks for the `_SIGNING_SECRET` form by default)
- [x] Dev server restarted

### 3e. Provision the founding admin's DB row ✅

The founding admin signed up in Phase 2 **before** the webhook was wired, so `user.created` never fired for them. Instead of forcing a delete-and-resignup, we lazy-provision from the dashboard.

- [x] `app/dashboard/page.tsx` now calls `getOrCreateUserFromClerk()` on every render. Idempotent — no-op once the row exists.
- [x] Founding-admin path in `lib/auth.ts` upgraded to mirror the webhook: creates `User` + `Profile` + `AuditLog` (`action: user.bootstrap_founding_admin`) in a single transaction.
- [x] Concurrency fix: in dev, React 19 fired several concurrent server-component renders, all racing the create. Wrapped in a `try/catch` that swallows `P2002` (unique constraint on `clerkId`) and re-fetches the row that won the race.
- [x] Dashboard now displays the user's role next to their email, and shows an amber "account not yet provisioned" callout when `dbUser === null` (i.e. signed in to Clerk but not yet in our DB — happens to anyone who somehow slipped past Restricted mode).

## Phase 4 — BigQuery connection ✅

### 4a. Credentials provisioned ✅

- [x] Service account `onform-app-reader@onform-data-warehouse.iam.gserviceaccount.com` with **only** `BigQuery Data Viewer` + `BigQuery Job User` roles
- [x] JSON key generated, moved to `~/secrets/onform-app-reader.json` (chmod 600)
- [x] `GOOGLE_PROJECT_ID` + `GOOGLE_APPLICATION_CREDENTIALS_JSON` (single-line, single-quoted JSON) appended to `.env.local`
- [x] `.env.local` tightened to mode `600`
- [x] `npm install @google-cloud/bigquery` (v9.x)

### 4b. Warehouse discovery ✅

- [x] `scripts/discover-bq.mjs` — re-runnable introspection tool (`node scripts/discover-bq.mjs [--sample N]`). Lists datasets → tables/views → schemas, optionally with N sample rows.
- [x] Discovered warehouse content:
  - Dataset: `finance_data`
  - Tables: `clients` (3), `transactions` (10), `cash_balances` (10), `budgets` (6), `inventory` (10)
  - Views: `v_profit_loss`, `v_cash_runway`, `v_budget_vs_actual` (rows reported as 0 because they're views; sampling confirms data)
  - `clients.revenue` is INTEGER (annual GBP); `v_cash_runway.runway_months` is **STRING** category ("CASH_POSITIVE" etc.), not a number.

### 4c. BigQuery client + query helper ✅

- [x] `lib/bigquery.ts` — lazy singleton `BigQuery` client; `queryBigQuery<T>(sql, params)` typed helper with parameterised query support; `unwrapBqValues()` flattens BQ's `{ value: "..." }` wrappers on DATE/TIMESTAMP fields; sanitised errors so credentials never appear in stack traces.

### 4d. Shared data layer + API + dashboard ✅

- [x] `lib/data/clients.ts` — `getClientsOverview(viewer: User)` joins `clients` ↔ `v_cash_runway`. Single source of truth for the overview; audit-logs every read with `action: clients.overview.viewed` (fire-and-forget — never blocks the response).
- [x] `app/api/clients/route.ts` — `GET /api/clients` returns `{ ok, clients }`. Re-checks Clerk session + user status (`ACTIVE`) as defence-in-depth. `dynamic = "force-dynamic"` so Next.js doesn't try to statically render an empty version.
- [x] `app/dashboard/page.tsx` — replaced placeholder with a 3-column card grid (`md:grid-cols-2 lg:grid-cols-3`). Each card shows client name, industry badge, status badge, annual revenue, current cash, net monthly cashflow (coloured), runway category, and a health dot (green/amber/red) based on net cashflow. Renders contextual states for `dbUser === null` (awaiting setup) and `BLOCKED` (rose callout).
- [x] Both the API route and the dashboard call `getClientsOverview()` directly — no self-HTTP fetch, single round-trip per request.
- [x] Verified end-to-end via inline SQL test (3 rows, expected nulls on Gamma's runway columns) + browser confirmation by user.

### Notes / known follow-ups

- React 19 fires multiple concurrent server-component renders in dev → multiple audit-log rows per page load. Production builds don't repeat the render; revisit if it shows up as production noise.
- `BlockedUser` and `NotProvisioned` UI states are in the dashboard now; the request-access page that surfaces *new* users is still pending (Phase 5).

## Phase 5 — UI (dashboard, client detail, admin) ⏳

Style direction: **minimalist, modern, friendly**. Broken into 6 sub-phases so we can pause / commit between each.

### 5a. shadcn/ui + (authenticated) layout ✅

- [x] `npx shadcn@latest init -y -d` — detected Next.js + Tailwind v4, wrote `components.json` (style: base-nova, baseColor: neutral, iconLibrary: lucide), bootstrapped `lib/utils.ts` (the `cn()` helper) and `components/ui/button.tsx`, updated `app/globals.css` with the full set of CSS theme tokens (`--background`, `--foreground`, `--card`, etc., light + dark variants).
- [x] `npx shadcn@latest add card badge dialog input label dropdown-menu separator` — 7 component files in `components/ui/`.
- [x] `components/site-nav.tsx` — client component (`usePathname` for active-link styling). Sticky top, OnForm logo (link to /dashboard), Dashboard / Admin links (Admin only when `isAdmin === true`), Clerk UserButton on the right.
- [x] `app/(authenticated)/layout.tsx` — server component for the route group. One DB call (`getOrCreateUserFromClerk()`) gets the user; passes `isAdmin` to `SiteNav`. If the user has no DB row or status !== ACTIVE, replaces `{children}` with a contextual callout (AwaitingProvisioning amber / Blocked rose) so individual pages don't have to repeat that logic.
- [x] **Request-scoped cache** — wrapped `getOrCreateUserFromClerk` in React's `cache()` so the layout's call + the page's call dedupe into a single DB read per request.
- [x] Moved `app/dashboard/page.tsx` → `app/(authenticated)/dashboard/page.tsx` (route group is URL-transparent, so /dashboard still resolves). Refactored to use shadcn `Card` + `Badge`; dropped its own header (layout owns the nav now) and its NotProvisioned/Blocked branches (layout owns those too).
- [x] Switched root `app/layout.tsx` body from hand-rolled `bg-zinc-50 / dark:bg-zinc-950` to shadcn's `bg-background` / `text-foreground` (applied automatically via `@layer base` in `globals.css`); set `min-h-dvh` instead of `min-h-full flex flex-col`.
- [x] Updated sign-in / sign-up pages to use `min-h-dvh` directly (they were relying on the old body flex layout).

### 5b. Per-client detail page ✅

- [x] `lib/data/clients.ts` extended with `getClientDetail(clientId, viewer)` — runs 4 BQ queries in parallel (`clients` master row, latest `v_profit_loss`, latest `v_cash_runway`, last 10 `transactions`). All parameterised (`@clientId`). Returns `null` when the client doesn't exist so the caller can `notFound()`. Audit log emits `client.detail.viewed` with the clientId + tx count. Refuses obviously bogus ids with a `^[\w-]{1,64}$` guard before touching BQ.
- [x] `app/(authenticated)/clients/[clientId]/page.tsx` — Next.js 16 async `params`, server component, `force-dynamic`. Layout: back link → header (name + industry + status badges + latest period) → 5 KPI scorecards (annual rev, monthly rev, gross profit + margin, EBITDA + margin, cash on hand + runway category) → two-column row with **Recent transactions** table (left, span-2) and **Connections** panel (right) listing Xero / Shopify / Data Studio in a new tab.
- [x] `components/ui/table.tsx` added via `npx shadcn add table` for the transactions list.
- [x] Dashboard cards are now `<Link>`s to `/clients/[id]` with keyboard-focusable ring, group-hover shadow on the card.
- [x] `NEXT_PUBLIC_DATA_STUDIO_DASHBOARD_URL` env var added to `.env.local.example` (and a placeholder to `.env.local`). Falls back to `https://lookerstudio.google.com/` if unset.
- [x] Smoke-tested all four queries against the live warehouse for `client_001` (Acme Corp): 1 client row, 1 P&L row (Jan 2024), 1 runway row, 10 transactions.

### 5c. Public /request-access page ✅

- [x] `proxy.ts` whitelists `/request-access` and `/api/request-access` (existing endpoint from Phase 3c — page just had to be the missing front-end).
- [x] `components/ui/textarea.tsx` added via `npx shadcn add textarea`.
- [x] `app/request-access/page.tsx` — client component with:
  - shadcn Card + Input + Textarea + Label + Button on a soft centered hero
  - Three fields: email (required, `type=email`), full name (optional), reason (optional, max ~3 rows)
  - **Honeypot** input (`name="website"`, visually hidden + `tabIndex=-1`) — naive bots that fill every field get a fake success and never reach the API.
  - Loading state on the submit button (Lucide `Loader2` spinner)
  - Field-level error rendering for the 400 case (Zod validation issues)
  - **Silent-drop preserved on the client**: any non-validation outcome (200 generic-success, network error, etc.) flips the page into a success card with the same generic "Thanks…" message → no enumeration.
- [x] Sign-in page gets a small "Don't have an account? **Request access**" link below the SignIn component (Clerk's hosted sign-up is locked by Restricted mode, so we route new users to /request-access instead of the unreachable /sign-up).
- [x] Resend not yet configured → admin notification logs a warning and the request is still saved. Fully functional locally; emails light up automatically once `RESEND_API_KEY` is set.

### 5d. Admin panel scaffold ✅

- [x] `lib/data/admin.ts` — three list helpers (`listJoinRequests`, `listUsers`, `listInvitations`) + `getAdminBadgeCounts()` for the tab badges. All include sensible ordering and reasonable upper bounds (50 / 200 / 100).
- [x] `components/admin-tabs.tsx` — client component (uses `usePathname` for active state). Underline-style tabs (GitHub / Vercel inspired). Each tab shows a count badge; pending requests / invitations use an **amber attention tint** when > 0, everything else is neutral.
- [x] `app/(authenticated)/admin/layout.tsx` — runs `requireAdmin()` (redirects non-admins to /dashboard), fetches the badge counts once, renders the page header + tabs + children.
- [x] `app/(authenticated)/admin/page.tsx` — now a simple `redirect("/admin/requests")` instead of a placeholder card (since the three tabs ARE the admin UI).
- [x] `app/(authenticated)/admin/requests/page.tsx` — read-only table: email, name, reason (truncated), status badge (PENDING / INVITED / REJECTED / EXPIRED / BLOCKED with appropriate colour), received date, **disabled** Invite / Reject / Block buttons (wired in 5e).
- [x] `app/(authenticated)/admin/users/page.tsx` — read-only table: display name (from Profile), email, role badge (Admin = indigo, User = neutral), status badge, joined date, **disabled** Promote/Demote + Block/Unblock buttons (wired in 5f).
- [x] `app/(authenticated)/admin/invitations/page.tsx` — read-only table: email, role, status (PENDING / ACCEPTED / REVOKED / EXPIRED — auto-degrades to EXPIRED when `expiresAt` has passed even if DB still says PENDING), sent by, dates, **disabled** Resend / Revoke buttons (wired in 5f).
- [x] SiteNav Admin pill already highlights for any `/admin/...` path so the top nav stays consistent when navigating between tabs.

### 5e. Admin — Requests actions ✅

- [x] `lib/admin/join-requests.ts` — `inviteJoinRequest`, `rejectJoinRequest`, `blockJoinRequest`. Invite: revokes stale invitations, creates `Invitation` + marks request `INVITED`, calls Clerk `createInvitation`, sends branded Resend email, rolls back on Clerk failure. Reject: silent, `REJECTED` + audit. Block: upserts `Block` rows for EMAIL + IP, `BLOCKED` + audit.
- [x] `lib/auth.ts` — `requireAdminForApi()` for JSON 401/403 in Route Handlers (no redirects).
- [x] `lib/email.ts` — `sendInvitationEmail()` with OnForm-styled HTML.
- [x] API routes: `POST /api/admin/join-requests/[id]/{invite,reject,block}` with Zod validation on invite (role) and block (reason).
- [x] `components/admin/request-actions.tsx` — confirmation dialogs + `router.refresh()` on success.
- [x] Requests tab wired with live buttons (only for non-expired PENDING rows).

### Brand refresh (OnForm Finance)

- [x] `app/globals.css` — warm white canvas, charcoal primary aligned with [onformfinance.com](https://www.onformfinance.com/).
- [x] `app/layout.tsx` — Cormorant Garamond for `--font-heading` (serif headings like the marketing site).
- [x] `components/site-nav.tsx` — logo uses `font-heading`.

### 5f. Admin — Users tab, Invitations tab, Audit log ✅

- [x] `lib/admin/clerk-invitations.ts` — shared `createClerkInvitation()` + `revokeClerkInvitationsForEmail()` (48h TTL, redirect to `/sign-up`).
- [x] `lib/admin/users.ts` — `promoteUser`, `demoteUser`, `blockUser`, `unblockUser`, `removeUser`. Safety: can't act on self; can't demote/block/remove last active admin. Block: email blocklist + Clerk `banUser`. Unblock: clears block + Clerk `unbanUser`. Remove: audit → Clerk `deleteUser` → local delete.
- [x] `lib/admin/invitations.ts` — `revokeInvitation`, `resendInvitation` (revokes old row, creates fresh DB invitation + Clerk + Resend email).
- [x] API routes: `POST /api/admin/users/[id]/{promote,demote,block,unblock,remove}` and `POST /api/admin/invitations/[id]/{resend,revoke}` — all gated with `requireAdminForApi()`.
- [x] `components/admin/user-actions.tsx` + `invitation-actions.tsx` — confirmation dialogs mirroring request-actions pattern.
- [x] Users + Invitations tabs wired with live buttons (self-row shows "You"; expired-but-PENDING invites still resend/revoke).
- [x] `listRecentAuditLogs()` in `lib/data/admin.ts` + `components/admin/audit-log-panel.tsx` — last 50 entries shown below tab content in admin layout.
- [x] `npx tsc --noEmit` passes.

## Phase 6 — Exports (Excel + PDF) ✅

- [x] Installed `exceljs`, `jspdf`, `jspdf-autotable`.
- [x] `lib/data/client-export.ts` — `getClientExportData()` (P&L, runway, up to 1000 transactions, budget variance) + audit helper.
- [x] `lib/exports/excel.ts` — three sheets: Summary, Transactions, Budget vs Actual (bold headers, GBP currency format).
- [x] `lib/exports/pdf.ts` — client header, key metrics table, transactions table.
- [x] `GET /api/clients/[clientId]/export/{excel,pdf}` — auth + audit log + file download.
- [x] `components/client-export-buttons.tsx` on client detail header.
- [x] `npx tsc --noEmit` passes.

## Phase 7 — Security hardening ✅

- [x] `lib/rate-limit.ts` — in-memory limiter (60 req/min per user; 10 req/min per IP on `/api/request-access`). Returns 429 + `Retry-After`.
- [x] Rate limiting wired into `requireAdminForApi()`, `authorizeClientExport()`, `/api/clients`, `/api/test-db`, and public request-access.
- [x] `lib/api/body.ts` — shared `parseJsonBody()` + `EmptyBodySchema` for strict `{}` validation on body-less admin POSTs.
- [x] All admin POST routes now validate JSON bodies with Zod (invite/block/reject/users/invitations).
- [x] `next.config.ts` — CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.
- [x] Audit logging already covers client views, exports, admin actions, and join requests (verified in Phase 5–6).

## Phase 8 — Deploy to Vercel (in progress)

Repo: `https://github.com/Eamateli/onform_internal_tool` · branch `main`.

### 8.1 Vercel project

- [ ] [vercel.com](https://vercel.com) → **Add New → Project** → import `Eamateli/onform_internal_tool`
- [ ] Framework: **Next.js** (auto-detected) · root `.` · build `npm run build` · no changes needed
- [ ] Deploy once (will fail or be empty until env vars are set — that's normal)

### 8.2 Environment variables

Copy every value from your local `.env.local` into **Vercel → Project → Settings → Environment Variables** (Production + Preview + Development).

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | From Clerk dashboard |
| `CLERK_SECRET_KEY` | Server-only |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | `/dashboard` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | `/dashboard` |
| `CLERK_WEBHOOK_SIGNING_SECRET` | Set after step 8.3 |
| `DATABASE_URL` | Neon **pooled** URL |
| `DIRECT_URL` | Neon **direct** URL (for Prisma CLI only; still set on Vercel) |
| `RESEND_API_KEY` | From Resend |
| `FOUNDING_ADMIN_EMAIL` | `e.a.mateli@gmail.com` |
| `GOOGLE_PROJECT_ID` | `onform-data-warehouse` |
| `GOOGLE_APPLICATION_CREDENTIALS_JSON` | **Paste raw JSON only** — no surrounding quotes in Vercel UI |
| `NEXT_PUBLIC_DATA_STUDIO_DASHBOARD_URL` | Looker Studio link |
| `NEXT_PUBLIC_APP_URL` | **Your Vercel URL**, e.g. `https://onform-internal-tool.vercel.app` |

Then **Redeploy** (Deployments → ⋮ → Redeploy).

### 8.3 Clerk production settings

- [ ] Clerk → **Configure → Domains** → add your Vercel URL
- [ ] **Webhooks → Add endpoint** → `https://<vercel-url>/api/webhooks/clerk`
- [ ] Subscribe to `user.created` and `user.deleted`
- [ ] Copy new **Signing Secret** → Vercel env `CLERK_WEBHOOK_SIGNING_SECRET` → redeploy again

### 8.4 Smoke test (production)

- [ ] Open Vercel URL → redirects to sign-in
- [ ] Sign in as founding admin → dashboard shows 3 clients
- [ ] Open a client → exports download
- [ ] Admin panel → requests / users / invitations / audit log
- [ ] Submit `/request-access` from an incognito window (optional)

### Commit (after deploy verified)

`Phase 8: deployed to Vercel`

## Phase 9 — Teaching pass (Pass 2)

Deferred until app is deployed (per user preference).

---

## Open questions / follow-ups

- Confirm BigQuery service account JSON exists for `onform-data-warehouse` (needed in Phase 4).
- Clerk and Resend accounts to be created when their phases begin.
- Decide on shadcn/ui base color in Phase 5 (rules suggest Slate; we may pick something warmer to match "cute" UI direction).
