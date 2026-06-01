CREATE TABLE "ai_interpretation" (
	"interpretation_id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"tenant_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"prompt_version_id" uuid NOT NULL,
	"business_intent" text NOT NULL,
	"confidence_score" numeric NOT NULL,
	"summary" text NOT NULL,
	"evidence_json" jsonb NOT NULL,
	"extracted_references_json" jsonb NOT NULL,
	"requested_resolvers_json" jsonb NOT NULL,
	"blocking_questions_json" jsonb NOT NULL,
	"raw_llm_trace" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ai_review" (
	"review_id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"tenant_id" uuid NOT NULL,
	"interpretation_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"review_status" text NOT NULL,
	"business_case" text NOT NULL,
	"headline" text NOT NULL,
	"summary" text NOT NULL,
	"intent_badge_json" jsonb NOT NULL,
	"sections_json" jsonb NOT NULL,
	"warnings_json" jsonb NOT NULL,
	"blocking_issues_json" jsonb NOT NULL,
	"proposed_apply_payload_json" jsonb NOT NULL,
	"applied_overrides_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "idx_ai_interpretation_tenant" ON "ai_interpretation" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_ai_interpretation_run" ON "ai_interpretation" ("run_id");--> statement-breakpoint
CREATE INDEX "idx_ai_review_tenant" ON "ai_review" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_ai_review_interpretation" ON "ai_review" ("interpretation_id");--> statement-breakpoint
ALTER TABLE "ai_interpretation" ADD CONSTRAINT "ai_interpretation_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "ai_interpretation" ADD CONSTRAINT "ai_interpretation_run_id_ai_run_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "ai_run"("run_id");--> statement-breakpoint
ALTER TABLE "ai_interpretation" ADD CONSTRAINT "ai_interpretation_RYeLWC68YdYO_fkey" FOREIGN KEY ("prompt_version_id") REFERENCES "ai_prompt_version"("prompt_version_id");--> statement-breakpoint
ALTER TABLE "ai_review" ADD CONSTRAINT "ai_review_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "ai_review" ADD CONSTRAINT "ai_review_RXoc96UV9Vkn_fkey" FOREIGN KEY ("interpretation_id") REFERENCES "ai_interpretation"("interpretation_id");--> statement-breakpoint
ALTER TABLE "ai_review" ADD CONSTRAINT "ai_review_run_id_ai_run_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "ai_run"("run_id");