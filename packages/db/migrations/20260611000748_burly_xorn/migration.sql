CREATE TABLE "article_variant_template" (
	"template_id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"tenant_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"article_group_id" uuid,
	"definition" jsonb NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "uq_article_variant_template_slug" UNIQUE("tenant_id","slug")
);
--> statement-breakpoint
CREATE INDEX "idx_article_variant_template_tenant" ON "article_variant_template" ("tenant_id");--> statement-breakpoint
ALTER TABLE "article_variant_template" ADD CONSTRAINT "article_variant_template_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "article_variant_template" ADD CONSTRAINT "article_variant_template_xv1VaitoLXiS_fkey" FOREIGN KEY ("article_group_id") REFERENCES "article_group"("article_group_id");