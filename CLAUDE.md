# PalletStorage — agent rules

## Git workflow

- **Commit and push directly to `main`.** Do not create feature branches, do not open draft PRs for routine changes. The deployed Vercel target is `main`; branching adds latency without benefit on this project.
- Skip the "create branch → push → open PR → merge" dance. `git commit` + `git push origin main` is the workflow.
- Never `--force` push. Never skip hooks (`--no-verify`). If `main` is protected and a push is rejected, surface that to the user instead of working around it.

## Stack at a glance

- Next.js 15 App Router + tRPC v11 + Drizzle ORM (postgres-js / Neon).
- Multi-tenant via Clerk Organizations — every row in business tables has `organization_id`.
- Web app at `apps/web`, Expo mobile at `apps/mobile`, shared packages under `packages/{api,db,core,ui}`.
- Migrations live in `packages/db/migrations`; concatenated form in `preview-all.sql` for one-shot setup on Neon.

## Domain glossary

- **Customer**: a 3PL client of the warehouse — the company whose pallets we store. Has billing rates (storage / inbound / outbound) used by `/reports/billing`.
- **Supplier**: who *ships into* the warehouse on an inbound order. Often the customer's vendor, sometimes the customer themselves.
- **Pallet**: physical unit of stock. Identified by an LPN; tied to a customer; carries one or more `pallet_items` with qty/lot/expiry.
- **Inbound / outbound order**: receiving / shipping document. Status walks `open → receiving|picking → closed | cancelled` (see `_stateMachine.ts`).
- **Movement ledger**: `movements` table records `receive`/`putaway`/`pick`/`ship` events. The billing peak-pallet calc walks this per customer.

## Conventions

- Money is integer **cents** everywhere (`unitPriceCents`, `storageRateCentsPerPalletMonth`, …). Never floats.
- All tRPC procedures gate on `requireOrgId(ctx)` — no cross-tenant reads.
- Manager-gated mutations use `managerProcedure`; everyday intake uses `tenantProcedure`.
- For UI, prefer kit components (`Btn`, `Card`, `PageTitle`, `Tag`, `TextField`) from `~/components/kit`.
