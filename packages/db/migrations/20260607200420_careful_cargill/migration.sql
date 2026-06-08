CREATE TABLE "address_contact_identity" (
	"identity_id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"tenant_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"source_system" text NOT NULL,
	"source_account_id" uuid,
	"source_object_id" text,
	"identity_type" text NOT NULL,
	"value" text NOT NULL,
	"normalized_value" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "address_contact" ADD COLUMN "display_name" text;--> statement-breakpoint
ALTER TABLE "address_contact" ADD COLUMN "updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "address_contact" ALTER COLUMN "address_id" DROP NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_address_contact_identity_tenant" ON "address_contact_identity" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_address_contact_identity_contact" ON "address_contact_identity" ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_address_contact_identity_value" ON "address_contact_identity" ("value");--> statement-breakpoint
CREATE INDEX "idx_address_contact_identity_normalized" ON "address_contact_identity" ("normalized_value");--> statement-breakpoint
ALTER TABLE "address_contact_identity" ADD CONSTRAINT "address_contact_identity_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "address_contact_identity" ADD CONSTRAINT "address_contact_identity_cO2bFKXgaWii_fkey" FOREIGN KEY ("contact_id") REFERENCES "address_contact"("contact_id");