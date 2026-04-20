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
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shipments_org_bol_uq" ON "shipments" ("organization_id", "bol_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shipments_org_order_idx" ON "shipments" ("organization_id", "outbound_order_id");
--> statement-breakpoint

-- Extend the tenant RLS policy to shipments (same pattern as 0001_rls.sql).
ALTER TABLE "shipments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "shipments" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "shipments"
  USING (organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());
