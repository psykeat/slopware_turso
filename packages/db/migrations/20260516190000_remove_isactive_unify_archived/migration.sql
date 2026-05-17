-- Remove is_active from all user-CRUD tables; unify on archived boolean.
-- document_type and document_group gain archived (derived from is_active).
-- All other tables already had archived — just drop the redundant is_active.

--> statement-breakpoint
-- document_type: add archived, backfill from is_active, drop is_active
ALTER TABLE "document_type" ADD COLUMN "archived" boolean NOT NULL DEFAULT false;
UPDATE "document_type" SET "archived" = NOT "is_active";
ALTER TABLE "document_type" DROP COLUMN "is_active";

--> statement-breakpoint
-- document_group: add archived, backfill from is_active, drop is_active
ALTER TABLE "document_group" ADD COLUMN "archived" boolean NOT NULL DEFAULT false;
UPDATE "document_group" SET "archived" = NOT COALESCE("is_active", true);
ALTER TABLE "document_group" DROP COLUMN "is_active";

--> statement-breakpoint
-- Drop is_active from all tables that already have archived
ALTER TABLE "company" DROP COLUMN "is_active";
ALTER TABLE "address_category" DROP COLUMN "is_active";
ALTER TABLE "address" DROP COLUMN "is_active";
ALTER TABLE "address_contact" DROP COLUMN "is_active";
ALTER TABLE "article_group" DROP COLUMN "is_active";
ALTER TABLE "article" DROP COLUMN "is_active";
ALTER TABLE "article_bom" DROP COLUMN "is_active";
ALTER TABLE "bank_account" DROP COLUMN "is_active";
ALTER TABLE "cost_center" DROP COLUMN "is_active";
ALTER TABLE "country" DROP COLUMN "is_active";
ALTER TABLE "currency" DROP COLUMN "is_active";
ALTER TABLE "delivery_address" DROP COLUMN "is_active";
ALTER TABLE "discount_group" DROP COLUMN "is_active";
ALTER TABLE "gl_account" DROP COLUMN "is_active";
ALTER TABLE "import_profile" DROP COLUMN "is_active";
ALTER TABLE "industry" DROP COLUMN "is_active";
ALTER TABLE "warehouse" DROP COLUMN "is_active";
ALTER TABLE "payment_term" DROP COLUMN "is_active";
ALTER TABLE "price_list" DROP COLUMN "is_active";
ALTER TABLE "production_order" DROP COLUMN "is_active";
ALTER TABLE "shipping_method" DROP COLUMN "is_active";
ALTER TABLE "tax_class" DROP COLUMN "is_active";
ALTER TABLE "tax_code" DROP COLUMN "is_active";
ALTER TABLE "unit" DROP COLUMN "is_active";

--> statement-breakpoint
-- Update indexes that referenced is_active
DROP INDEX IF EXISTS "idx_company_tenant_active";
CREATE INDEX "idx_company_tenant_archived" ON "company" ("tenant_id", "archived");

DROP INDEX IF EXISTS "idx_article_tenant_active";
CREATE INDEX "idx_article_tenant_archived" ON "article" ("tenant_id", "archived_at");
