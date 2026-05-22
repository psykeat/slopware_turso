ALTER TABLE "number_sequence" DROP CONSTRAINT "number_sequence_tenant_id_company_id_prefix_unique";--> statement-breakpoint
ALTER TABLE "number_sequence" ADD COLUMN "fiscal_year" integer;--> statement-breakpoint
ALTER TABLE "number_sequence" ADD CONSTRAINT "number_sequence_tenant_id_company_id_prefix_year_unique" UNIQUE("tenant_id","company_id","prefix","fiscal_year");