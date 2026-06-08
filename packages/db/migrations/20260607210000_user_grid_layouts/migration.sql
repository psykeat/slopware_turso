ALTER TABLE "tenant_layouts" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "tenant_layouts" ADD CONSTRAINT "tenant_layouts_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_layouts_user" ON "tenant_layouts" ("tenant_id", "user_id", "entity_name", "layout_key") WHERE scope = 'user';
