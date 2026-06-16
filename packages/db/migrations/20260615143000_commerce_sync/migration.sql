CREATE TYPE "commerce_sync_run_direction" AS ENUM ('push', 'pull', 'bidirectional');--> statement-breakpoint
CREATE TYPE "commerce_sync_run_mode" AS ENUM ('single', 'full');--> statement-breakpoint
CREATE TYPE "commerce_sync_run_status" AS ENUM ('queued', 'running', 'success', 'partial_error', 'error', 'cancel_requested', 'cancelled');--> statement-breakpoint
CREATE TYPE "commerce_sync_step_phase" AS ENUM ('plan', 'map', 'push', 'pull', 'finalize');--> statement-breakpoint
CREATE TYPE "commerce_sync_step_status" AS ENUM ('pending', 'running', 'success', 'error', 'skipped');--> statement-breakpoint
CREATE TABLE "commerce_sync_run" (
	"run_id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"sales_channel_id" uuid NOT NULL,
	"direction" "commerce_sync_run_direction" NOT NULL,
	"mode" "commerce_sync_run_mode" NOT NULL,
	"status" "commerce_sync_run_status" DEFAULT 'queued' NOT NULL,
	"requested_entities" jsonb NOT NULL,
	"dry_run" boolean DEFAULT false NOT NULL,
	"total_items" integer DEFAULT 0 NOT NULL,
	"succeeded_items" integer DEFAULT 0 NOT NULL,
	"failed_items" integer DEFAULT 0 NOT NULL,
	"error_summary" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancel_requested_at" timestamp with time zone,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commerce_sync_run_step" (
	"step_id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"run_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"sales_channel_id" uuid NOT NULL,
	"entity_type" "external_sync_entity_type" NOT NULL,
	"phase" "commerce_sync_step_phase" NOT NULL,
	"status" "commerce_sync_step_status" DEFAULT 'pending' NOT NULL,
	"sequence" integer NOT NULL,
	"batch_no" integer DEFAULT 0 NOT NULL,
	"cursor" text,
	"planned_items" integer DEFAULT 0 NOT NULL,
	"succeeded_items" integer DEFAULT 0 NOT NULL,
	"failed_items" integer DEFAULT 0 NOT NULL,
	"payload_summary" jsonb,
	"error_summary" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "commerce_sync_run" ADD CONSTRAINT "commerce_sync_run_tenant_id_tenant_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce_sync_run" ADD CONSTRAINT "commerce_sync_run_sales_channel_id_sales_channel_sales_channel_id_fk" FOREIGN KEY ("sales_channel_id") REFERENCES "public"."sales_channel"("sales_channel_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce_sync_run_step" ADD CONSTRAINT "commerce_sync_run_step_run_id_commerce_sync_run_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."commerce_sync_run"("run_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce_sync_run_step" ADD CONSTRAINT "commerce_sync_run_step_tenant_id_tenant_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce_sync_run_step" ADD CONSTRAINT "commerce_sync_run_step_sales_channel_id_sales_channel_sales_channel_id_fk" FOREIGN KEY ("sales_channel_id") REFERENCES "public"."sales_channel"("sales_channel_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_commerce_sync_run_tenant" ON "commerce_sync_run" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_commerce_sync_run_sales_channel" ON "commerce_sync_run" USING btree ("tenant_id","sales_channel_id");--> statement-breakpoint
CREATE INDEX "idx_commerce_sync_run_status" ON "commerce_sync_run" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "idx_commerce_sync_step_run" ON "commerce_sync_run_step" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "idx_commerce_sync_step_tenant" ON "commerce_sync_run_step" USING btree ("tenant_id");--> statement-breakpoint
ALTER TABLE "commerce_sync_run_step" ADD CONSTRAINT "uq_commerce_sync_step_sequence" UNIQUE("run_id","sequence","batch_no");
