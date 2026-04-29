-- Per-customer billing rates for the monthly storage statement.
-- All in integer cents to match the unit_price_cents convention on
-- products. Nullable so a customer without rates can still exist —
-- the billing report flags them and refuses QB export until they're
-- set.

ALTER TABLE "customers"
  ADD COLUMN IF NOT EXISTS "storage_rate_cents_per_pallet_month" integer;
ALTER TABLE "customers"
  ADD COLUMN IF NOT EXISTS "receive_rate_cents_per_pallet" integer;
ALTER TABLE "customers"
  ADD COLUMN IF NOT EXISTS "ship_rate_cents_per_pallet" integer;
