UPDATE inventory_balance ib
SET inventory_item_id = ii.item_id
FROM inventory_item ii
WHERE ii.tenant_id = ib.tenant_id
  AND ii.variant_id = (
    SELECT av.variant_id FROM article_variant av
    WHERE av.article_id = ib.article_id
    LIMIT 1
  )
  AND ib.inventory_item_id IS NULL;
--> statement-breakpoint
ALTER TABLE "inventory_balance" DROP CONSTRAINT "inventory_balance_tenant_id_warehouse_id_article_id_unique";--> statement-breakpoint
ALTER TABLE "inventory_balance" ALTER COLUMN "article_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_balance" ADD CONSTRAINT "inventory_balance_tenant_id_warehouse_id_item_unique" UNIQUE("tenant_id","warehouse_id","inventory_item_id");--> statement-breakpoint
ALTER TABLE "inventory_balance" ADD CONSTRAINT "inventory_balance_article_id_article_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "article"("article_id");