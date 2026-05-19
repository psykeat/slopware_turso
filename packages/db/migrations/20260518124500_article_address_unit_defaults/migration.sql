ALTER TABLE "address_category"
  ADD COLUMN "tax_class_id" uuid REFERENCES "tax_class"("tax_class_id"),
  ADD COLUMN "payment_term_id" uuid REFERENCES "payment_term"("payment_term_id"),
  ADD COLUMN "currency_id" char(3);

ALTER TABLE "article_group"
  ADD COLUMN "tax_class_id" uuid REFERENCES "tax_class"("tax_class_id"),
  ADD COLUMN "base_unit_id" uuid REFERENCES "unit"("unit_id"),
  ADD COLUMN "sales_unit_id" uuid REFERENCES "unit"("unit_id"),
  ADD COLUMN "purchase_unit_id" uuid REFERENCES "unit"("unit_id"),
  ADD COLUMN "tracking_mode" text,
  ADD COLUMN "bom_type" text NOT NULL DEFAULT 'none';

ALTER TABLE "article"
  ADD COLUMN "base_unit_id" uuid REFERENCES "unit"("unit_id"),
  ADD COLUMN "sales_unit_id" uuid REFERENCES "unit"("unit_id"),
  ADD COLUMN "purchase_unit_id" uuid REFERENCES "unit"("unit_id");

UPDATE "article" AS a
SET "base_unit_id" = u."unit_id"
FROM "unit" AS u
WHERE a."tenant_id" = u."tenant_id"
  AND a."base_unit" = u."code";

UPDATE "article" AS a
SET "sales_unit_id" = u."unit_id"
FROM "unit" AS u
WHERE a."tenant_id" = u."tenant_id"
  AND a."sales_unit" = u."code";

UPDATE "article" AS a
SET "purchase_unit_id" = u."unit_id"
FROM "unit" AS u
WHERE a."tenant_id" = u."tenant_id"
  AND a."purchase_unit" = u."code";

ALTER TABLE "address" DROP COLUMN IF EXISTS "address_type";
DROP INDEX IF EXISTS "idx_address_type";
ALTER TABLE "address" DROP COLUMN IF EXISTS "bank_account_id";

ALTER TABLE "article" DROP COLUMN IF EXISTS "base_unit";
ALTER TABLE "article" DROP COLUMN IF EXISTS "sales_unit";
ALTER TABLE "article" DROP COLUMN IF EXISTS "purchase_unit";
