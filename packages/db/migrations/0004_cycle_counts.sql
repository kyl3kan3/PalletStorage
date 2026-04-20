CREATE TYPE "public"."cycle_count_status" AS ENUM(
  'draft', 'open', 'counting', 'reviewing', 'closed', 'cancelled'
);
--> statement-breakpoint

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
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cycle_counts_org_idx" ON "cycle_counts" ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cycle_counts_status_idx" ON "cycle_counts" ("organization_id", "status");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "cycle_count_lines" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "cycle_count_id" uuid NOT NULL REFERENCES "cycle_counts"("id") ON DELETE CASCADE,
  "pallet_item_id" uuid NOT NULL REFERENCES "pallet_items"("id") ON DELETE CASCADE,
  "expected_qty" integer NOT NULL,
  "counted_qty" integer,
  "notes" text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cycle_count_lines_cc_idx" ON "cycle_count_lines" ("cycle_count_id");
--> statement-breakpoint

-- Tenant RLS on the new tables.
ALTER TABLE "cycle_counts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "cycle_counts" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "cycle_counts"
  USING (organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());
--> statement-breakpoint

ALTER TABLE "cycle_count_lines" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "cycle_count_lines" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "cycle_count_lines"
  USING (organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());
