ALTER TABLE "journal_line" ADD COLUMN "cost_center_id" uuid;--> statement-breakpoint
ALTER TABLE "journal_line" ADD COLUMN "tax_code_id" uuid;--> statement-breakpoint
ALTER TABLE "journal_line" ADD CONSTRAINT "journal_line_cost_center_id_cost_center_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "cost_center"("cost_center_id");--> statement-breakpoint
ALTER TABLE "journal_line" ADD CONSTRAINT "journal_line_tax_code_id_tax_code_tax_code_id_fkey" FOREIGN KEY ("tax_code_id") REFERENCES "tax_code"("tax_code_id");--> statement-breakpoint
CREATE TABLE "accounting_export_batch" (
	"batch_id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"tenant_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"fiscal_period_id" uuid NOT NULL,
	"status" text NOT NULL DEFAULT 'pending',
	"row_count" integer NOT NULL DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"exported_at" timestamp with time zone,
	"created_by" uuid,
	CONSTRAINT "accounting_export_batch_period_company" UNIQUE("tenant_id","fiscal_period_id","company_id"),
	CONSTRAINT "chk_accounting_export_batch_status" CHECK (status IN ('pending', 'exported', 'failed'))
);--> statement-breakpoint
CREATE TABLE "accounting_export_row" (
	"row_id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"batch_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"posting_date" date NOT NULL,
	"gl_account_id" uuid NOT NULL,
	"cost_center_id" uuid,
	"tax_code_id" uuid,
	"debit_amount" numeric NOT NULL DEFAULT '0',
	"credit_amount" numeric NOT NULL DEFAULT '0',
	"currency_id" char(3),
	"source_document_id" uuid,
	"source_document_no" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "accounting_export_batch" ADD CONSTRAINT "accounting_export_batch_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "accounting_export_batch" ADD CONSTRAINT "accounting_export_batch_company_id_company_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("company_id");--> statement-breakpoint
ALTER TABLE "accounting_export_batch" ADD CONSTRAINT "accounting_export_batch_fiscal_period_id_fiscal_period_fkey" FOREIGN KEY ("fiscal_period_id") REFERENCES "fiscal_period"("fiscal_period_id");--> statement-breakpoint
ALTER TABLE "accounting_export_row" ADD CONSTRAINT "accounting_export_row_batch_id_accounting_export_batch_fkey" FOREIGN KEY ("batch_id") REFERENCES "accounting_export_batch"("batch_id");--> statement-breakpoint
ALTER TABLE "accounting_export_row" ADD CONSTRAINT "accounting_export_row_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "accounting_export_row" ADD CONSTRAINT "accounting_export_row_company_id_company_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("company_id");--> statement-breakpoint
ALTER TABLE "accounting_export_row" ADD CONSTRAINT "accounting_export_row_gl_account_id_gl_account_fkey" FOREIGN KEY ("gl_account_id") REFERENCES "gl_account"("gl_account_id");--> statement-breakpoint
ALTER TABLE "accounting_export_row" ADD CONSTRAINT "accounting_export_row_cost_center_id_cost_center_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "cost_center"("cost_center_id");--> statement-breakpoint
ALTER TABLE "accounting_export_row" ADD CONSTRAINT "accounting_export_row_tax_code_id_tax_code_fkey" FOREIGN KEY ("tax_code_id") REFERENCES "tax_code"("tax_code_id");--> statement-breakpoint
ALTER TABLE "accounting_export_row" ADD CONSTRAINT "accounting_export_row_source_document_id_document_fkey" FOREIGN KEY ("source_document_id") REFERENCES "document"("document_id");--> statement-breakpoint
CREATE INDEX "idx_accounting_export_batch_tenant" ON "accounting_export_batch" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_accounting_export_batch_period" ON "accounting_export_batch" ("tenant_id","fiscal_period_id");--> statement-breakpoint
CREATE INDEX "idx_accounting_export_row_batch" ON "accounting_export_row" ("batch_id");--> statement-breakpoint
CREATE INDEX "idx_accounting_export_row_tenant" ON "accounting_export_row" ("tenant_id");
