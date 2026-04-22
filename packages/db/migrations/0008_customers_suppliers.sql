-- Customers (3PL clients whose pallets we store) + Suppliers (upstream
-- vendors). Both are optional links from existing order rows; the
-- legacy free-text supplier/customer columns are kept for BOL and
-- receipt display.

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
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_org_name_idx" ON "customers" ("organization_id", "name");
--> statement-breakpoint

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
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "suppliers_org_name_idx" ON "suppliers" ("organization_id", "name");
--> statement-breakpoint

-- FKs on existing rows. Nullable so legacy data keeps working.
ALTER TABLE "pallets" ADD COLUMN IF NOT EXISTS "customer_id" uuid
  REFERENCES "customers"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "inbound_orders" ADD COLUMN IF NOT EXISTS "supplier_id" uuid
  REFERENCES "suppliers"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "inbound_orders" ADD COLUMN IF NOT EXISTS "customer_id" uuid
  REFERENCES "customers"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "outbound_orders" ADD COLUMN IF NOT EXISTS "customer_id" uuid
  REFERENCES "customers"("id") ON DELETE SET NULL;
--> statement-breakpoint

-- Tenant RLS (same pattern as 0001_rls.sql).
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "customers" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "customers"
  USING (organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());
--> statement-breakpoint

ALTER TABLE "suppliers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "suppliers" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "suppliers"
  USING (organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());
