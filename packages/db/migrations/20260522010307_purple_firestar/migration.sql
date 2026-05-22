ALTER TABLE "document_line" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "document_line" DROP CONSTRAINT "document_line_tenant_id_document_id_line_no_unique";--> statement-breakpoint
ALTER TABLE "document_line" ADD CONSTRAINT "document_line_tenant_id_document_id_line_no_unique" UNIQUE("tenant_id","document_id","line_no","archived_at");--> statement-breakpoint
CREATE INDEX "idx_document_line_tenant_document" ON "document_line" ("tenant_id","document_id");--> statement-breakpoint
CREATE INDEX "idx_document_line_tenant_archived" ON "document_line" ("tenant_id","archived_at");--> statement-breakpoint
CREATE INDEX "idx_document_line_tracking_tenant_line" ON "document_line_tracking" ("tenant_id","document_line_id");--> statement-breakpoint
CREATE INDEX "idx_document_line_tracking_tenant_created" ON "document_line_tracking" ("tenant_id","document_line_id","created_at");