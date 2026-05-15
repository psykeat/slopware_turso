CREATE TABLE "fact_purchase_event" (
	"fact_purchase_event_id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"tenant_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"source_document_id" uuid,
	"source_document_line_id" uuid,
	"supplier_id" uuid,
	"article_id" uuid,
	"event_type" text DEFAULT 'purchase' NOT NULL,
	"quantity_delta" numeric NOT NULL,
	"amount_net_delta" numeric NOT NULL,
	"avg_cost_before" numeric,
	"avg_cost_after" numeric,
	"fiscal_period_id" uuid,
	"booking_period" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fiscal_period" (
	"fiscal_period_id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"tenant_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"fiscal_year" integer NOT NULL,
	"period_no" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"is_closed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fiscal_period_company_year_period" UNIQUE("company_id","fiscal_year","period_no")
);
--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "is_paid" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "paid_amount" numeric;--> statement-breakpoint
ALTER TABLE "fact_sales_event" ADD COLUMN "cogs_delta" numeric;--> statement-breakpoint
ALTER TABLE "fact_sales_event" ADD COLUMN "fiscal_period_id" uuid;--> statement-breakpoint
CREATE INDEX "idx_fact_purchase_tenant_company" ON "fact_purchase_event" ("tenant_id","company_id");--> statement-breakpoint
CREATE INDEX "idx_fact_purchase_supplier" ON "fact_purchase_event" ("tenant_id","supplier_id");--> statement-breakpoint
CREATE INDEX "idx_fact_purchase_article" ON "fact_purchase_event" ("tenant_id","article_id");--> statement-breakpoint
CREATE INDEX "idx_fact_purchase_period" ON "fact_purchase_event" ("tenant_id","fiscal_period_id");--> statement-breakpoint
CREATE INDEX "idx_fiscal_period_tenant_date" ON "fiscal_period" ("tenant_id","company_id","start_date","end_date");--> statement-breakpoint
ALTER TABLE "fiscal_period" ADD CONSTRAINT "fiscal_period_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "fiscal_period" ADD CONSTRAINT "fiscal_period_company_id_company_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("company_id");