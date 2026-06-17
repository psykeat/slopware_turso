ALTER TABLE "document_line" ADD COLUMN "tax_reason" text;--> statement-breakpoint
ALTER TABLE "document_line" ADD COLUMN "tax_rule_id" uuid;--> statement-breakpoint
ALTER TABLE "document_line" ADD COLUMN "tax_country_code_used" varchar(2);--> statement-breakpoint
ALTER TABLE "document_line" ADD COLUMN "tax_rate_snapshot" numeric;--> statement-breakpoint
ALTER TABLE "document_line" ADD CONSTRAINT "document_line_tax_rule_id_tax_rule_tax_rule_id_fkey" FOREIGN KEY ("tax_rule_id") REFERENCES "tax_rule"("tax_rule_id");
