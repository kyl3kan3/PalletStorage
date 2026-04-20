-- Row-Level Security: defense-in-depth on top of application-level
-- tenant scoping. Every request should set `app.org_id` for the
-- transaction via `SET LOCAL app.org_id = '<uuid>'`. If it isn't set,
-- the policy returns zero rows, so a forgotten org filter fails closed.
--
-- We use the `wms_app` role for application connections and bypass RLS
-- for a separate `wms_migrate` / superuser role used by migrations and
-- the drizzle studio.

-- helper: safely read app.org_id as uuid, NULL if unset or malformed
CREATE OR REPLACE FUNCTION current_org_id() RETURNS uuid
LANGUAGE plpgsql STABLE AS $$
DECLARE v text;
BEGIN
  v := current_setting('app.org_id', true);
  IF v IS NULL OR v = '' THEN RETURN NULL; END IF;
  BEGIN RETURN v::uuid; EXCEPTION WHEN others THEN RETURN NULL; END;
END $$;

-- enable RLS + add tenant policy on every table that has organization_id
DO $$
DECLARE t text;
DECLARE tables text[] := ARRAY[
  'warehouses','locations','products','pallets','pallet_items',
  'inbound_orders','inbound_lines','outbound_orders','outbound_lines','picks',
  'movements','label_codes','quickbooks_connections','quickbooks_exports'
];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (organization_id = current_org_id()) WITH CHECK (organization_id = current_org_id())',
      t
    );
  END LOOP;
END $$;

-- memberships don't have an organization_id column per se, but the FK is.
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON memberships
  USING (organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());

-- organizations + users intentionally do not have per-tenant RLS —
-- organizations is keyed by clerk_org_id and is used during provisioning
-- before any org context exists; users is global and referenced by
-- memberships.
