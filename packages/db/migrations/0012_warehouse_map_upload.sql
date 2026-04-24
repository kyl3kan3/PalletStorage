-- Store uploaded floor-map PDFs inline in Postgres so the user doesn't
-- need to set up a separate blob store just for a one-off floor plan
-- (typically under 3MB). mapPdfUrl still exists for the "paste an
-- external URL" path.

ALTER TABLE "warehouses" ADD COLUMN IF NOT EXISTS "map_pdf_data" bytea;
ALTER TABLE "warehouses" ADD COLUMN IF NOT EXISTS "map_pdf_filename" text;
