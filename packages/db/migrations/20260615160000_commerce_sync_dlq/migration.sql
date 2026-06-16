CREATE TYPE "commerce_sync_dlq_status" AS ENUM ('pending', 'resolved', 'abandoned');--> statement-breakpoint
CREATE TABLE "commerce_sync_dead_letter" (
	"item_id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"run_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"sales_channel_id" uuid NOT NULL,
	"entity_type" "external_sync_entity_type" NOT NULL,
	"internal_id" uuid NOT NULL,
	"error_message" text NOT NULL,
	"attempt_count" integer DEFAULT 1 NOT NULL,
	"last_attempted_at" timestamp with time zone NOT NULL,
	"next_retry_at" timestamp with time zone,
	"status" "commerce_sync_dlq_status" DEFAULT 'pending' NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "commerce_sync_dead_letter" ADD CONSTRAINT "commerce_sync_dead_letter_run_id_commerce_sync_run_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."commerce_sync_run"("run_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce_sync_dead_letter" ADD CONSTRAINT "commerce_sync_dead_letter_tenant_id_tenant_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce_sync_dead_letter" ADD CONSTRAINT "commerce_sync_dead_letter_sales_channel_id_sales_channel_sales_channel_id_fk" FOREIGN KEY ("sales_channel_id") REFERENCES "public"."sales_channel"("sales_channel_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_commerce_sync_dlq_tenant" ON "commerce_sync_dead_letter" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_commerce_sync_dlq_pending" ON "commerce_sync_dead_letter" USING btree ("tenant_id","status","next_retry_at");--> statement-breakpoint
CREATE INDEX "idx_commerce_sync_dlq_item" ON "commerce_sync_dead_letter" USING btree ("tenant_id","sales_channel_id","entity_type","internal_id");
