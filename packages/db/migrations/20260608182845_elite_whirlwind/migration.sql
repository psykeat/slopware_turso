--> statement-breakpoint
--> statement-breakpoint
--> statement-breakpoint
--> statement-breakpoint
DROP INDEX IF EXISTS "idx_inv_movement_inventory_anchor";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_inv_movement_lookup";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_inv_movement_warehouse_article";--> statement-breakpoint
ALTER TABLE "document_line" DROP COLUMN "article_id";--> statement-breakpoint
ALTER TABLE "inventory_movement" DROP COLUMN "article_id";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_document_line_article";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_document_line_article" ON "document_line" ("variant_id");--> statement-breakpoint
DROP INDEX IF EXISTS "idx_inv_balance_lookup";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_inv_balance_lookup" ON "inventory_balance" ("tenant_id","warehouse_id","inventory_item_id");--> statement-breakpoint
DROP INDEX IF EXISTS "idx_inventory_movement_batch_balance";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_inventory_movement_batch_balance" ON "inventory_movement" ("tenant_id","warehouse_id","variant_id","batch_no");--> statement-breakpoint
DROP INDEX IF EXISTS "idx_price_list_item_lookup";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_price_list_item_variant" ON "price_list_item" ("price_list_id","variant_id","valid_from");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_fact_sales_variant" ON "fact_sales_event" ("tenant_id","variant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_inv_balance_article" ON "inventory_balance" ("tenant_id","warehouse_id","article_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_inv_movement_inventory_item_anchor" ON "inventory_movement" ("tenant_id","warehouse_id","inventory_item_id","variant_id","movement_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_inv_movement_inventory_item" ON "inventory_movement" ("tenant_id","inventory_item_id","movement_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_inv_movement_variant" ON "inventory_movement" ("tenant_id","variant_id","movement_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_inv_movement_warehouse_inventory_item" ON "inventory_movement" ("tenant_id","warehouse_id","inventory_item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_inventory_movement_batch_balance_item" ON "inventory_movement" ("tenant_id","warehouse_id","inventory_item_id","batch_no");--> statement-breakpoint
