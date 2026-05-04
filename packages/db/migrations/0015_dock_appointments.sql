-- 0015_dock_appointments.sql
-- Dock-scheduling layer. A 3PL operator schedules trucks for both
-- inbound deliveries and outbound pickups. The appointment is the
-- top-of-funnel record: a truck calls, we schedule, we assign a door
-- on arrival, we link to the inbound/outbound order being worked.
--
-- Also adds shipping_location_id to outbound_orders so outbound has
-- the same "which dock door does this go through" field that inbound
-- already has via receiving_location_id.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_type') THEN
    CREATE TYPE "appointment_type" AS ENUM ('inbound', 'outbound');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_status') THEN
    CREATE TYPE "appointment_status" AS ENUM (
      'scheduled', 'at_dock', 'in_progress', 'completed', 'cancelled'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "dock_appointments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "warehouse_id" uuid NOT NULL REFERENCES "warehouses"("id"),
  "type" appointment_type NOT NULL,
  "scheduled_at" timestamptz NOT NULL,
  "carrier" text,
  "driver_name" text,
  "driver_phone" text,
  "reference" text,
  "supplier_id" uuid REFERENCES "suppliers"("id") ON DELETE SET NULL,
  "customer_id" uuid REFERENCES "customers"("id") ON DELETE SET NULL,
  "inbound_order_id" uuid REFERENCES "inbound_orders"("id") ON DELETE SET NULL,
  "outbound_order_id" uuid REFERENCES "outbound_orders"("id") ON DELETE SET NULL,
  "dock_location_id" uuid REFERENCES "locations"("id") ON DELETE SET NULL,
  "status" appointment_status NOT NULL DEFAULT 'scheduled',
  "notes" text,
  "arrived_at" timestamptz,
  "completed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "dock_appts_org_scheduled_idx"
  ON "dock_appointments" ("organization_id", "scheduled_at");
CREATE INDEX IF NOT EXISTS "dock_appts_org_status_idx"
  ON "dock_appointments" ("organization_id", "status");

ALTER TABLE "outbound_orders"
  ADD COLUMN IF NOT EXISTS "shipping_location_id" uuid
    REFERENCES "locations"("id") ON DELETE SET NULL;
