DROP INDEX IF EXISTS "idx_price_list_item_article";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_price_list_item_lookup";--> statement-breakpoint
ALTER TABLE "price_list_item" DROP CONSTRAINT "price_list_item_tenant_id_price_list_id_article_variant_valid_from_u";--> statement-breakpoint
ALTER TABLE "price_list_item" ADD CONSTRAINT "price_list_item_tenant_id_price_list_id_article_variant_valid_from_u" UNIQUE("tenant_id","price_list_id","variant_id","valid_from");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_price_list_item_variant" ON "price_list_item" ("price_list_id","variant_id","valid_from");