DROP TABLE "email_job";--> statement-breakpoint
ALTER TABLE "ai_session" ALTER COLUMN "mode" SET DEFAULT 'sync';--> statement-breakpoint
ALTER TABLE "ai_session" ALTER COLUMN "mode" SET NOT NULL;