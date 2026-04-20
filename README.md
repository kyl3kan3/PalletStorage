# WMS — Pallet Storage / Warehouse Management System

Multi-tenant SaaS WMS: inbound receiving & putaway, inventory/location tracking, outbound picking & shipping, barcode/QR scanning.

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
