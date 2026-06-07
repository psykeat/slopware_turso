CREATE TYPE "ai_memory_kind" AS ENUM('business_fact', 'classification_pattern', 'explicit_rule', 'writing_style', 'personal_shorthand');--> statement-breakpoint
CREATE TYPE "ai_tool_call_status" AS ENUM('pending', 'running', 'done', 'error');--> statement-breakpoint
CREATE TYPE "ai_tool_review_status" AS ENUM('pending', 'validated', 'applied', 'rejected');--> statement-breakpoint
CREATE TABLE "ai_context_projection" (
	"projection_id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"session_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"focus_type" text NOT NULL,
	"focus_id" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_memory" (
	"memory_id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"tenant_id" uuid NOT NULL,
	"user_id" text,
	"kind" "ai_memory_kind" NOT NULL,
	"text" text NOT NULL,
	"confidence" numeric NOT NULL,
	"source_review_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ai_tool_call" (
	"tool_call_id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"turn_id" uuid NOT NULL,
	"tool_name" text NOT NULL,
	"input" jsonb NOT NULL,
	"output" jsonb,
	"status" "ai_tool_call_status" NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_tool_review" (
	"review_id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"session_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"tool_name" text NOT NULL,
	"proposal" jsonb NOT NULL,
	"status" "ai_tool_review_status" DEFAULT 'pending'::"ai_tool_review_status" NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"applied_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ai_turn" (
	"turn_id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"session_id" uuid NOT NULL,
	"role" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenant_fields" ADD COLUMN "archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_ai_context_projection_session" ON "ai_context_projection" ("session_id");--> statement-breakpoint
CREATE INDEX "idx_ai_memory_tenant" ON "ai_memory" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_ai_memory_user" ON "ai_memory" ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ai_memory_kind" ON "ai_memory" ("kind");--> statement-breakpoint
CREATE INDEX "idx_ai_memory_confirmed" ON "ai_memory" ("confirmed_at");--> statement-breakpoint
CREATE INDEX "idx_ai_tool_call_turn" ON "ai_tool_call" ("turn_id");--> statement-breakpoint
CREATE INDEX "idx_ai_tool_call_status" ON "ai_tool_call" ("status");--> statement-breakpoint
CREATE INDEX "idx_ai_tool_review_session" ON "ai_tool_review" ("session_id");--> statement-breakpoint
CREATE INDEX "idx_ai_tool_review_tenant" ON "ai_tool_review" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_ai_turn_session" ON "ai_turn" ("session_id");--> statement-breakpoint
ALTER TABLE "ai_context_projection" ADD CONSTRAINT "ai_context_projection_session_id_ai_session_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "ai_session"("session_id");--> statement-breakpoint
ALTER TABLE "ai_context_projection" ADD CONSTRAINT "ai_context_projection_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "ai_memory" ADD CONSTRAINT "ai_memory_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "ai_memory" ADD CONSTRAINT "ai_memory_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "ai_memory" ADD CONSTRAINT "ai_memory_source_review_id_ai_tool_review_review_id_fkey" FOREIGN KEY ("source_review_id") REFERENCES "ai_tool_review"("review_id");--> statement-breakpoint
ALTER TABLE "ai_tool_call" ADD CONSTRAINT "ai_tool_call_turn_id_ai_turn_turn_id_fkey" FOREIGN KEY ("turn_id") REFERENCES "ai_turn"("turn_id");--> statement-breakpoint
ALTER TABLE "ai_tool_review" ADD CONSTRAINT "ai_tool_review_session_id_ai_session_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "ai_session"("session_id");--> statement-breakpoint
ALTER TABLE "ai_tool_review" ADD CONSTRAINT "ai_tool_review_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "ai_turn" ADD CONSTRAINT "ai_turn_session_id_ai_session_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "ai_session"("session_id");