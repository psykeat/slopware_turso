CREATE TABLE "capability_execution_log" (
	"capability_execution_log_id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"tenant_id" uuid NOT NULL,
	"idempotency_key" text NOT NULL,
	"capability_key" text NOT NULL,
	"input_hash" char(64) NOT NULL,
	"status" text NOT NULL,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_capability_execution_log_key" ON "capability_execution_log" ("tenant_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_capability_execution_log_tenant" ON "capability_execution_log" ("tenant_id");--> statement-breakpoint
ALTER TABLE "capability_execution_log" ADD CONSTRAINT "capability_execution_log_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");