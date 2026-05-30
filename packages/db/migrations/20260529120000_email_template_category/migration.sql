ALTER TABLE "email_template"
  ADD COLUMN IF NOT EXISTS "category" text DEFAULT 'document' NOT NULL;

UPDATE "email_template"
SET "category" = 'document'
WHERE "category" IS NULL OR "category" = '';

ALTER TABLE "email_template"
  DROP CONSTRAINT IF EXISTS "email_template_tenant_code_unique";

ALTER TABLE "email_template"
  ADD CONSTRAINT "email_template_tenant_category_code_unique" UNIQUE("tenant_id", "category", "code");

DROP INDEX IF EXISTS "idx_email_template_tenant";
CREATE INDEX IF NOT EXISTS "idx_email_template_tenant"
  ON "email_template" ("tenant_id", "category");
