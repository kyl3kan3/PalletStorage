-- Two small additions that came up during ops walkthrough:
--
-- 1. Products no longer require a SKU. Operators often onboard
--    receipts and invoices whose catalogue isn't in-system yet
--    (branded finished goods, customer-provided line items). The
--    unique index on (organization_id, sku) is safe to keep because
--    Postgres treats NULLs as distinct, so multiple null-SKU products
--    can coexist per tenant.
-- 2. Inbound orders get a receiving_location_id — which dock door /
--    staging bin the shipment is expected at. Optional; on receive,
--    pallets default their currentLocationId to this value if the
--    receiver doesn't scan a different bin.

ALTER TABLE "products" ALTER COLUMN "sku" DROP NOT NULL;

ALTER TABLE "inbound_orders" ADD COLUMN IF NOT EXISTS "receiving_location_id" uuid
  REFERENCES "locations"("id") ON DELETE SET NULL;
