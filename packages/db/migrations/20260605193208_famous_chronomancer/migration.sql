CREATE TYPE "ai_session_status" AS ENUM('active', 'awaiting_review', 'completed', 'aborted');--> statement-breakpoint
CREATE TABLE "ai_session" (
	"session_id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"tenant_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"mode" text,
	"focus_type" text NOT NULL,
	"focus_id" text NOT NULL,
	"status" "ai_session_status" DEFAULT 'active'::"ai_session_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_ai_session_tenant" ON "ai_session" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_ai_session_user" ON "ai_session" ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ai_session_status" ON "ai_session" ("status");--> statement-breakpoint
CREATE INDEX "idx_ai_session_focus" ON "ai_session" ("focus_type","focus_id");--> statement-breakpoint
ALTER TABLE "ai_session" ADD CONSTRAINT "ai_session_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "ai_session" ADD CONSTRAINT "ai_session_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id");