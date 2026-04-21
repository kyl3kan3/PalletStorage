# WMS — Pallet Storage / Warehouse Management System

Multi-tenant SaaS WMS: inbound receiving & putaway, inventory/location tracking, outbound picking & shipping, barcode/QR scanning. Deployable on Vercel with a Neon Postgres backend.

## Stack
- pnpm workspaces + Turborepo monorepo
- Next.js 15 (web dashboard) + Expo (mobile)
- tRPC, Drizzle + Postgres, Clerk (auth)

## Layout
```
apps/
  web/     Next.js dashboard
  mobile/  Expo app for floor staff
packages/
  api/     tRPC routers (shared)
  db/      Drizzle schema + migrations
  core/    Domain logic (putaway, pick path, LPN)
  ui/      Shared React components (web)
  config/  Shared tsconfig/eslint presets
```

## Row-level security
Migration `0001_rls.sql` enables RLS on every tenant-scoped table. The policies
read `current_setting('app.org_id')`, so application queries must run under a
role that does **not** bypass RLS (e.g. `wms_app`) and must set the tenant id
per request:
```sql
SET LOCAL app.org_id = '<org-uuid>';
```
Tenant scoping in the tRPC layer is belt-and-suspenders — if a procedure ever
forgets `organizationId = X`, RLS still filters it out.

## Getting started
```bash
pnpm install
cp .env.example .env           # fill in DATABASE_URL + Clerk keys
pnpm db:migrate
pnpm dev
```

## Deploy a preview to Vercel

The repo ships with `vercel.json` and `.env.production.example`. End-to-end
setup takes ~15 minutes and needs a Postgres instance and a Clerk instance.

### 1. Provision Postgres
In the Vercel dashboard → **Storage** → **Create Database** → **Postgres**.
Attach it to the project you'll create in step 3. Copy the `POSTGRES_URL`
value shown in the "Quickstart" tab — that's your `DATABASE_URL`.

### 2. Apply migrations
Run once from your laptop against the hosted DB:
```bash
DATABASE_URL="postgres://..." pnpm db:migrate
```
This applies `0000_init` → `0004_cycle_counts` plus the RLS policies.
Re-run after pulling new migrations.

### 3. Create the Vercel project
- **Import** this repo in Vercel.
- Leave **Root Directory** blank — the root `vercel.json` pins the build
  command (`pnpm --filter @wms/web... build`) and output directory.
- **Framework Preset**: Next.js (auto-detected).

### 4. Set up Clerk
- Create an instance at <https://clerk.com>. Dev instance is fine for a
  preview; production keys needed for public sharing.
- Copy the three `CLERK_*` keys into Vercel env vars (see
  `.env.production.example`).
- Optional: add a **Webhook endpoint** at
  `https://<your-app>.vercel.app/api/webhooks/clerk`, subscribe to user +
  organization events, and paste the signing secret as
  `CLERK_WEBHOOK_SIGNING_SECRET`. Without this, users can sign in but
  won't get provisioned in the WMS tables — which means every tRPC call
  will 403. For a first smoke test you can create the org/user rows by
  hand in Postgres.

### 5. (Optional) QuickBooks

The QuickBooks Online integration can round-trip three things: inbound
orders → Bills, shipped outbound orders → Invoices, and cycle-count
variances → sparse QtyOnHand updates on each Item.

**One-time setup (in QBO):**
1. <https://developer.intuit.com> → **My Apps** → create a new app for
   "Accounting". Copy the Client ID + Client Secret.
2. Under **Redirect URIs**, add
   `https://<your-app>.vercel.app/api/quickbooks/callback`.
3. Create a **Sandbox Company** in the Intuit developer dashboard if you
   don't already have one.

**Vercel env vars:**
```
QBO_CLIENT_ID=<from Intuit>
QBO_CLIENT_SECRET=<from Intuit>
QBO_REDIRECT_URI=https://<your-app>.vercel.app/api/quickbooks/callback
QBO_ENV=sandbox
```

**In-app:**
1. Go to `/settings/integrations` → **Connect**.
2. Intuit consent flow → picks your sandbox company → redirects back.
3. Set a **unit price** on each product (inline on `/products`) so
   Bills and Invoices post non-zero dollar amounts. Lines without a
   unit price will still export — they'll just show `$0`.
4. The export creates QBO Vendors / Customers automatically (from the
   order's supplier / customer field) and picks sensible default
   chart-of-accounts entries (Income, COGS, Inventory Asset). If your
   sandbox is missing those account types the export throws a clear
   error.

Skip this section entirely if you don't want the integration — the
rest of the dashboard works without it.

### 6. Deploy
Vercel rebuilds on every push to `main`. Preview deployments run on each
PR. The `output: 'standalone'` setting in `next.config.mjs` is harmless
on Vercel (it's an opt-in for self-hosting via the Dockerfile).

### Troubleshooting
- **"Organization not provisioned"** on every request → Clerk webhook
  isn't firing. Either wire it up or insert an `organizations` +
  `memberships` row manually.
- **RLS denies everything** → application runs under a role that
  `FORCE`s RLS; confirm migrations applied and that the connection
  string's role is not a superuser bypassing RLS. For first boot, a role
  that does bypass RLS (Neon/Vercel Postgres's default) is fine.
- **Build fails resolving `@wms/api`** → ensure `vercel.json`
  `buildCommand` is `pnpm --filter @wms/web... build` (the `...`
  includes workspace deps).
