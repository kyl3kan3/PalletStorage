-- Phase 1 of the location-management feature.
--
-- Rack locations now carry their structural coordinates (aisle letter,
-- bay number, level number, position number) so the bulk generator can
-- recreate idempotent canonical codes and later queries can slice by
-- aisle for things like picking paths and reports.
--
-- mapX/mapY are reserved for phase 2 (clickable PDF map). Nullable
-- until an operator drops a pin.
--
-- Warehouses get an optional map_pdf_url so each site can upload /
-- link its floor plan and render it in the map viewer.

ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "aisle" text;
ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "bay" integer;
ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "level" integer;
ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "position" integer;
ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "map_x" numeric(10,3);
ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "map_y" numeric(10,3);

ALTER TABLE "warehouses" ADD COLUMN IF NOT EXISTS "map_pdf_url" text;
