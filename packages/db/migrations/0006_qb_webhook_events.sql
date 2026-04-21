-- Inbound QuickBooks webhook audit log. Each row = one entity change
-- (a single webhook POST can fan out to many entities).
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
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "qb_wh_org_idx" ON "quickbooks_webhook_events" ("organization_id", "received_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "qb_wh_realm_idx" ON "quickbooks_webhook_events" ("realm_id", "received_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "qb_wh_entity_idx" ON "quickbooks_webhook_events" ("realm_id", "entity_name", "entity_id");
--> statement-breakpoint

-- Tenant RLS (same pattern as 0001_rls.sql). Because organization_id is
-- nullable here we scope strictly — rows with NULL org are invisible to
-- tenant queries (only the system/migrations role can see them).
ALTER TABLE "quickbooks_webhook_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "quickbooks_webhook_events" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON "quickbooks_webhook_events"
  USING (organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());
