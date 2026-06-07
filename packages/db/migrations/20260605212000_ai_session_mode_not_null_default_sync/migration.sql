UPDATE "ai_session"
SET "mode" = 'sync'
WHERE "mode" IS NULL;
--> statement-breakpoint
ALTER TABLE "ai_session" ALTER COLUMN "mode" SET DEFAULT 'sync';--> statement-breakpoint
ALTER TABLE "ai_session" ALTER COLUMN "mode" SET NOT NULL;--> statement-breakpoint
