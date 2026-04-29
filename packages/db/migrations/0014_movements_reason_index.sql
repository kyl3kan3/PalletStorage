-- The customer-billing query filters movements by (organization_id,
-- reason, created_at) — peak-pallet calc walks every receive + ship
-- in a window per customer. Existing (organization_id, created_at)
-- index helps but doesn't sort by reason; this composite makes the
-- filter cheap as the ledger grows.

CREATE INDEX IF NOT EXISTS "movements_org_reason_created_idx"
  ON "movements" ("organization_id", "reason", "created_at");
