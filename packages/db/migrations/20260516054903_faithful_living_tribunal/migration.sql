CREATE TABLE "document_line_allocation" (
	"allocation_id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"tenant_id" uuid NOT NULL,
	"source_document_line_id" uuid NOT NULL,
	"target_document_line_id" uuid NOT NULL,
	"allocated_qty" numeric NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_line_allocation_source_target_unique" UNIQUE("source_document_line_id","target_document_line_id")
);
--> statement-breakpoint
CREATE INDEX "idx_dla_source" ON "document_line_allocation" ("tenant_id","source_document_line_id");--> statement-breakpoint
CREATE INDEX "idx_dla_target" ON "document_line_allocation" ("tenant_id","target_document_line_id");--> statement-breakpoint
ALTER TABLE "document_line_allocation" ADD CONSTRAINT "document_line_allocation_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "document_line_allocation" ADD CONSTRAINT "document_line_allocation_dCVuONsLnXYE_fkey" FOREIGN KEY ("source_document_line_id") REFERENCES "document_line"("document_line_id");--> statement-breakpoint
ALTER TABLE "document_line_allocation" ADD CONSTRAINT "document_line_allocation_WNEQDo8yk21k_fkey" FOREIGN KEY ("target_document_line_id") REFERENCES "document_line"("document_line_id");