ALTER TABLE "document_line" DROP CONSTRAINT IF EXISTS "chk_article_line_requires_variant_id";--> statement-breakpoint
ALTER TABLE "document_line" DROP CONSTRAINT IF EXISTS "chk_article_line_requires_article_id";--> statement-breakpoint
ALTER TABLE "document_line" ADD CONSTRAINT "chk_article_line_requires_variant_id" CHECK (line_type <> 'article' OR variant_id IS NOT NULL);--> statement-breakpoint

ALTER TABLE "inventory_balance" ADD COLUMN IF NOT EXISTS "inventory_item_id" uuid;--> statement-breakpoint
UPDATE "inventory_balance" AS ib
SET "inventory_item_id" = mapped."item_id"
FROM (
  SELECT DISTINCT ON (av."article_id")
    av."article_id",
    ii."item_id"
  FROM "inventory_item" ii
  INNER JOIN "article_variant" av ON av."variant_id" = ii."variant_id"
  ORDER BY av."article_id", ii."item_id"
) AS mapped
WHERE ib."article_id" = mapped."article_id"
  AND ib."inventory_item_id" IS NULL;--> statement-breakpoint
ALTER TABLE "inventory_balance" DROP CONSTRAINT IF EXISTS "inventory_balance_article_id_article_article_id_fkey";--> statement-breakpoint
ALTER TABLE "inventory_balance" ADD CONSTRAINT "inventory_balance_inventory_item_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_item"("item_id");--> statement-breakpoint
DROP INDEX IF EXISTS "idx_inv_balance_lookup";--> statement-breakpoint
CREATE INDEX "idx_inv_balance_lookup" ON "inventory_balance" ("tenant_id","warehouse_id","inventory_item_id");--> statement-breakpoint
CREATE INDEX "idx_inv_balance_article" ON "inventory_balance" ("tenant_id","warehouse_id","article_id");--> statement-breakpoint

ALTER TABLE "inventory_movement" ADD COLUMN IF NOT EXISTS "inventory_item_id" uuid;--> statement-breakpoint
UPDATE "inventory_movement" AS im
SET "inventory_item_id" = mapped."item_id"
FROM (
  SELECT DISTINCT ON (av."article_id")
    av."article_id",
    ii."item_id"
  FROM "inventory_item" ii
  INNER JOIN "article_variant" av ON av."variant_id" = ii."variant_id"
  ORDER BY av."article_id", ii."item_id"
) AS mapped
WHERE im."article_id" = mapped."article_id"
  AND im."inventory_item_id" IS NULL;--> statement-breakpoint
ALTER TABLE "inventory_movement" DROP CONSTRAINT IF EXISTS "inventory_movement_article_id_article_article_id_fkey";--> statement-breakpoint
ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_inventory_item_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_item"("item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_inv_movement_inventory_item_anchor" ON "inventory_movement" ("tenant_id","warehouse_id","inventory_item_id","variant_id","movement_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_inv_movement_inventory_item" ON "inventory_movement" ("tenant_id","inventory_item_id","movement_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_inv_movement_warehouse_inventory_item" ON "inventory_movement" ("tenant_id","warehouse_id","inventory_item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_inventory_movement_batch_balance_item" ON "inventory_movement" ("tenant_id","warehouse_id","inventory_item_id","batch_no");--> statement-breakpoint
