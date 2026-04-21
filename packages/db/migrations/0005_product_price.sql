-- Unit price in cents for products, used by the QuickBooks export to compute
-- Bill / Invoice line amounts. Nullable so existing data is preserved.
ALTER TABLE "products" ADD COLUMN "unit_price_cents" integer;
