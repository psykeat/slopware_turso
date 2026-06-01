ALTER TABLE "email_thread" ADD COLUMN "in_trash" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_llm_config" ADD COLUMN "provider" text;--> statement-breakpoint
ALTER TABLE "tenant_llm_config" ADD COLUMN "github_token" text;--> statement-breakpoint
ALTER TABLE "tenant_llm_config" ADD COLUMN "github_repo" text;--> statement-breakpoint
ALTER TABLE "tenant_llm_config" ADD COLUMN "vertex_credentials" text;--> statement-breakpoint
ALTER TABLE "tenant_llm_config" ADD COLUMN "vertex_project" text;--> statement-breakpoint
ALTER TABLE "tenant_llm_config" ADD COLUMN "vertex_location" text;