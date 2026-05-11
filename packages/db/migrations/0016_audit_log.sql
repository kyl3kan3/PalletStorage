-- 0016_audit_log.sql
-- Append-only audit trail for sensitive mutations (order close/cancel,
-- customer delete, billing-rate changes). Captures who did what, when,
-- with optional structured metadata. Keyed by organization for tenancy.

CREATE TABLE IF NOT EXISTS "audit_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "action" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" uuid,
  "metadata" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "audit_log_org_created_idx"
  ON "audit_log" ("organization_id", "created_at" DESC);

-- Mirror the tenant-isolation policy from 0001_rls.sql.
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_log" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "audit_log"
  USING (organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());
