CREATE TABLE "tenant_llm_config" (
	"tenant_llm_config_id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"tenant_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"endpoint_url" text,
	"model" text,
	"api_key" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "uq_tenant_llm_config_company" UNIQUE("tenant_id","company_id")
);
--> statement-breakpoint
CREATE INDEX "idx_tenant_llm_config_tenant" ON "tenant_llm_config" ("tenant_id");--> statement-breakpoint
ALTER TABLE "tenant_llm_config" ADD CONSTRAINT "tenant_llm_config_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "tenant_llm_config" ADD CONSTRAINT "tenant_llm_config_company_id_company_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("company_id");