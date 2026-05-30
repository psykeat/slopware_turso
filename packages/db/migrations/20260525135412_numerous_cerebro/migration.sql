CREATE TABLE "article_image" (
	"article_image_id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"tenant_id" uuid NOT NULL,
	"article_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"width" integer,
	"height" integer,
	"alt_text" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "article_image_tenant_id_image_id_key" UNIQUE("tenant_id","article_image_id")
);
--> statement-breakpoint
ALTER TABLE "article" ADD COLUMN "primary_image_id" uuid;--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "show_article_image_in_entry" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "show_article_image_on_documents" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "document" DROP COLUMN IF EXISTS "notiztext";--> statement-breakpoint
ALTER TABLE "document" DROP COLUMN IF EXISTS "notiztext_source_entity";--> statement-breakpoint
ALTER TABLE "document" DROP COLUMN IF EXISTS "notiztext_source_id";--> statement-breakpoint
ALTER TABLE "document" DROP COLUMN IF EXISTS "notiztext_source_field";--> statement-breakpoint
ALTER TABLE "document" DROP COLUMN IF EXISTS "notiztext_linked_at";--> statement-breakpoint
ALTER TABLE "document" DROP COLUMN IF EXISTS "notiztext_overridden_at";--> statement-breakpoint
ALTER TABLE "document" DROP COLUMN IF EXISTS "vortext";--> statement-breakpoint
ALTER TABLE "document" DROP COLUMN IF EXISTS "vortext_source_entity";--> statement-breakpoint
ALTER TABLE "document" DROP COLUMN IF EXISTS "vortext_source_id";--> statement-breakpoint
ALTER TABLE "document" DROP COLUMN IF EXISTS "vortext_source_field";--> statement-breakpoint
ALTER TABLE "document" DROP COLUMN IF EXISTS "vortext_linked_at";--> statement-breakpoint
ALTER TABLE "document" DROP COLUMN IF EXISTS "vortext_overridden_at";--> statement-breakpoint
ALTER TABLE "document" DROP COLUMN IF EXISTS "nachtext";--> statement-breakpoint
ALTER TABLE "document" DROP COLUMN IF EXISTS "stornotext";--> statement-breakpoint
ALTER TABLE "document" DROP COLUMN IF EXISTS "stornotext_erzeugt_am";--> statement-breakpoint
ALTER TABLE "document" DROP COLUMN IF EXISTS "stornotext_erzeugt_von";--> statement-breakpoint
ALTER TABLE "document" DROP COLUMN IF EXISTS "stornotext_stornogrund";--> statement-breakpoint
CREATE INDEX "idx_article_image_tenant_article" ON "article_image" ("tenant_id","article_id");--> statement-breakpoint
CREATE INDEX "idx_article_image_tenant_archived" ON "article_image" ("tenant_id","archived");--> statement-breakpoint
ALTER TABLE "article_image" ADD CONSTRAINT "article_image_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "article_image" ADD CONSTRAINT "article_image_article_id_article_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "article"("article_id");