# OnForm Internal Tool — Cursor Teaching Guide

**For:** Beginner-friendly, step-by-step learning  
**Approach:** Build once with Cursor's help, then have Cursor rebuild it with you as a teaching exercise  
**Time:** 4-6 hours total (split into phases — take breaks)  
**Outcome:** A production-ready internal app that reads from your BigQuery warehouse

---

## How to Use This Guide With Cursor

This guide is designed to work alongside Cursor's AI chat. The pattern is:

1. **Read a phase** in this guide
2. **Open Cursor's AI chat** (`Cmd+L` on Mac, `Ctrl+L` on Windows)
3. **Paste the relevant section as context** and ask Cursor to either:
   - "Build this for me and explain what each part does"
   - "Walk me through this step by step, ask me before writing each file"
   - "Build it, then quiz me on what we built"
4. **Test after every phase** before moving to the next
5. **Commit to git after every working phase** so you can roll back if something breaks

### The Two-Pass Learning Method

- **Pass 1 (Build):** Cursor writes the code, you read and run. Goal: ship a working app.
- **Pass 2 (Teach):** Delete it. Have Cursor walk you through rebuilding from scratch, one file at a time, asking you to understand each piece before moving on.

You learn 10x more on Pass 2. Don't skip it.

---

## What You're Building

A web app for the OnForm team that:

- **Login** — Clerk handles authentication (Google, email, magic links)
- **Dashboard** — list of all clients with health metrics
- **Client detail page** — drill into one client's P&L, runway, budget
- **Admin panel** — invite team members, manage roles, view audit log
- **Exports** — download client reports as Excel / PDF
- **Connections** — one-click open into the client's Xero / Shopify / Data Studio

**It reads from your BigQuery warehouse** — never writes back. Read-only by design = secure by design.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                   USER'S BROWSER                             │
│                                                              │
│   Next.js Frontend (React components, Tailwind UI)           │
│                          ↓ HTTPS                             │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────┐
│         NEXT.JS API LAYER (server-side, Vercel)              │
│                                                              │
│   • Clerk middleware verifies every request                  │
│   • Rate limiting (basic)                                    │
│   • Audit logging for sensitive actions                      │
│                                                              │
└────────┬───────────────────────────────┬─────────────────────┘
         │                               │
         ▼                               ▼
┌──────────────────────┐         ┌────────────────────────┐
│  PostgreSQL          │         │   BigQuery             │
│  (Railway)           │         │   (read-only)          │
│                      │         │                        │
│  • users             │         │   • clients            │
│  • profiles          │         │   • transactions       │
│  • invitations       │         │   • v_profit_loss      │
│  • audit_logs        │         │   • v_cash_runway      │
│                      │         │   • v_budget_vs_actual │
└──────────────────────┘         └────────────────────────┘
```

**Why this split?** PostgreSQL holds *app data* (who can use the app, what they've done). BigQuery holds *business data* (clients' financial numbers). They never mix.

---

## Tech Stack — What Each Tool Does

| Tool | What it does | Why this one |
|---|---|---|
| **Next.js 14** | The framework — pages + API in one project | Industry standard, full-stack, Vercel-native |
| **TypeScript** | Adds types to JavaScript | Catches bugs before they happen |
| **Tailwind CSS** | Utility classes for styling | Fast styling, no separate CSS files |
| **shadcn/ui** | Pre-built React components (buttons, dialogs, tables) | Copy-paste components, fully owned by you |
| **Clerk** | Authentication (login, signup, sessions) | SOC 2 compliant, free tier, drop-in |
| **Prisma** | Talks to PostgreSQL with TypeScript safety | Industry standard, great DX |
| **PostgreSQL on Railway** | Your app database | Reliable, generous free tier |
| **@google-cloud/bigquery** | Reads from BigQuery | Official Google library |
| **Resend** | Sends invitation emails | Free tier, clean API |
| **Vercel** | Hosts the app | Free tier, auto-deploys from GitHub |
| **GitHub** | Stores your code | Industry standard |
| **Cursor** | Your AI-powered code editor | Built on VSCode, integrates AI deeply |

---

## Prerequisites — Accounts to Create (All Free)

Before touching code, sign up for these (5 min each):

| Service | URL | What for |
|---|---|---|
| GitHub | github.com | Stores your code |
| Vercel | vercel.com | Hosts the app (sign in with GitHub) |
| Clerk | clerk.com | Authentication |
| Railway | railway.app | PostgreSQL database |
| Resend | resend.com | Invitation emails |

Cursor: download from cursor.com.

You already have Google Cloud (BigQuery) ✅

---

## Best Practices We'll Follow

These shape every decision. Don't skip — they're what separate "ships once" from "scales to 100 clients."

### 1. Secrets in environment variables, never in code
- All API keys go in `.env.local` (development) and Vercel env vars (production)
- `.env.local` is in `.gitignore` — never committed to git
- Use `process.env.CLERK_SECRET_KEY` in code

### 2. Server-side only for sensitive operations
- BigQuery credentials must NEVER reach the browser
- All BigQuery queries go through Next.js API routes (`app/api/...`)
- Frontend calls API routes, never BigQuery directly

### 3. Type everything
- Use TypeScript interfaces for every data shape
- Use Zod schemas to validate API inputs

### 4. Auth on every protected route
- Use Clerk middleware to protect routes
- Verify user role in API routes (don't trust the frontend)

### 5. One commit per working feature
- After each phase below works: `git add . && git commit -m "Phase X: description"`
- If something breaks: `git reset --hard HEAD~1`

### 6. Test locally before deploying
- Run `npm run dev` and test in browser at `localhost:3000`
- Only push to GitHub once it works locally
- Vercel auto-deploys on push, so test locally first

### 7. Test remotely after deploying
- Every Vercel deploy gets a URL — open it, test it
- If it works locally but not remote: check environment variables in Vercel dashboard

### 8. Read-only BigQuery credentials
- The service account we'll create has ONLY the "BigQuery Data Viewer" role
- Even if compromised, attacker cannot modify your data

---

# 📦 Phase 0 — Set Up Your Computer (15 min)

## Step 0.1 — Install Node.js (the runtime that runs Next.js)

1. Go to **nodejs.org**
2. Download the **LTS** version (not Current)
3. Install with default options
4. Open Terminal (Mac) or Command Prompt (Windows)
5. Type: `node --version` — should show something like `v20.x.x`
6. Type: `npm --version` — should show something like `10.x.x`

If both work, Node is installed. ✅

## Step 0.2 — Install git (if not already)

- Mac: should already be there. Run `git --version` to check.
- Windows: download from **git-scm.com** and install with defaults.

## Step 0.3 — Install Cursor

1. Download from **cursor.com**
2. Install
3. Open it
4. Sign in (it has a free tier with limited AI usage; Pro is $20/month if you want unlimited)

## Step 0.4 — Set up a workspace folder

Open Terminal. Run:

```bash
mkdir -p ~/code
cd ~/code
```

This makes a folder called `code` in your home directory. You'll put projects here.

---

## 💬 First Cursor Conversation

Open Cursor → File → Open Folder → select `~/code`. The folder is empty — that's fine.

Press `Cmd+L` (Mac) or `Ctrl+L` (Windows) to open the AI chat panel.

Paste this as your first prompt:

> "I'm building an internal web app for an accountancy firm. The app will read financial data from BigQuery and let team members view client dashboards. I'm a beginner with Next.js. Before we write any code, can you ask me 5 clarifying questions about what I want?"

Wait for Cursor to ask its questions. Answer them honestly — the more context Cursor has, the better its code.

Then continue with Phase 1.

---

# 🏗️ Phase 1 — Create the Next.js Project (20 min)

## Goal of this phase
A blank Next.js app running on `localhost:3000` with TypeScript and Tailwind.

## Step 1.1 — Generate the project

In Cursor's terminal (`Cmd+J` or `Ctrl+J`), run:

```bash
cd ~/code
npx create-next-app@latest onform-internal-tool
```

Answer the prompts:

| Question | Answer |
|---|---|
| Would you like to use TypeScript? | **Yes** |
| Would you like to use ESLint? | **Yes** |
| Would you like to use Tailwind CSS? | **Yes** |
| Would you like to use `src/` directory? | **No** |
| Would you like to use App Router? | **Yes** |
| Would you like to customize the default import alias? | **No** (keep `@/*`) |

Wait ~1 minute for it to install dependencies.

## Step 1.2 — Open the project in Cursor

```bash
cd onform-internal-tool
cursor .
```

Or: in Cursor, File → Open Folder → select `~/code/onform-internal-tool`.

## Step 1.3 — Run it locally

In the terminal:

```bash
npm run dev
```

Open browser to **http://localhost:3000** — you should see the default Next.js welcome page.

✅ **Phase 1 done.** Press `Ctrl+C` in the terminal to stop the server when you want to.

## Step 1.4 — Initialize git

In the terminal:

```bash
git init
git add .
git commit -m "Phase 1: initial Next.js setup"
```

## 🎓 What you just learned

- **Next.js** is a framework that combines React (frontend) with API routes (backend) in one project
- **App Router** is the new way Next.js handles pages — files in `app/` become routes
- **`npm run dev`** starts a local development server
- **TypeScript** is JavaScript with types — `.tsx` and `.ts` files

## 💬 Ask Cursor

> "Walk me through what's in this Next.js project. What does each top-level file and folder do? Show me the file tree and explain it."

---

# 🔐 Phase 2 — Add Authentication with Clerk (30 min)

## Goal
A working login page. Visiting `/` requires login. Logged-in users see a dashboard placeholder.

## Step 2.1 — Create a Clerk account

1. Go to **clerk.com** → Sign up
2. Click **+ Create application**
3. Name: `OnForm Internal Tool`
4. Select sign-in methods: **Email** + **Google** _(start simple)_
5. Click **Create application**
6. You land on the dashboard. Keep this tab open.

## Step 2.2 — Copy API keys

On the Clerk dashboard:
1. Click **API Keys** in left sidebar
2. You see two keys:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (starts with `pk_test_...`)
   - `CLERK_SECRET_KEY` (starts with `sk_test_...`)
3. Copy both — we'll paste them into the project

## Step 2.3 — Create `.env.local`

In Cursor:
1. Right-click the project root → New File → name it `.env.local`
2. Paste:

```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...your_key...
CLERK_SECRET_KEY=sk_test_...your_key...

# Clerk URLs (where to go after sign-in)
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
```

Paste your real keys. Save the file.

## Step 2.4 — Verify `.env.local` is gitignored

Open `.gitignore` — confirm it has `.env*.local`. Should be there by default. ✅

This is critical — never commit your keys.

## Step 2.5 — Install Clerk

In terminal:

```bash
npm install @clerk/nextjs
```

## Step 2.6 — Ask Cursor to do the rest

This is where AI saves time. Open Cursor chat (`Cmd+L`) and paste:

> "Add Clerk authentication to this Next.js 14 App Router project. I need:
> 1. A middleware that protects all routes except /sign-in and /sign-up
> 2. A ClerkProvider wrapping the root layout
> 3. A /sign-in page using Clerk's `<SignIn />` component
> 4. A /sign-up page using Clerk's `<SignUp />` component
> 5. A /dashboard page that shows the user's email and a sign-out button
> 6. A landing page at / that redirects to /dashboard if logged in, /sign-in if not
> 
> Explain what each file does as you create it. Use TypeScript. Follow Clerk's official Next.js 14 App Router pattern."

Cursor will create or modify these files:
- `middleware.ts` (root)
- `app/layout.tsx`
- `app/sign-in/[[...sign-in]]/page.tsx`
- `app/sign-up/[[...sign-up]]/page.tsx`
- `app/dashboard/page.tsx`
- `app/page.tsx` (modified)

**Read what it generates.** Ask Cursor follow-up questions about anything you don't understand.

## Step 2.7 — Test locally

```bash
npm run dev
```

Open **localhost:3000** → should redirect to `/sign-in`.

1. Click **Sign up** → create an account with your email
2. Verify the email (check inbox)
3. You should land at `/dashboard` showing your email
4. Click sign out → redirects back to `/sign-in`

✅ **Phase 2 done.**

## Step 2.8 — Commit

```bash
git add .
git commit -m "Phase 2: Clerk auth working"
```

## 🎓 What you just learned

- **Middleware** runs on every request before pages load — used here to check auth
- **ClerkProvider** is a React Context that makes user info available everywhere
- `[[...sign-in]]` is a Next.js "catch-all" route — handles any sub-path
- Environment variables prefixed with `NEXT_PUBLIC_` are visible to the browser; others are server-only

## 💬 Ask Cursor

> "Explain how the middleware.ts file works. What does it do, step by step, for each incoming request?"

---

# 💾 Phase 3 — Database with Prisma + Railway (45 min)

## Goal
A PostgreSQL database on Railway with schemas for users, profiles, invitations, and audit logs. Prisma lets us query it with TypeScript.

## Step 3.1 — Create Railway account & PostgreSQL

1. Go to **railway.app** → Sign in with GitHub
2. Click **+ New Project**
3. Choose **Provision PostgreSQL**
4. Wait 30 seconds — your database is live
5. Click the PostgreSQL service → **Variables** tab
6. Find **`DATABASE_URL`** — copy it (looks like `postgresql://postgres:abc@host:port/railway`)

## Step 3.2 — Add to `.env.local`

Add this line:

```env
DATABASE_URL="postgresql://postgres:...your_url..."
```

## Step 3.3 — Install Prisma

```bash
npm install @prisma/client
npm install -D prisma
npx prisma init
```

This creates `prisma/schema.prisma`.

## Step 3.4 — Ask Cursor to write the schema

Open `prisma/schema.prisma`. Open Cursor chat:

> "Update this Prisma schema with these models. I'm using PostgreSQL. Add proper indexes and relationships.
> 
> 1. **User** — id (cuid), clerkId (unique), email (unique), role (enum: USER/ADMIN), createdAt, updatedAt
> 2. **Profile** — id, userId (relation to User), firstName, lastName, jobTitle, avatarUrl
> 3. **Invitation** — id, email, role, invitedBy (User relation), token (unique), status (PENDING/ACCEPTED/EXPIRED), expiresAt, createdAt
> 4. **AuditLog** — id, userId (User relation), action, resourceType, resourceId, metadata (JSON), createdAt
> 
> Explain each model and why we have it."

Cursor generates the schema. Read it. Save.

## Step 3.5 — Push to the database

```bash
npx prisma db push
```

This creates the tables on Railway. You'll see "Your database is now in sync."

## Step 3.6 — Generate the Prisma client

```bash
npx prisma generate
```

This creates the TypeScript types so we can write `prisma.user.findMany()` with autocomplete.

## Step 3.7 — Create a Prisma helper file

Ask Cursor:

> "Create a `lib/prisma.ts` file that exports a singleton Prisma client. Use the recommended Next.js pattern that prevents creating multiple clients in development hot-reload."

## Step 3.8 — Test the database connection

Create a test API route. Ask Cursor:

> "Create an API route at `app/api/test-db/route.ts` that:
> 1. Verifies the request has an authenticated Clerk user (use `auth()` from `@clerk/nextjs/server`)
> 2. Counts the number of users in the database
> 3. Returns JSON `{ status: 'ok', userCount: number }`
> 
> Explain the auth pattern."

Then in browser, visit **localhost:3000/api/test-db** — you should see `{ "status": "ok", "userCount": 0 }`.

## Step 3.9 — Auto-create user on first sign-in

When a user signs up via Clerk, we want a matching row in our `User` table. Ask Cursor:

> "Modify the Clerk webhook to sync new users into our database. When a user signs up in Clerk:
> 1. Create a User row with their clerkId and email
> 2. Default role: USER
> 3. Make the first user ever to sign up an ADMIN automatically
> 
> Use Clerk's webhook with svix verification. Create the webhook handler at `app/api/webhooks/clerk/route.ts`."

You'll also need to:
1. Go to Clerk Dashboard → **Webhooks** → **+ Add Endpoint**
2. Endpoint URL: `https://your-domain/api/webhooks/clerk` (for local testing, use ngrok — Cursor can explain)
3. Subscribe to: `user.created`
4. Copy the **Signing Secret** → add to `.env.local` as `CLERK_WEBHOOK_SECRET=whsec_...`

## Step 3.10 — Test end-to-end

1. Restart `npm run dev`
2. Sign up with a NEW email
3. Visit `/api/test-db` → `userCount` should be `1`
4. Check Railway Postgres directly: use `npx prisma studio` → opens a GUI showing your tables

✅ **Phase 3 done.**

```bash
git add .
git commit -m "Phase 3: Prisma + Railway PostgreSQL working"
```

## 🎓 What you just learned

- **ORM** (Object-Relational Mapper) — Prisma converts SQL queries into TypeScript function calls
- **Schema-first development** — define your data in one place, types and migrations flow from it
- **Webhooks** — external services calling back to your app when something happens
- **Singleton pattern** — one shared instance of an object across the app

## 💬 Ask Cursor

> "Show me three different ways to query my database with Prisma. Explain what each does."

---

# 📊 Phase 4 — Connect to BigQuery (30 min)

## Goal
Read your `finance_data.clients` table from inside the Next.js app via an API route. Display it on the dashboard.

## Step 4.1 — Create a read-only BigQuery service account

1. Go to **console.cloud.google.com** → IAM & Admin → Service Accounts
2. **+ Create Service Account**
   - Name: `onform-app-reader`
   - ID: auto-fills
3. Click **Create and Continue**
4. **Role:** `BigQuery Data Viewer` only _(read-only — critical!)_
5. Click **+ Add another role** → also add `BigQuery Job User` _(needed to run queries)_
6. Click **Done**
7. Find the new service account → click its email → **Keys** tab
8. **Add Key → Create new key → JSON → Create**
9. A JSON file downloads. Open it in a text editor — copy the entire contents.

## Step 4.2 — Add to env

In `.env.local`:

```env
# Google Cloud
GOOGLE_PROJECT_ID=onform-data-warehouse
GOOGLE_APPLICATION_CREDENTIALS_JSON='{"type":"service_account",...full JSON on one line...}'
```

⚠️ The JSON must be on **one line** with single quotes around it.

Cursor tip: ask Cursor "How do I store a multi-line JSON service account key as a single env variable in Next.js?" — it'll explain the encoding.

## Step 4.3 — Install BigQuery library

```bash
npm install @google-cloud/bigquery
```

## Step 4.4 — Create the BigQuery helper

Ask Cursor:

> "Create `lib/bigquery.ts` that:
> 1. Parses GOOGLE_APPLICATION_CREDENTIALS_JSON from env
> 2. Creates a singleton BigQuery client
> 3. Exports a `queryBigQuery<T>(sql: string): Promise<T[]>` function with TypeScript generics
> 4. Adds error handling that doesn't leak credential details
> 
> Explain why generics are useful here."

## Step 4.5 — Create an API route to fetch clients

> "Create `app/api/clients/route.ts` that:
> 1. Verifies the user is authenticated with Clerk
> 2. Queries `finance_data.clients` with their key fields
> 3. Logs the request to the audit log (via Prisma)
> 4. Returns the clients as JSON
> 5. Handles errors gracefully
> 
> Use the queryBigQuery helper. Define a TypeScript Client interface."

## Step 4.6 — Test the API route

In browser, visit **localhost:3000/api/clients** — you should see your 3 clients.

If you see an error, paste it back to Cursor and ask for help.

## Step 4.7 — Display on the dashboard

> "Update `app/dashboard/page.tsx` to be a server component that:
> 1. Fetches the clients from `/api/clients`
> 2. Renders them in a clean table with Tailwind CSS
> 3. Columns: Client Name, Industry, Annual Revenue (formatted as £), Status
> 4. Show a heading 'Clients' and a count of total clients
> 
> Use proper TypeScript types."

## Step 4.8 — Test

Visit **localhost:3000/dashboard** — you should see your 3 clients (Acme, Beta, Gamma) with their data.

✅ **Phase 4 done.**

```bash
git add .
git commit -m "Phase 4: BigQuery connected, clients showing on dashboard"
```

## 🎓 What you just learned

- **Service accounts** — credentials that represent your app, not a person
- **Principle of least privilege** — give the minimum role needed
- **API routes vs Pages** — API routes return data (JSON); pages return HTML
- **Server components** — components that run on the server, can call APIs directly

## 💬 Ask Cursor

> "Why is it dangerous to put BigQuery credentials in the frontend? What attack would succeed if I did?"

---

# 🖥️ Phase 5 — Build the UI (60 min)

## Goal
A polished UI with a layout, navigation, and three pages: Dashboard (client list), Client Detail, Admin Panel.

## Step 5.1 — Install shadcn/ui

```bash
npx shadcn@latest init
```

Answer the prompts:
- Style: **Default**
- Base color: **Slate** (or your preference)
- CSS variables: **Yes**

Install the components we'll use:

```bash
npx shadcn@latest add button card table dialog input label form badge dropdown-menu
```

## Step 5.2 — Build the layout

> "Create a `app/(authenticated)/layout.tsx` that:
> 1. Is a route group — all routes inside get authentication required
> 2. Has a top nav bar with: OnForm logo (text), Dashboard / Admin links, and a UserButton (from Clerk)
> 3. Has a max-width container for the main content
> 4. Uses Tailwind, looks professional, similar to Linear or Vercel dashboards
> 
> Move dashboard/page.tsx into this group."

Cursor restructures the project. Read what it does.

## Step 5.3 — Client list page (improved)

> "Improve the dashboard page:
> 1. Use shadcn Card components — one card per client, in a grid
> 2. Each card shows: client name, industry badge, monthly revenue, monthly burn, cash runway months, and a 'View details →' link
> 3. The card has a status indicator (green dot if cash positive, red if low runway)
> 4. Fetch from `/api/clients-overview` — a NEW endpoint we'll create
> 
> Then create `app/api/clients-overview/route.ts` that joins clients with v_cash_runway and v_profit_loss views."

## Step 5.4 — Client detail page

> "Create `app/(authenticated)/clients/[clientId]/page.tsx` that:
> 1. Fetches one client's full financial picture
> 2. Shows: client header (name, industry), scorecards (Revenue, Gross Profit, EBITDA, Cash, Runway)
> 3. A 'Connections' section with buttons that open in new tab: Xero, Shopify, Data Studio
> 4. The Data Studio button links to your actual dashboard URL (we'll add as env var)
> 5. Use shadcn Card and Button components
> 
> Create `app/api/clients/[clientId]/route.ts` to fetch from BigQuery."

Add this to `.env.local`:

```env
DATA_STUDIO_DASHBOARD_URL=https://lookerstudio.google.com/your-dashboard-link
```

## Step 5.5 — Admin panel

> "Create `app/(authenticated)/admin/page.tsx` that:
> 1. Only ADMIN users can access (otherwise redirect to /dashboard)
> 2. Lists all users (from Prisma)
> 3. Has a button 'Invite member' that opens a dialog
> 4. Dialog asks for email + role, sends invitation via Resend
> 5. Shows audit log below — last 50 actions
> 
> Create API routes:
> - GET `/api/admin/users` — list users (admin only)
> - POST `/api/admin/invitations` — create invitation (admin only)
> - GET `/api/admin/audit-log` — recent actions (admin only)"

## Step 5.6 — Add a helper for role checks

> "Create `lib/auth.ts` with a `requireAdmin()` helper that:
> 1. Gets the current user from Clerk
> 2. Looks them up in Prisma User table
> 3. Throws an error or redirects if not ADMIN
> 4. Returns the User object if they are
> 
> Use this in all admin API routes."

## Step 5.7 — Test the full flow

1. Sign in as the admin (first user)
2. View dashboard — see clients
3. Click a client — see their detail page
4. Visit `/admin` — see user list
5. Try inviting a colleague — they receive an email
6. Sign out, sign in as second user — should NOT see Admin link

✅ **Phase 5 done.** This is the biggest phase. Take a break.

```bash
git add .
git commit -m "Phase 5: UI complete with dashboard, client detail, admin panel"
```

---

# 📤 Phase 6 — Exports (Excel + PDF) (45 min)

## Goal
Buttons on the client detail page that export to Excel and PDF.

## Step 6.1 — Install libraries

```bash
npm install exceljs jspdf jspdf-autotable
```

## Step 6.2 — Build the Excel export

> "Create `app/api/clients/[clientId]/export/excel/route.ts` that:
> 1. Verifies auth + audit logs the export
> 2. Fetches the client's P&L, transactions, and budget data from BigQuery
> 3. Generates an Excel file with 3 sheets: Summary, Transactions, Budget vs Actual
> 4. Uses ExcelJS, applies basic formatting (bold headers, currency format)
> 5. Returns the file as a download
> 
> Then add an 'Export to Excel' button on the client detail page that hits this endpoint."

## Step 6.3 — Build the PDF export

> "Create `app/api/clients/[clientId]/export/pdf/route.ts` that:
> 1. Verifies auth + audit logs the export
> 2. Generates a clean PDF with: client name + month, key metrics (revenue, profit, runway), transactions table
> 3. Uses jsPDF + jspdf-autotable
> 4. Returns the file as a download
> 
> Add a 'Export to PDF' button."

## Step 6.4 — Test

1. Open a client's detail page
2. Click Export to Excel → download → open in Excel/Numbers → looks right
3. Click Export to PDF → download → open in browser → looks right
4. Check audit log in admin panel → both export actions logged

✅ **Phase 6 done.**

```bash
git add .
git commit -m "Phase 6: Excel and PDF exports working"
```

---

# 🛡️ Phase 7 — Security Hardening (30 min)

## Goal
Production-grade security without overengineering.

## Step 7.1 — Rate limiting

> "Add basic rate limiting to all API routes:
> 1. Create `lib/rate-limit.ts` using `@upstash/ratelimit` (or a simple in-memory limiter for now)
> 2. 60 requests per minute per user
> 3. Returns 429 if exceeded
> 4. Apply to /api/clients, /api/clients-overview, /api/clients/[clientId], and all admin routes
> 
> Explain why rate limiting matters."

## Step 7.2 — Audit logging coverage

Confirm every sensitive action writes to AuditLog:
- ✅ Viewing client data
- ✅ Exports
- ✅ Inviting members
- ✅ Changing roles

Ask Cursor to review the codebase and find any missing audit logs.

## Step 7.3 — Input validation with Zod

> "Add Zod validation to all POST/PUT API routes:
> 1. Define a schema for each endpoint's expected body
> 2. Validate before processing
> 3. Return 400 with a useful error if validation fails
> 
> Show me one example, then add it to all routes."

## Step 7.4 — Security headers

> "Add security headers to next.config.js:
> - Content-Security-Policy
> - X-Frame-Options: DENY
> - X-Content-Type-Options: nosniff
> - Referrer-Policy: strict-origin-when-cross-origin
> - Permissions-Policy
> 
> Explain what each header prevents."

## Step 7.5 — Final security checklist

Verify each:
- [ ] `.env.local` is gitignored (it is by default)
- [ ] No API keys in any file outside `.env.local`
- [ ] Every API route checks auth FIRST
- [ ] Admin routes check role
- [ ] BigQuery service account has ONLY Data Viewer + Job User
- [ ] Rate limiting on all routes
- [ ] Zod validates all POST bodies
- [ ] Security headers in next.config.js
- [ ] HTTPS enforced (Vercel does this automatically)

```bash
git add .
git commit -m "Phase 7: Security hardening complete"
```

---

# 🚀 Phase 8 — Deploy to Vercel (30 min)

## Goal
Live URL like `onform-internal-tool.vercel.app` that you can share with Henry.

## Step 8.1 — Push to GitHub

In Cursor terminal:

```bash
# Create a new GitHub repo via the GitHub CLI (or use github.com web UI)
gh repo create onform-internal-tool --private --source=. --remote=origin --push
```

Or manually:
1. Go to github.com → New repository
2. Name: `onform-internal-tool`
3. Private
4. Don't initialize with README
5. Follow the "push existing repo" instructions:

```bash
git remote add origin https://github.com/yourusername/onform-internal-tool.git
git branch -M main
git push -u origin main
```

## Step 8.2 — Deploy via Vercel

1. Go to **vercel.com** → **+ Add New → Project**
2. Find your `onform-internal-tool` repo → **Import**
3. Vercel auto-detects Next.js. Don't change anything.
4. **Environment Variables** — this is critical:
   - Click **Environment Variables**
   - Add EVERY variable from your `.env.local` one by one:
     - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
     - `CLERK_SECRET_KEY`
     - `NEXT_PUBLIC_CLERK_SIGN_IN_URL` = `/sign-in`
     - `NEXT_PUBLIC_CLERK_SIGN_UP_URL` = `/sign-up`
     - `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` = `/dashboard`
     - `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` = `/dashboard`
     - `CLERK_WEBHOOK_SECRET`
     - `DATABASE_URL`
     - `GOOGLE_PROJECT_ID`
     - `GOOGLE_APPLICATION_CREDENTIALS_JSON`
     - `DATA_STUDIO_DASHBOARD_URL`
     - `RESEND_API_KEY` _(when you set up Resend)_
5. Click **Deploy**

Wait ~2 minutes. You get a URL like `onform-internal-tool-xyz.vercel.app`.

## Step 8.3 — Update Clerk

1. Clerk dashboard → your app → **Domains**
2. Add your Vercel URL
3. Re-add the webhook with the new URL: `https://your-vercel-url/api/webhooks/clerk`
4. Copy the new webhook secret → add to Vercel env vars → redeploy

## Step 8.4 — Test in production

1. Open the Vercel URL
2. Sign up with a fresh email
3. Verify dashboard loads with real client data
4. Test exports
5. Test admin panel

If something works locally but not in production, **99% of the time it's an env variable missing or wrong**. Check Vercel → Settings → Environment Variables.

✅ **Phase 8 done. You shipped a real app.**

---

# 🎓 Phase 9 — The Teaching Pass (recommended)

Now that you have a working app, do this:

## Step 9.1 — Make a teaching branch

```bash
git checkout -b learning
```

## Step 9.2 — Delete a key file

Pick one file you don't fully understand. Delete it.

## Step 9.3 — Ask Cursor to teach you

> "I deleted [filename]. Don't write it back yet. Instead, walk me through what this file should contain, step by step. After each section, ask me to write it myself, then check my work. We're learning."

Do this for:
- `middleware.ts`
- `app/api/clients/route.ts`
- `lib/bigquery.ts`
- `lib/prisma.ts`

After each one, ask Cursor to **quiz you**:

> "Now quiz me with 5 questions about how this file works. After my answers, tell me what I got right and wrong."

## Step 9.4 — Build something small from scratch

Pick a small extra feature you'd like to add. For example:

- A "favourites" toggle on clients (star icon)
- A simple search bar on the dashboard
- A "last login" display in the admin panel

Ask Cursor to coach you, not write it:

> "I want to add [feature]. Don't write the code. Ask me how I think we should structure it, then guide me through writing it myself."

This is where the real learning happens.

---

# 📚 Glossary — Words You'll Hear

| Term | Plain English |
|---|---|
| **Component** | A reusable piece of UI (a button, a card, a form) |
| **Hook** | A React function that gives you state/effects (`useState`, `useEffect`) |
| **Route** | A URL path in your app (`/dashboard` is a route) |
| **API route** | A URL that returns data (JSON), not HTML |
| **Server component** | Runs on the server, ships only HTML to the browser |
| **Client component** | Runs in the browser, needed for interactivity (`'use client'` at top of file) |
| **Middleware** | Code that runs before any route, often for auth |
| **Webhook** | An external service calling your app when something happens |
| **Environment variable** | A secret value stored outside the codebase |
| **Singleton** | One shared instance of an object across the app |
| **ORM** | Library that converts SQL queries into TypeScript |
| **Migration** | A versioned change to the database schema |
| **CORS** | Browser security that controls cross-domain requests |
| **JWT** | A signed token used for authentication |
| **Service account** | Credentials for your app (not a human) to access Google services |

---

# 🆘 When Things Break

## "Module not found" errors
- Run `npm install` again
- Restart the dev server

## "Unauthorized" errors
- Check `.env.local` has all keys
- Restart the dev server (env vars only load on start)

## BigQuery returns empty / errors
- Check the service account has correct roles
- Check the JSON env var is valid: `node -e "console.log(JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON))"`

## Vercel deploy fails
- Look at the build log — the error is usually specific
- 90% of failures: env variable missing or typo

## Clerk webhook isn't firing locally
- Use ngrok to expose `localhost:3000`: `ngrok http 3000`
- Update Clerk webhook to the ngrok URL temporarily

## General "I don't understand what's happening"
- Paste the error + relevant code into Cursor and ask: "What does this error mean? Walk me through it."
- If still stuck: Stack Overflow or Next.js Discord

---

# ✅ Definition of Done

You'll know you're done when:

- [ ] You can sign up with email → land at dashboard
- [ ] Dashboard shows your 3 BigQuery clients
- [ ] Click a client → see their P&L + connections
- [ ] Export to Excel works → opens cleanly in Excel
- [ ] Export to PDF works → opens cleanly
- [ ] Admin panel only visible to ADMIN role
- [ ] Inviting a team member sends a real email
- [ ] Audit log records every sensitive action
- [ ] Deployed at a Vercel URL accessible from any browser
- [ ] You can explain (without looking) how auth flows from sign-in → dashboard

---

# 🎯 What to Send Henry

Once the app is live:

```
Subject: OnForm prototype — full-stack walkthrough

Hi Henry,

Following up on my application — I've built a working prototype that 
demonstrates the full data + tooling stack I'd build for OnForm.

🔗 Live app: https://onform-internal-tool.vercel.app
   Sign up with your work email — you'll be added as a viewer.

📊 Live dashboards: [Data Studio link]

📎 Attached:
   - Architecture summary (PDF)
   - Day 1 migration playbook (PDF, internal — not for distribution)

What's there:
- BigQuery warehouse with finance schema, P&L / runway / budget variance views
- Data Studio dashboards (Executive, Inventory, CFO)
- Next.js app with Clerk auth, exports, admin panel
- All on free tier (~£0/month at current scale)

Total infrastructure cost at 50 clients: under £300/month, vs ~£90K/year 
for a dedicated data engineer.

Happy to walk through it on a call.

Best,
[Your name]
```

---

# 🎉 You did it

This guide is yours. Save it. Reference it. Improve it as you learn.

**The two-pass method matters more than the code.** Build once with Cursor. Then rebuild it teaching yourself. The second pass is where the engineering instincts form.

Good luck with Henry. 🤝
