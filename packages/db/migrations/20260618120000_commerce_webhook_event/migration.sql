CREATE TYPE "commerce_webhook_event_status" AS ENUM ('pending', 'processing', 'processed', 'ignored', 'failed');--> statement-breakpoint
CREATE TABLE "commerce_webhook_event" (
	"event_id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"sales_channel_id" uuid NOT NULL,
	"event_name" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "commerce_webhook_event_status" DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"next_retry_at" timestamp with time zone,
	"processed_at" timestamp with time zone,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "commerce_webhook_event" ADD CONSTRAINT "commerce_webhook_event_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "commerce_webhook_event" ADD CONSTRAINT "commerce_webhook_event_sales_channel_id_sales_channel_sales_channel_id_fkey" FOREIGN KEY ("sales_channel_id") REFERENCES "sales_channel"("sales_channel_id");--> statement-breakpoint
CREATE INDEX "idx_commerce_webhook_event_tenant" ON "commerce_webhook_event" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_commerce_webhook_event_pending" ON "commerce_webhook_event" ("tenant_id","sales_channel_id","status","next_retry_at");--> statement-breakpoint
ALTER TABLE "commerce_webhook_event" ADD CONSTRAINT "uq_commerce_webhook_event_dedupe" UNIQUE ("tenant_id","sales_channel_id","dedupe_key");
