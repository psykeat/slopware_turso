CREATE TYPE "seller_tax_registration_type" AS ENUM ('domestic', 'oss', 'foreign_vat');--> statement-breakpoint
CREATE TABLE "seller_tax_registration" (
  "seller_tax_registration_id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "company_id" uuid,
  "country_code" char(2) NOT NULL,
  "vat_id" text,
  "registration_type" "seller_tax_registration_type" NOT NULL,
  "valid_from" date NOT NULL,
  "valid_to" date,
  "archived" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "seller_tax_registration" ADD CONSTRAINT "seller_tax_registration_tenant_id_tenant_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_tax_registration" ADD CONSTRAINT "seller_tax_registration_company_id_company_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_seller_tax_registration_lookup" ON "seller_tax_registration" USING btree ("tenant_id","company_id","country_code","registration_type","valid_from");--> statement-breakpoint
CREATE INDEX "idx_seller_tax_registration_tenant" ON "seller_tax_registration" USING btree ("tenant_id");
