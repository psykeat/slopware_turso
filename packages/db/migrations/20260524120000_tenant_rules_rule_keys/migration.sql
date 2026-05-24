ALTER TABLE "tenant_rules" ADD COLUMN IF NOT EXISTS "rule_key" text;
--> statement-breakpoint
ALTER TABLE "tenant_rules" ADD COLUMN IF NOT EXISTS "priority_order" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
UPDATE "tenant_rules"
SET
  "rule_key" = COALESCE("rule_key", "hook_name"),
  "priority_order" = COALESCE("priority_order", 0);
--> statement-breakpoint
ALTER TABLE "tenant_rules" ALTER COLUMN "rule_key" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "tenant_rules" ALTER COLUMN "rule_state" SET DEFAULT 'active';
--> statement-breakpoint
DROP INDEX IF EXISTS "uq_rules_global";
--> statement-breakpoint
DROP INDEX IF EXISTS "uq_rules_org";
--> statement-breakpoint
DROP INDEX IF EXISTS "uq_rules_tenant";
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_rules_global" ON "tenant_rules" ("entity_name", "rule_key") WHERE scope = 'global';
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_rules_org" ON "tenant_rules" ("organization_id", "entity_name", "rule_key") WHERE scope = 'org';
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_rules_tenant" ON "tenant_rules" ("tenant_id", "entity_name", "rule_key") WHERE scope = 'tenant';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_rules_hook" ON "tenant_rules" ("entity_name", "hook_name");
