-- ════════════════════════════════════════════════════════════════════
-- Preview deployment: single-paste schema for Neon SQL Editor
-- ════════════════════════════════════════════════════════════════════
-- Concatenates migrations 0000..0004 and finishes by disabling RLS on
-- every tenant table. Use this only for a preview environment — in a
-- real deploy, run `pnpm db:migrate` so Drizzle records each migration
-- in __drizzle_migrations and leave RLS enabled (with app.org_id set
-- per transaction).
--
-- Idempotent: every CREATE uses IF NOT EXISTS, every FK ADD is wrapped
-- in DO $$ ... EXCEPTION WHEN duplicate_object. Safe to re-paste.
-- ════════════════════════════════════════════════════════════════════

-- ── 0000_init ────────────────────────────────────────────────────────
DO $$ BEGIN CREATE TYPE "public"."inbound_status" AS ENUM('draft', 'open', 'receiving', 'closed', 'cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "public"."label_kind" AS ENUM('pallet', 'location'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "public"."location_type" AS ENUM('floor', 'rack', 'staging', 'dock'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "public"."member_role" AS ENUM('admin', 'manager', 'operator'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "public"."movement_reason" AS ENUM('receive', 'putaway', 'move', 'pick', 'ship', 'adjust', 'cycle_count'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "public"."outbound_status" AS ENUM('draft', 'open', 'picking', 'packed', 'shipped', 'cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "public"."pallet_status" AS ENUM('in_transit', 'received', 'stored', 'picked', 'shipped', 'damaged'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "public"."cycle_count_status" AS ENUM('draft', 'open', 'counting', 'reviewing', 'closed', 'cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "organizations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "clerk_org_id" text,
  "name" text NOT NULL,
  "legal_name" text,
  "billing_email" text,
  "phone" text,
  "tax_id" text,
  "address_line1" text,
  "address_line2" text,
  "city" text,
  "region" text,
  "postal_code" text,
  "country" text,
  "timezone" text NOT NULL DEFAULT 'UTC',
  "logo_url" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "organizations_clerk_org_id_unique" UNIQUE("clerk_org_id")
);
-- If the table already existed before these columns were added, patch it:
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "legal_name" text;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "billing_email" text;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "phone" text;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "tax_id" text;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "address_line1" text;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "address_line2" text;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "city" text;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "region" text;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "postal_code" text;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "country" text;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "timezone" text NOT NULL DEFAULT 'UTC';
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "logo_url" text;

CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "clerk_user_id" text NOT NULL,
  "email" text NOT NULL,
  "name" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "users_clerk_user_id_unique" UNIQUE("clerk_user_id")
);

CREATE TABLE IF NOT EXISTS "memberships" (
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role" "member_role" DEFAULT 'operator' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("organization_id", "user_id")
);

CREATE TABLE IF NOT EXISTS "customers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "contact_name" text,
  "email" text,
  "phone" text,
  "tax_id" text,
  "billing_line1" text,
  "billing_line2" text,
  "billing_city" text,
  "billing_region" text,
  "billing_postal_code" text,
  "billing_country" text,
  "shipping_line1" text,
  "shipping_line2" text,
  "shipping_city" text,
  "shipping_region" text,
  "shipping_postal_code" text,
  "shipping_country" text,
  "notes" text,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "customers_org_name_idx" ON "customers" ("organization_id", "name");

CREATE TABLE IF NOT EXISTS "suppliers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "contact_name" text,
  "email" text,
  "phone" text,
  "address_line1" text,
  "address_line2" text,
  "city" text,
  "region" text,
  "postal_code" text,
  "country" text,
  "notes" text,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "suppliers_org_name_idx" ON "suppliers" ("organization_id", "name");

CREATE TABLE IF NOT EXISTS "warehouses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "timezone" text DEFAULT 'UTC' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "warehouses_org_code_uq" ON "warehouses" ("organization_id", "code");
CREATE INDEX IF NOT EXISTS "warehouses_org_idx" ON "warehouses" ("organization_id");

CREATE TABLE IF NOT EXISTS "locations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "warehouse_id" uuid NOT NULL REFERENCES "warehouses"("id") ON DELETE CASCADE,
  "parent_id" uuid,
  "code" text NOT NULL,
  "path" text NOT NULL,
  "type" "location_type" DEFAULT 'rack' NOT NULL,
  "length_mm" integer,
  "width_mm" integer,
  "height_mm" integer,
  "max_weight_kg" numeric(10, 2),
  "velocity_class" text,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "locations_wh_path_uq" ON "locations" ("warehouse_id", "path");
CREATE INDEX IF NOT EXISTS "locations_org_idx" ON "locations" ("organization_id");
CREATE INDEX IF NOT EXISTS "locations_parent_idx" ON "locations" ("parent_id");

CREATE TABLE IF NOT EXISTS "products" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "sku" text,
  "name" text NOT NULL,
  "barcode" text,
  "length_mm" integer,
  "width_mm" integer,
  "height_mm" integer,
  "weight_kg" numeric(10, 3),
  "velocity_class" text,
  "unit_price_cents" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
-- If you ran this script before unit_price_cents existed, add it now:
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "unit_price_cents" integer;
CREATE UNIQUE INDEX IF NOT EXISTS "products_org_sku_uq" ON "products" ("organization_id", "sku");
CREATE INDEX IF NOT EXISTS "products_barcode_idx" ON "products" ("barcode");

CREATE TABLE IF NOT EXISTS "pallets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "warehouse_id" uuid NOT NULL REFERENCES "warehouses"("id") ON DELETE CASCADE,
  "customer_id" uuid REFERENCES "customers"("id") ON DELETE SET NULL,
  "lpn" text NOT NULL,
  "status" "pallet_status" DEFAULT 'in_transit' NOT NULL,
  "current_location_id" uuid REFERENCES "locations"("id") ON DELETE SET NULL,
  "weight_kg" numeric(10, 3),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "pallets" ADD COLUMN IF NOT EXISTS "customer_id" uuid
  REFERENCES "customers"("id") ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "pallets_org_lpn_uq" ON "pallets" ("organization_id", "lpn");
CREATE INDEX IF NOT EXISTS "pallets_org_idx" ON "pallets" ("organization_id");
CREATE INDEX IF NOT EXISTS "pallets_location_idx" ON "pallets" ("current_location_id");

CREATE TABLE IF NOT EXISTS "pallet_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "pallet_id" uuid NOT NULL REFERENCES "pallets"("id") ON DELETE CASCADE,
  "product_id" uuid NOT NULL REFERENCES "products"("id"),
  "qty" integer NOT NULL,
  "lot" text,
  "expiry" timestamp with time zone
);
CREATE INDEX IF NOT EXISTS "pallet_items_pallet_idx" ON "pallet_items" ("pallet_id");
CREATE INDEX IF NOT EXISTS "pallet_items_product_idx" ON "pallet_items" ("product_id");

CREATE TABLE IF NOT EXISTS "inbound_orders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "warehouse_id" uuid NOT NULL REFERENCES "warehouses"("id"),
  "reference" text NOT NULL,
  "supplier" text,
  "supplier_id" uuid REFERENCES "suppliers"("id") ON DELETE SET NULL,
  "customer_id" uuid REFERENCES "customers"("id") ON DELETE SET NULL,
  "status" "inbound_status" DEFAULT 'draft' NOT NULL,
  "expected_at" timestamp with time zone,
  "received_at" timestamp with time zone,
  "closed_at" timestamp with time zone,
  "closed_by_user_id" uuid REFERENCES "users"("id"),
  "close_reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "inbound_orders" ADD COLUMN IF NOT EXISTS "supplier_id" uuid
  REFERENCES "suppliers"("id") ON DELETE SET NULL;
ALTER TABLE "inbound_orders" ADD COLUMN IF NOT EXISTS "customer_id" uuid
  REFERENCES "customers"("id") ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "inbound_org_ref_uq" ON "inbound_orders" ("organization_id", "reference");

CREATE TABLE IF NOT EXISTS "inbound_lines" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "inbound_order_id" uuid NOT NULL REFERENCES "inbound_orders"("id") ON DELETE CASCADE,
  "product_id" uuid NOT NULL REFERENCES "products"("id"),
  "qty_expected" integer NOT NULL,
  "qty_received" integer DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS "outbound_orders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "warehouse_id" uuid NOT NULL REFERENCES "warehouses"("id"),
  "reference" text NOT NULL,
  "customer" text,
  "customer_id" uuid REFERENCES "customers"("id") ON DELETE SET NULL,
  "status" "outbound_status" DEFAULT 'draft' NOT NULL,
  "ship_by" timestamp with time zone,
  "shipped_at" timestamp with time zone,
  "packed_at" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  "cancel_reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "outbound_orders" ADD COLUMN IF NOT EXISTS "customer_id" uuid
  REFERENCES "customers"("id") ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "outbound_org_ref_uq" ON "outbound_orders" ("organization_id", "reference");

CREATE TABLE IF NOT EXISTS "outbound_lines" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "outbound_order_id" uuid NOT NULL REFERENCES "outbound_orders"("id") ON DELETE CASCADE,
  "product_id" uuid NOT NULL REFERENCES "products"("id"),
  "qty_ordered" integer NOT NULL,
  "qty_picked" integer DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS "picks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "outbound_line_id" uuid NOT NULL REFERENCES "outbound_lines"("id") ON DELETE CASCADE,
  "pallet_id" uuid REFERENCES "pallets"("id") ON DELETE SET NULL,
  "from_location_id" uuid REFERENCES "locations"("id"),
  "qty" integer NOT NULL,
  "assigned_user_id" uuid REFERENCES "users"("id"),
  "completed_at" timestamp with time zone,
  "sequence" integer DEFAULT 0 NOT NULL
);
CREATE INDEX IF NOT EXISTS "picks_outbound_idx" ON "picks" ("outbound_line_id");
CREATE INDEX IF NOT EXISTS "picks_assigned_idx" ON "picks" ("assigned_user_id");

CREATE TABLE IF NOT EXISTS "shipments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "outbound_order_id" uuid NOT NULL REFERENCES "outbound_orders"("id") ON DELETE CASCADE,
  "bol_number" text NOT NULL,
  "carrier" text,
  "tracking_number" text,
  "shipped_at" timestamp with time zone DEFAULT now() NOT NULL,
  "shipped_by_user_id" uuid REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "shipments_org_bol_uq" ON "shipments" ("organization_id", "bol_number");
CREATE INDEX IF NOT EXISTS "shipments_org_order_idx" ON "shipments" ("organization_id", "outbound_order_id");

CREATE TABLE IF NOT EXISTS "movements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "pallet_id" uuid NOT NULL REFERENCES "pallets"("id") ON DELETE CASCADE,
  "from_location_id" uuid REFERENCES "locations"("id"),
  "to_location_id" uuid REFERENCES "locations"("id"),
  "reason" "movement_reason" NOT NULL,
  "user_id" uuid REFERENCES "users"("id"),
  "ref_type" text,
  "ref_id" uuid,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "movements_pallet_idx" ON "movements" ("pallet_id");
CREATE INDEX IF NOT EXISTS "movements_org_created_idx" ON "movements" ("organization_id", "created_at");

CREATE TABLE IF NOT EXISTS "label_codes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "code" text NOT NULL,
  "kind" "label_kind" NOT NULL,
  "pallet_id" uuid REFERENCES "pallets"("id") ON DELETE CASCADE,
  "location_id" uuid REFERENCES "locations"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "label_codes_code_uq" ON "label_codes" ("code");
CREATE INDEX IF NOT EXISTS "label_codes_org_idx" ON "label_codes" ("organization_id");

CREATE TABLE IF NOT EXISTS "quickbooks_connections" (
  "organization_id" uuid PRIMARY KEY REFERENCES "organizations"("id") ON DELETE CASCADE,
  "realm_id" text NOT NULL,
  "access_token" text NOT NULL,
  "refresh_token" text NOT NULL,
  "access_token_expires_at" timestamp with time zone NOT NULL,
  "refresh_token_expires_at" timestamp with time zone NOT NULL,
  "product_item_map" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "connected_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "quickbooks_exports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "source_type" text NOT NULL,
  "source_id" uuid NOT NULL,
  "qbo_entity_type" text NOT NULL,
  "qbo_entity_id" text NOT NULL,
  "status" text DEFAULT 'success' NOT NULL,
  "error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "qb_exports_org_source_idx" ON "quickbooks_exports" ("organization_id", "source_type", "source_id");

CREATE TABLE IF NOT EXISTS "cycle_counts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "warehouse_id" uuid NOT NULL REFERENCES "warehouses"("id") ON DELETE CASCADE,
  "location_id" uuid NOT NULL REFERENCES "locations"("id") ON DELETE CASCADE,
  "status" "cycle_count_status" DEFAULT 'open' NOT NULL,
  "assigned_user_id" uuid REFERENCES "users"("id"),
  "due_at" timestamp with time zone,
  "submitted_at" timestamp with time zone,
  "approved_at" timestamp with time zone,
  "approved_by_user_id" uuid REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "cycle_counts_org_idx" ON "cycle_counts" ("organization_id");
CREATE INDEX IF NOT EXISTS "cycle_counts_status_idx" ON "cycle_counts" ("organization_id", "status");

CREATE TABLE IF NOT EXISTS "quickbooks_webhook_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid REFERENCES "organizations"("id") ON DELETE CASCADE,
  "realm_id" text NOT NULL,
  "entity_name" text NOT NULL,
  "entity_id" text NOT NULL,
  "operation" text NOT NULL,
  "last_updated" timestamp with time zone,
  "raw_payload" jsonb NOT NULL,
  "received_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "qb_wh_org_idx" ON "quickbooks_webhook_events" ("organization_id", "received_at");
CREATE INDEX IF NOT EXISTS "qb_wh_realm_idx" ON "quickbooks_webhook_events" ("realm_id", "received_at");
CREATE INDEX IF NOT EXISTS "qb_wh_entity_idx" ON "quickbooks_webhook_events" ("realm_id", "entity_name", "entity_id");

CREATE TABLE IF NOT EXISTS "cycle_count_lines" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "cycle_count_id" uuid NOT NULL REFERENCES "cycle_counts"("id") ON DELETE CASCADE,
  "pallet_item_id" uuid NOT NULL REFERENCES "pallet_items"("id") ON DELETE CASCADE,
  "expected_qty" integer NOT NULL,
  "counted_qty" integer,
  "notes" text
);
CREATE INDEX IF NOT EXISTS "cycle_count_lines_cc_idx" ON "cycle_count_lines" ("cycle_count_id");

-- locations self-FK (parent)
DO $$ BEGIN
  ALTER TABLE "locations" ADD CONSTRAINT "locations_parent_id_fk"
    FOREIGN KEY ("parent_id") REFERENCES "locations"("id");
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- NOTE: RLS skipped for preview. App-layer tenant scoping in tRPC
-- still enforces isolation (every procedure filters by orgId). Re-enable
-- RLS by applying migrations/0001_rls.sql once tRPC sets
-- `SET LOCAL app.org_id` per transaction.

-- 0010_qty_unit: unit of measure on order lines (pallets/cases/eaches).
DO $$ BEGIN
  CREATE TYPE "qty_unit" AS ENUM ('each', 'case', 'pallet');
EXCEPTION WHEN duplicate_object THEN null; END $$;
ALTER TABLE "inbound_lines"
  ADD COLUMN IF NOT EXISTS "qty_unit" "qty_unit" NOT NULL DEFAULT 'each';
ALTER TABLE "outbound_lines"
  ADD COLUMN IF NOT EXISTS "qty_unit" "qty_unit" NOT NULL DEFAULT 'each';
