-- Pack hierarchy on products. Lets the order line say "5 pallets" or
-- "50 cases" and have receiving + picking convert those to eaches
-- using the product's own packaging config. Existing rows stay
-- effectively "each-only" because both default to 1.

ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "units_per_case" integer NOT NULL DEFAULT 1;

ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "cases_per_pallet" integer NOT NULL DEFAULT 1;
