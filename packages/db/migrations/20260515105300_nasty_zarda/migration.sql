ALTER TABLE "bank_account" DROP CONSTRAINT "bank_account_company_id_company_company_id_fkey";--> statement-breakpoint
ALTER TABLE "bank_account" DROP CONSTRAINT "chk_bank_account_target";--> statement-breakpoint
DROP INDEX "idx_bank_account_company";--> statement-breakpoint
ALTER TABLE "bank_account" DROP COLUMN "company_id";