ALTER TABLE "email_thread" ADD COLUMN IF NOT EXISTS "in_trash" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_llm_config" ADD COLUMN IF NOT EXISTS "provider" text;--> statement-breakpoint
ALTER TABLE "tenant_llm_config" ADD COLUMN IF NOT EXISTS "github_token" text;--> statement-breakpoint
ALTER TABLE "tenant_llm_config" ADD COLUMN IF NOT EXISTS "github_repo" text;--> statement-breakpoint
ALTER TABLE "tenant_llm_config" ADD COLUMN IF NOT EXISTS "vertex_credentials" text;--> statement-breakpoint
ALTER TABLE "tenant_llm_config" ADD COLUMN IF NOT EXISTS "vertex_project" text;--> statement-breakpoint
ALTER TABLE "tenant_llm_config" ADD COLUMN IF NOT EXISTS "vertex_location" text;