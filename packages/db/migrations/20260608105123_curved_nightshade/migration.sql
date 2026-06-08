CREATE TYPE "ecommerce_platform" AS ENUM('shopify', 'shopware6', 'woocommerce', 'prestashop');--> statement-breakpoint
CREATE TYPE "external_sync_direction" AS ENUM('push', 'pull', 'bidirectional');--> statement-breakpoint
CREATE TYPE "external_sync_entity_type" AS ENUM('article', 'article_variant', 'document', 'document_line', 'inventory_item', 'inventory_level', 'media_asset', 'customer', 'customer_address', 'category', 'price_list', 'shipment');--> statement-breakpoint
CREATE TYPE "external_sync_status" AS ENUM('pending', 'success', 'error');--> statement-breakpoint
CREATE TABLE "article_option" (
	"option_id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"tenant_id" uuid NOT NULL,
	"article_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "article_option_value" (
	"value_id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"tenant_id" uuid NOT NULL,
	"option_id" uuid NOT NULL,
	"value" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "article_variant" (
	"variant_id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"tenant_id" uuid NOT NULL,
	"article_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"ean" text,
	"option_value_hash" text NOT NULL,
	"price" numeric,
	"weight" numeric,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_article_variant_sku" UNIQUE("tenant_id","sku"),
	CONSTRAINT "uq_article_variant_option_hash" UNIQUE("tenant_id","article_id","option_value_hash")
);
--> statement-breakpoint
CREATE TABLE "article_variant_option_value" (
	"tenant_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"value_id" uuid NOT NULL,
	CONSTRAINT "uq_variant_optval" UNIQUE("variant_id","value_id")
);
--> statement-breakpoint
CREATE TABLE "category" (
	"category_id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"tenant_id" uuid NOT NULL,
	"parent_category_id" uuid,
	"code" text,
	"name" text NOT NULL,
	"slug" text,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "category_tenant_id_category_id_key" UNIQUE("tenant_id","category_id"),
	CONSTRAINT "category_tenant_id_code_unique" UNIQUE("tenant_id","code"),
	CONSTRAINT "category_tenant_id_slug_unique" UNIQUE("tenant_id","slug")
);
--> statement-breakpoint
CREATE TABLE "article_category" (
	"article_category_id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"tenant_id" uuid NOT NULL,
	"article_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "article_category_tenant_id_article_category_id_key" UNIQUE("tenant_id","article_category_id"),
	CONSTRAINT "article_category_tenant_id_article_category_unique" UNIQUE("tenant_id","article_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "media_asset" (
	"media_asset_id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"tenant_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_size" integer,
	"width" integer,
	"height" integer,
	"alt_text" text,
	"checksum" text,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_asset_tenant_id_media_asset_id_key" UNIQUE("tenant_id","media_asset_id"),
	CONSTRAINT "media_asset_tenant_id_storage_key_unique" UNIQUE("tenant_id","storage_key")
);
--> statement-breakpoint
CREATE TABLE "article_media" (
	"article_media_id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"tenant_id" uuid NOT NULL,
	"article_id" uuid NOT NULL,
	"variant_id" uuid,
	"media_asset_id" uuid NOT NULL,
	"role" text DEFAULT 'gallery' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "article_media_tenant_id_article_media_id_key" UNIQUE("tenant_id","article_media_id"),
	CONSTRAINT "article_media_tenant_id_article_media_unique" UNIQUE("tenant_id","article_id","variant_id","media_asset_id","role")
);
--> statement-breakpoint
CREATE TABLE "external_sync_mapping" (
	"mapping_id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"tenant_id" uuid NOT NULL,
	"sales_channel_id" uuid NOT NULL,
	"entity_type" "external_sync_entity_type" NOT NULL,
	"internal_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"external_parent_id" text,
	"external_version" text,
	"sync_direction" "external_sync_direction" NOT NULL,
	"payload_snapshot" jsonb,
	"last_sync_at" timestamp with time zone,
	"sync_status" "external_sync_status" DEFAULT 'pending'::"external_sync_status" NOT NULL,
	"error_log" text,
	"deleted_at" timestamp with time zone,
	"external_deleted_at" timestamp with time zone,
	CONSTRAINT "uq_ext_sync_internal" UNIQUE("tenant_id","sales_channel_id","entity_type","internal_id"),
	CONSTRAINT "uq_ext_sync_external" UNIQUE("tenant_id","sales_channel_id","entity_type","external_id")
);
--> statement-breakpoint
CREATE TABLE "inventory_item" (
	"item_id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"tenant_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"tracked" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_level" (
	"level_id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"tenant_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"quantity" numeric DEFAULT '0' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_inv_level_loc" UNIQUE("item_id","location_id")
);
--> statement-breakpoint
CREATE TABLE "sales_channel" (
	"sales_channel_id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"platform" "ecommerce_platform" NOT NULL,
	"api_url" text NOT NULL,
	"credentials" jsonb,
	"master_data_policy" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_article_option_tenant" ON "article_option" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_article_option_article" ON "article_option" ("article_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_article_option_name" ON "article_option" ("tenant_id","article_id","name");--> statement-breakpoint
CREATE INDEX "idx_article_optval_tenant" ON "article_option_value" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_article_optval_option" ON "article_option_value" ("option_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_article_option_value" ON "article_option_value" ("tenant_id","option_id","value");--> statement-breakpoint
CREATE INDEX "idx_article_variant_tenant" ON "article_variant" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_article_variant_article" ON "article_variant" ("article_id");--> statement-breakpoint
CREATE INDEX "idx_variant_optval_tenant" ON "article_variant_option_value" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_variant_optval_variant" ON "article_variant_option_value" ("variant_id");--> statement-breakpoint
CREATE INDEX "idx_category_tenant" ON "category" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_category_parent" ON "category" ("tenant_id","parent_category_id");--> statement-breakpoint
CREATE INDEX "idx_category_tenant_archived" ON "category" ("tenant_id","archived");--> statement-breakpoint
CREATE INDEX "idx_article_category_tenant_article" ON "article_category" ("tenant_id","article_id");--> statement-breakpoint
CREATE INDEX "idx_article_category_tenant_category" ON "article_category" ("tenant_id","category_id");--> statement-breakpoint
CREATE INDEX "idx_media_asset_tenant" ON "media_asset" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_media_asset_tenant_archived" ON "media_asset" ("tenant_id","archived");--> statement-breakpoint
CREATE INDEX "idx_article_media_tenant_article" ON "article_media" ("tenant_id","article_id");--> statement-breakpoint
CREATE INDEX "idx_article_media_tenant_variant" ON "article_media" ("tenant_id","variant_id");--> statement-breakpoint
CREATE INDEX "idx_article_media_tenant_asset" ON "article_media" ("tenant_id","media_asset_id");--> statement-breakpoint
CREATE INDEX "idx_ext_sync_tenant" ON "external_sync_mapping" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_inv_item_tenant" ON "inventory_item" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_inv_item_variant" ON "inventory_item" ("variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_inv_item_variant" ON "inventory_item" ("tenant_id","variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_inv_item_sku" ON "inventory_item" ("tenant_id","sku");--> statement-breakpoint
CREATE INDEX "idx_inv_level_tenant" ON "inventory_level" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_inv_level_item" ON "inventory_level" ("item_id");--> statement-breakpoint
CREATE INDEX "idx_sales_channel_tenant" ON "sales_channel" ("tenant_id");--> statement-breakpoint
ALTER TABLE "article_option" ADD CONSTRAINT "article_option_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "article_option" ADD CONSTRAINT "article_option_article_id_article_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "article"("article_id");--> statement-breakpoint
ALTER TABLE "article_option_value" ADD CONSTRAINT "article_option_value_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "article_option_value" ADD CONSTRAINT "article_option_value_option_id_article_option_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "article_option"("option_id");--> statement-breakpoint
ALTER TABLE "article_variant" ADD CONSTRAINT "article_variant_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "article_variant" ADD CONSTRAINT "article_variant_article_id_article_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "article"("article_id");--> statement-breakpoint
ALTER TABLE "article_variant_option_value" ADD CONSTRAINT "article_variant_option_value_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "article_variant_option_value" ADD CONSTRAINT "article_variant_option_value_aJeZSjZ81KEZ_fkey" FOREIGN KEY ("variant_id") REFERENCES "article_variant"("variant_id");--> statement-breakpoint
ALTER TABLE "article_variant_option_value" ADD CONSTRAINT "article_variant_option_value_B21qBBsc7n6B_fkey" FOREIGN KEY ("value_id") REFERENCES "article_option_value"("value_id");--> statement-breakpoint
ALTER TABLE "category" ADD CONSTRAINT "category_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "article_category" ADD CONSTRAINT "article_category_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "article_category" ADD CONSTRAINT "article_category_article_id_article_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "article"("article_id");--> statement-breakpoint
ALTER TABLE "article_category" ADD CONSTRAINT "article_category_category_id_category_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("category_id");--> statement-breakpoint
ALTER TABLE "media_asset" ADD CONSTRAINT "media_asset_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "article_media" ADD CONSTRAINT "article_media_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "article_media" ADD CONSTRAINT "article_media_article_id_article_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "article"("article_id");--> statement-breakpoint
ALTER TABLE "article_media" ADD CONSTRAINT "article_media_variant_id_article_variant_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "article_variant"("variant_id");--> statement-breakpoint
ALTER TABLE "article_media" ADD CONSTRAINT "article_media_media_asset_id_media_asset_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_asset"("media_asset_id");--> statement-breakpoint
ALTER TABLE "external_sync_mapping" ADD CONSTRAINT "external_sync_mapping_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "external_sync_mapping" ADD CONSTRAINT "external_sync_mapping_kfbjm0sEVA9n_fkey" FOREIGN KEY ("sales_channel_id") REFERENCES "sales_channel"("sales_channel_id");--> statement-breakpoint
ALTER TABLE "inventory_item" ADD CONSTRAINT "inventory_item_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "inventory_item" ADD CONSTRAINT "inventory_item_variant_id_article_variant_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "article_variant"("variant_id");--> statement-breakpoint
ALTER TABLE "inventory_level" ADD CONSTRAINT "inventory_level_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "inventory_level" ADD CONSTRAINT "inventory_level_item_id_inventory_item_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_item"("item_id");--> statement-breakpoint
ALTER TABLE "inventory_level" ADD CONSTRAINT "inventory_level_location_id_warehouse_warehouse_id_fkey" FOREIGN KEY ("location_id") REFERENCES "warehouse"("warehouse_id");--> statement-breakpoint
ALTER TABLE "sales_channel" ADD CONSTRAINT "sales_channel_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "document_line" ADD COLUMN "variant_id" uuid;--> statement-breakpoint
ALTER TABLE "document_line" ADD CONSTRAINT "document_line_variant_id_article_variant_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "article_variant"("variant_id");--> statement-breakpoint
CREATE INDEX "idx_document_line_variant" ON "document_line" ("variant_id");--> statement-breakpoint
ALTER TABLE "price_list_item" ADD COLUMN "variant_id" uuid;--> statement-breakpoint
ALTER TABLE "price_list_item" ADD CONSTRAINT "price_list_item_variant_id_article_variant_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "article_variant"("variant_id");--> statement-breakpoint
ALTER TABLE "price_list_item" DROP CONSTRAINT "price_list_item_tenant_id_price_list_id_article_id_valid_from_u";--> statement-breakpoint
ALTER TABLE "price_list_item" ADD CONSTRAINT "price_list_item_tenant_id_price_list_id_article_variant_valid_from_u" UNIQUE("tenant_id","price_list_id","article_id","variant_id","valid_from");--> statement-breakpoint
DROP INDEX "idx_price_list_item_lookup";--> statement-breakpoint
CREATE INDEX "idx_price_list_item_lookup" ON "price_list_item" ("price_list_id","article_id","variant_id","valid_from");--> statement-breakpoint
ALTER TABLE "inventory_movement" ADD COLUMN "variant_id" uuid;--> statement-breakpoint
ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_variant_id_article_variant_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "article_variant"("variant_id");--> statement-breakpoint
CREATE INDEX "idx_inv_movement_variant" ON "inventory_movement" ("tenant_id","variant_id","movement_date");
