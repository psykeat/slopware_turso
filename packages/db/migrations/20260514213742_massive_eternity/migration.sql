ALTER TABLE "tenant" DROP CONSTRAINT "uq_single_base_tenant";--> statement-breakpoint
CREATE UNIQUE INDEX "uq_single_base_tenant" ON "tenant" ("is_base") WHERE is_base = true;