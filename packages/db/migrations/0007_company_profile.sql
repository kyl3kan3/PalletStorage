-- Company profile fields on organizations. Surfaced in BOL PDFs, QBO
-- exports, and the Settings → Company page. All nullable so existing
-- tenants aren't forced to backfill.
ALTER TABLE "organizations" ADD COLUMN "legal_name" text;
ALTER TABLE "organizations" ADD COLUMN "billing_email" text;
ALTER TABLE "organizations" ADD COLUMN "phone" text;
ALTER TABLE "organizations" ADD COLUMN "tax_id" text;
ALTER TABLE "organizations" ADD COLUMN "address_line1" text;
ALTER TABLE "organizations" ADD COLUMN "address_line2" text;
ALTER TABLE "organizations" ADD COLUMN "city" text;
ALTER TABLE "organizations" ADD COLUMN "region" text;
ALTER TABLE "organizations" ADD COLUMN "postal_code" text;
ALTER TABLE "organizations" ADD COLUMN "country" text;
ALTER TABLE "organizations" ADD COLUMN "timezone" text NOT NULL DEFAULT 'UTC';
ALTER TABLE "organizations" ADD COLUMN "logo_url" text;
