CREATE TABLE "document_shipment" (
	"document_shipment_id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"tenant_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"shipment_status" text DEFAULT 'open' NOT NULL,
	"carrier_key" text DEFAULT 'dhl' NOT NULL,
	"carrier_service_key" text DEFAULT 'paket' NOT NULL,
	"tracking_id" text,
	"recipient_name" text NOT NULL,
	"company" text,
	"street" text NOT NULL,
	"house_number" text NOT NULL,
	"postal_code" text NOT NULL,
	"city" text NOT NULL,
	"country_code" char(2) DEFAULT 'DE' NOT NULL,
	"email" text,
	"phone" text,
	"exported_at" timestamp with time zone,
	"label_created_at" timestamp with time zone,
	"shipped_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "uq_document_shipment" UNIQUE("tenant_id","document_id")
);
--> statement-breakpoint
CREATE TABLE "document_shipment_package" (
	"document_shipment_package_id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"tenant_id" uuid NOT NULL,
	"document_shipment_id" uuid NOT NULL,
	"seq" integer DEFAULT 1 NOT NULL,
	"weight_kg" numeric DEFAULT '1.0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_shipment_document" ON "document_shipment" ("document_id");--> statement-breakpoint
CREATE INDEX "idx_shipment_status" ON "document_shipment" ("shipment_status");--> statement-breakpoint
CREATE INDEX "idx_shipment_package_shipment" ON "document_shipment_package" ("document_shipment_id");--> statement-breakpoint
ALTER TABLE "document_shipment" ADD CONSTRAINT "document_shipment_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "document_shipment" ADD CONSTRAINT "document_shipment_document_id_document_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "document"("document_id");--> statement-breakpoint
ALTER TABLE "document_shipment_package" ADD CONSTRAINT "document_shipment_package_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "document_shipment_package" ADD CONSTRAINT "document_shipment_package_vHksuQ1rAens_fkey" FOREIGN KEY ("document_shipment_id") REFERENCES "document_shipment"("document_shipment_id");