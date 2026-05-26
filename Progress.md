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

## Phase 2 — Clerk authentication

Not started.

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
