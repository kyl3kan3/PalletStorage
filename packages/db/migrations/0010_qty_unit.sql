-- Order lines carry a unit of measure alongside the numeric quantity
-- so operators can say "5 pallets" or "50 cases" instead of having to
-- translate everything into eaches at data-entry time. Default 'each'
-- preserves the meaning of existing rows.

DO $$ BEGIN
  CREATE TYPE "qty_unit" AS ENUM ('each', 'case', 'pallet');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "inbound_lines"
  ADD COLUMN IF NOT EXISTS "qty_unit" "qty_unit" NOT NULL DEFAULT 'each';

ALTER TABLE "outbound_lines"
  ADD COLUMN IF NOT EXISTS "qty_unit" "qty_unit" NOT NULL DEFAULT 'each';
