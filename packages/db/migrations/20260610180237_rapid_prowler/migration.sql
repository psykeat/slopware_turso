CREATE TABLE "email_job" (
	"email_job_id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"tenant_id" uuid NOT NULL,
	"email_account_id" uuid,
	"job_type" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"payload" jsonb DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"priority" integer DEFAULT 2 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"run_after" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "email_job_idempotency_unique" UNIQUE("tenant_id","idempotency_key"),
	CONSTRAINT "chk_email_job_type" CHECK (job_type IN ('initial_sync', 'incremental_sync', 'watch_renewal', 'reconcile', 'send', 'fetch_attachment', 'sync_contacts')),
	CONSTRAINT "chk_email_job_status" CHECK (status IN ('queued', 'processing', 'done', 'failed')),
	CONSTRAINT "chk_email_job_priority" CHECK (priority BETWEEN 1 AND 3)
);
--> statement-breakpoint
CREATE TABLE "email_subscription" (
	"email_subscription_id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"tenant_id" uuid NOT NULL,
	"email_account_id" uuid NOT NULL,
	"resource" text DEFAULT 'mail' NOT NULL,
	"provider_subscription_id" text,
	"channel_token" text,
	"expires_at" timestamp with time zone,
	"renewed_at" timestamp with time zone,
	"status" text DEFAULT 'active' NOT NULL,
	"renewal_attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "email_subscription_account_resource_unique" UNIQUE("tenant_id","email_account_id","resource"),
	CONSTRAINT "chk_email_subscription_resource" CHECK (resource IN ('mail', 'calendar', 'contacts')),
	CONSTRAINT "chk_email_subscription_status" CHECK (status IN ('active', 'expired', 'renewal_pending', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "email_account" ADD COLUMN "activity_tier" text DEFAULT 'cold' NOT NULL;--> statement-breakpoint
ALTER TABLE "email_account" ADD COLUMN "last_user_activity_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "idx_email_job_queue_claim" ON "email_job" ("tenant_id","status","priority","run_after","created_at");--> statement-breakpoint
CREATE INDEX "idx_email_job_account" ON "email_job" ("tenant_id","email_account_id");--> statement-breakpoint
CREATE INDEX "idx_email_subscription_expires" ON "email_subscription" ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_email_subscription_account" ON "email_subscription" ("tenant_id","email_account_id");--> statement-breakpoint
ALTER TABLE "email_job" ADD CONSTRAINT "email_job_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "email_job" ADD CONSTRAINT "email_job_email_account_id_email_account_email_account_id_fkey" FOREIGN KEY ("email_account_id") REFERENCES "email_account"("email_account_id");--> statement-breakpoint
ALTER TABLE "email_subscription" ADD CONSTRAINT "email_subscription_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "email_subscription" ADD CONSTRAINT "email_subscription_havyqS5Fj36b_fkey" FOREIGN KEY ("email_account_id") REFERENCES "email_account"("email_account_id");--> statement-breakpoint
ALTER TABLE "email_account" ADD CONSTRAINT "chk_email_account_activity_tier" CHECK (activity_tier IN ('hot', 'warm', 'cold', 'dormant'));