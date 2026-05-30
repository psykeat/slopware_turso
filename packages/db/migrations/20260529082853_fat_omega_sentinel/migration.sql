CREATE TABLE "ai_apply_attempt" (
	"attempt_id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"tenant_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"applied_plan_json" jsonb NOT NULL,
	"status" text NOT NULL,
	"executed_by_user_id" text NOT NULL,
	"error_logs" text,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ai_evidence" (
	"evidence_id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"tenant_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"field_name" text NOT NULL,
	"source_text" text NOT NULL,
	"match_confidence" numeric NOT NULL,
	"ambiguity_note" text,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ai_plan" (
	"plan_id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"tenant_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"prompt_version_id" uuid NOT NULL,
	"plan_json" jsonb NOT NULL,
	"confidence_score" numeric NOT NULL,
	"apply_readiness" text NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ai_prompt_version" (
	"prompt_version_id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"tenant_id" uuid,
	"system_prompt" text NOT NULL,
	"input_schema" jsonb NOT NULL,
	"model_config" jsonb NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ai_run" (
	"run_id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"tenant_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"task_scope" text NOT NULL,
	"status" text NOT NULL,
	"duration_ms" integer,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "email_account" (
	"email_account_id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"tenant_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"display_name" text NOT NULL,
	"primary_email" text NOT NULL,
	"status" text DEFAULT 'connected' NOT NULL,
	"credentials_encrypted" text NOT NULL,
	"scopes" jsonb DEFAULT '[]' NOT NULL,
	"last_sync_at" timestamp with time zone,
	"last_sync_status" text DEFAULT 'idle' NOT NULL,
	"last_sync_error" text,
	"watch_expires_at" timestamp with time zone,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "email_account_tenant_provider_account_unique" UNIQUE("tenant_id","provider","provider_account_id"),
	CONSTRAINT "chk_email_account_provider" CHECK (provider IN ('gmail', 'microsoft')),
	CONSTRAINT "chk_email_account_status" CHECK (status IN ('connected', 'reauth_required', 'disabled', 'error')),
	CONSTRAINT "chk_email_account_sync_status" CHECK (last_sync_status IN ('idle', 'queued', 'syncing', 'ok', 'error', 'recovery_required'))
);
--> statement-breakpoint
CREATE TABLE "email_account_user_grant" (
	"email_account_user_grant_id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"tenant_id" uuid NOT NULL,
	"email_account_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"can_read" boolean DEFAULT true NOT NULL,
	"can_send" boolean DEFAULT false NOT NULL,
	"can_manage" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_account_grant_user_unique" UNIQUE("tenant_id","email_account_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "email_attachment" (
	"email_attachment_id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"tenant_id" uuid NOT NULL,
	"email_message_id" uuid NOT NULL,
	"provider_attachment_id" text,
	"file_name" text NOT NULL,
	"content_type" text,
	"size_bytes" integer,
	"storage_key" text,
	"inline_content_id" text,
	"fetched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_attachment_message_provider_unique" UNIQUE("tenant_id","email_message_id","provider_attachment_id")
);
--> statement-breakpoint
CREATE TABLE "email_identity" (
	"email_identity_id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"tenant_id" uuid NOT NULL,
	"email_account_id" uuid NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"provider_identity_id" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"can_send" boolean DEFAULT true NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_identity_account_email_unique" UNIQUE("tenant_id","email_account_id","email")
);
--> statement-breakpoint
CREATE TABLE "email_job" (
	"email_job_id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"tenant_id" uuid NOT NULL,
	"email_account_id" uuid,
	"job_type" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"payload" jsonb DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"run_after" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "email_job_idempotency_unique" UNIQUE("tenant_id","idempotency_key"),
	CONSTRAINT "chk_email_job_type" CHECK (job_type IN ('initial_sync', 'incremental_sync', 'watch_renewal', 'reconcile', 'send', 'fetch_attachment')),
	CONSTRAINT "chk_email_job_status" CHECK (status IN ('queued', 'running', 'done', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "email_label" (
	"email_label_id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"tenant_id" uuid NOT NULL,
	"email_account_id" uuid NOT NULL,
	"provider_label_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'label' NOT NULL,
	"color" text,
	"parent_provider_label_id" text,
	"message_count" integer DEFAULT 0 NOT NULL,
	"unread_count" integer DEFAULT 0 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "email_label_account_provider_unique" UNIQUE("tenant_id","email_account_id","provider_label_id"),
	CONSTRAINT "chk_email_label_kind" CHECK (kind IN ('system', 'folder', 'label'))
);
--> statement-breakpoint
CREATE TABLE "email_message" (
	"email_message_id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"tenant_id" uuid NOT NULL,
	"email_account_id" uuid NOT NULL,
	"email_thread_id" uuid NOT NULL,
	"provider_message_id" text NOT NULL,
	"provider_draft_id" text,
	"internet_message_id" text,
	"direction" text NOT NULL,
	"from_json" jsonb DEFAULT '{}' NOT NULL,
	"to_json" jsonb DEFAULT '[]' NOT NULL,
	"cc_json" jsonb DEFAULT '[]' NOT NULL,
	"bcc_json" jsonb DEFAULT '[]' NOT NULL,
	"subject" text,
	"snippet" text,
	"body_html" text,
	"body_text" text,
	"sent_at" timestamp with time zone,
	"received_at" timestamp with time zone,
	"is_read" boolean DEFAULT false NOT NULL,
	"has_attachments" boolean DEFAULT false NOT NULL,
	"raw_headers" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "email_message_account_provider_unique" UNIQUE("tenant_id","email_account_id","provider_message_id"),
	CONSTRAINT "chk_email_message_direction" CHECK (direction IN ('inbound', 'outbound', 'draft'))
);
--> statement-breakpoint
CREATE TABLE "email_message_label" (
	"email_message_label_id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"tenant_id" uuid NOT NULL,
	"email_message_id" uuid NOT NULL,
	"email_label_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_message_label_unique" UNIQUE("tenant_id","email_message_id","email_label_id")
);
--> statement-breakpoint
CREATE TABLE "email_outbox" (
	"email_outbox_id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"tenant_id" uuid NOT NULL,
	"email_account_id" uuid NOT NULL,
	"email_identity_id" uuid NOT NULL,
	"email_message_id" uuid,
	"provider_draft_id" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"payload" jsonb DEFAULT '{}' NOT NULL,
	"scheduled_for" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"created_by" text,
	CONSTRAINT "chk_email_outbox_status" CHECK (status IN ('draft', 'queued', 'sending', 'sent', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "email_sync_state" (
	"email_sync_state_id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"tenant_id" uuid NOT NULL,
	"email_account_id" uuid NOT NULL,
	"scope" text DEFAULT 'mailbox' NOT NULL,
	"cursor" text,
	"cursor_json" jsonb,
	"status" text DEFAULT 'idle' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_sync_state_account_scope_unique" UNIQUE("tenant_id","email_account_id","scope"),
	CONSTRAINT "chk_email_sync_state_status" CHECK (status IN ('idle', 'queued', 'syncing', 'ok', 'error', 'recovery_required'))
);
--> statement-breakpoint
CREATE TABLE "email_template" (
	"email_template_id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"tenant_id" uuid NOT NULL,
	"category" text DEFAULT 'document' NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"subject_template" text NOT NULL,
	"body_html_template" text NOT NULL,
	"body_text_template" text,
	"language" char(2),
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "email_template_tenant_category_code_unique" UNIQUE("tenant_id","category","code")
);
--> statement-breakpoint
CREATE TABLE "email_template_binding" (
	"email_template_binding_id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"tenant_id" uuid NOT NULL,
	"email_template_id" uuid NOT NULL,
	"document_type" char(1),
	"company_id" uuid,
	"language" char(2),
	"email_identity_id" uuid,
	"priority" integer DEFAULT 100 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_template_render_log" (
	"email_template_render_log_id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"tenant_id" uuid NOT NULL,
	"email_template_id" uuid,
	"email_template_binding_id" uuid,
	"document_id" uuid,
	"email_identity_id" uuid,
	"language" char(2),
	"subject" text NOT NULL,
	"rendered_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "email_thread" (
	"email_thread_id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"tenant_id" uuid NOT NULL,
	"email_account_id" uuid NOT NULL,
	"provider_thread_id" text NOT NULL,
	"subject" text,
	"snippet" text,
	"last_message_at" timestamp with time zone,
	"is_read" boolean DEFAULT false NOT NULL,
	"is_starred" boolean DEFAULT false NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"related_address_id" uuid,
	"related_document_id" uuid,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "email_thread_account_provider_unique" UNIQUE("tenant_id","email_account_id","provider_thread_id")
);
--> statement-breakpoint
CREATE INDEX "idx_ai_apply_attempt_tenant" ON "ai_apply_attempt" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_ai_apply_attempt_plan" ON "ai_apply_attempt" ("plan_id");--> statement-breakpoint
CREATE INDEX "idx_ai_apply_attempt_executor" ON "ai_apply_attempt" ("executed_by_user_id");--> statement-breakpoint
CREATE INDEX "idx_ai_apply_attempt_status" ON "ai_apply_attempt" ("status");--> statement-breakpoint
CREATE INDEX "idx_ai_evidence_tenant" ON "ai_evidence" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_ai_evidence_plan" ON "ai_evidence" ("plan_id");--> statement-breakpoint
CREATE INDEX "idx_ai_evidence_field" ON "ai_evidence" ("field_name");--> statement-breakpoint
CREATE INDEX "idx_ai_plan_tenant" ON "ai_plan" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_ai_plan_run" ON "ai_plan" ("run_id");--> statement-breakpoint
CREATE INDEX "idx_ai_plan_prompt_version" ON "ai_plan" ("prompt_version_id");--> statement-breakpoint
CREATE INDEX "idx_ai_plan_readiness" ON "ai_plan" ("apply_readiness");--> statement-breakpoint
CREATE INDEX "idx_ai_prompt_version_tenant" ON "ai_prompt_version" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_ai_run_tenant" ON "ai_run" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_ai_run_user" ON "ai_run" ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ai_run_status" ON "ai_run" ("status");--> statement-breakpoint
CREATE INDEX "idx_email_account_tenant" ON "email_account" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_email_account_status" ON "email_account" ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "idx_email_account_grant_user" ON "email_account_user_grant" ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_email_attachment_message" ON "email_attachment" ("tenant_id","email_message_id");--> statement-breakpoint
CREATE INDEX "idx_email_attachment_storage" ON "email_attachment" ("tenant_id","storage_key");--> statement-breakpoint
CREATE INDEX "idx_email_identity_account" ON "email_identity" ("tenant_id","email_account_id");--> statement-breakpoint
CREATE INDEX "idx_email_job_queue_claim" ON "email_job" ("tenant_id","status","run_after","created_at");--> statement-breakpoint
CREATE INDEX "idx_email_job_account" ON "email_job" ("tenant_id","email_account_id");--> statement-breakpoint
CREATE INDEX "idx_email_label_account_active" ON "email_label" ("tenant_id","email_account_id","archived","kind","name");--> statement-breakpoint
CREATE INDEX "idx_email_message_thread" ON "email_message" ("tenant_id","email_thread_id");--> statement-breakpoint
CREATE INDEX "idx_email_message_thread_timeline" ON "email_message" ("tenant_id","email_thread_id","received_at","sent_at","created_at");--> statement-breakpoint
CREATE INDEX "idx_email_message_account_date" ON "email_message" ("tenant_id","email_account_id","received_at");--> statement-breakpoint
CREATE INDEX "idx_email_message_label_label" ON "email_message_label" ("tenant_id","email_label_id");--> statement-breakpoint
CREATE INDEX "idx_email_outbox_queue" ON "email_outbox" ("tenant_id","email_account_id","status","updated_at","created_at");--> statement-breakpoint
CREATE INDEX "idx_email_outbox_message" ON "email_outbox" ("tenant_id","email_message_id");--> statement-breakpoint
CREATE INDEX "idx_email_sync_state_account" ON "email_sync_state" ("tenant_id","email_account_id");--> statement-breakpoint
CREATE INDEX "idx_email_template_tenant" ON "email_template" ("tenant_id","category");--> statement-breakpoint
CREATE INDEX "idx_email_template_binding_lookup" ON "email_template_binding" ("tenant_id","document_type","company_id","language","email_identity_id");--> statement-breakpoint
CREATE INDEX "idx_email_template_render_log_document" ON "email_template_render_log" ("tenant_id","document_id");--> statement-breakpoint
CREATE INDEX "idx_email_template_render_log_template" ON "email_template_render_log" ("tenant_id","email_template_id");--> statement-breakpoint
CREATE INDEX "idx_email_thread_mailbox_list" ON "email_thread" ("tenant_id","email_account_id","archived","last_message_at","created_at");--> statement-breakpoint
CREATE INDEX "idx_email_thread_document" ON "email_thread" ("tenant_id","related_document_id");--> statement-breakpoint
CREATE INDEX "idx_email_thread_address" ON "email_thread" ("tenant_id","related_address_id");--> statement-breakpoint
ALTER TABLE "ai_apply_attempt" ADD CONSTRAINT "ai_apply_attempt_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "ai_apply_attempt" ADD CONSTRAINT "ai_apply_attempt_plan_id_ai_plan_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "ai_plan"("plan_id");--> statement-breakpoint
ALTER TABLE "ai_apply_attempt" ADD CONSTRAINT "ai_apply_attempt_executed_by_user_id_user_id_fkey" FOREIGN KEY ("executed_by_user_id") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "ai_evidence" ADD CONSTRAINT "ai_evidence_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "ai_evidence" ADD CONSTRAINT "ai_evidence_plan_id_ai_plan_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "ai_plan"("plan_id");--> statement-breakpoint
ALTER TABLE "ai_plan" ADD CONSTRAINT "ai_plan_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "ai_plan" ADD CONSTRAINT "ai_plan_run_id_ai_run_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "ai_run"("run_id");--> statement-breakpoint
ALTER TABLE "ai_plan" ADD CONSTRAINT "ai_plan_K33pAy4yZEhf_fkey" FOREIGN KEY ("prompt_version_id") REFERENCES "ai_prompt_version"("prompt_version_id");--> statement-breakpoint
ALTER TABLE "ai_prompt_version" ADD CONSTRAINT "ai_prompt_version_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "ai_run" ADD CONSTRAINT "ai_run_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "ai_run" ADD CONSTRAINT "ai_run_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "email_account" ADD CONSTRAINT "email_account_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "email_account_user_grant" ADD CONSTRAINT "email_account_user_grant_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "email_account_user_grant" ADD CONSTRAINT "email_account_user_grant_7RcKIKbx7vRS_fkey" FOREIGN KEY ("email_account_id") REFERENCES "email_account"("email_account_id");--> statement-breakpoint
ALTER TABLE "email_account_user_grant" ADD CONSTRAINT "email_account_user_grant_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "email_attachment" ADD CONSTRAINT "email_attachment_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "email_attachment" ADD CONSTRAINT "email_attachment_PA3EMGcwhB6n_fkey" FOREIGN KEY ("email_message_id") REFERENCES "email_message"("email_message_id");--> statement-breakpoint
ALTER TABLE "email_identity" ADD CONSTRAINT "email_identity_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "email_identity" ADD CONSTRAINT "email_identity_wkUOFignEA3W_fkey" FOREIGN KEY ("email_account_id") REFERENCES "email_account"("email_account_id");--> statement-breakpoint
ALTER TABLE "email_job" ADD CONSTRAINT "email_job_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "email_job" ADD CONSTRAINT "email_job_email_account_id_email_account_email_account_id_fkey" FOREIGN KEY ("email_account_id") REFERENCES "email_account"("email_account_id");--> statement-breakpoint
ALTER TABLE "email_label" ADD CONSTRAINT "email_label_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "email_label" ADD CONSTRAINT "email_label_ZD88RvdeGeSa_fkey" FOREIGN KEY ("email_account_id") REFERENCES "email_account"("email_account_id");--> statement-breakpoint
ALTER TABLE "email_message" ADD CONSTRAINT "email_message_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "email_message" ADD CONSTRAINT "email_message_eaDuJMstCqFF_fkey" FOREIGN KEY ("email_account_id") REFERENCES "email_account"("email_account_id");--> statement-breakpoint
ALTER TABLE "email_message" ADD CONSTRAINT "email_message_email_thread_id_email_thread_email_thread_id_fkey" FOREIGN KEY ("email_thread_id") REFERENCES "email_thread"("email_thread_id");--> statement-breakpoint
ALTER TABLE "email_message_label" ADD CONSTRAINT "email_message_label_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "email_message_label" ADD CONSTRAINT "email_message_label_ua1y5x0lUqea_fkey" FOREIGN KEY ("email_message_id") REFERENCES "email_message"("email_message_id");--> statement-breakpoint
ALTER TABLE "email_message_label" ADD CONSTRAINT "email_message_label_i37HgObVdSr9_fkey" FOREIGN KEY ("email_label_id") REFERENCES "email_label"("email_label_id");--> statement-breakpoint
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_ICzqsM2sfghh_fkey" FOREIGN KEY ("email_account_id") REFERENCES "email_account"("email_account_id");--> statement-breakpoint
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_3M74EtxbH89k_fkey" FOREIGN KEY ("email_identity_id") REFERENCES "email_identity"("email_identity_id");--> statement-breakpoint
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_mHXdkVinYRQv_fkey" FOREIGN KEY ("email_message_id") REFERENCES "email_message"("email_message_id");--> statement-breakpoint
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_created_by_user_id_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "email_sync_state" ADD CONSTRAINT "email_sync_state_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "email_sync_state" ADD CONSTRAINT "email_sync_state_TG4A7dYzqkXx_fkey" FOREIGN KEY ("email_account_id") REFERENCES "email_account"("email_account_id");--> statement-breakpoint
ALTER TABLE "email_template" ADD CONSTRAINT "email_template_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "email_template_binding" ADD CONSTRAINT "email_template_binding_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "email_template_binding" ADD CONSTRAINT "email_template_binding_YyKPNbupo9IB_fkey" FOREIGN KEY ("email_template_id") REFERENCES "email_template"("email_template_id");--> statement-breakpoint
ALTER TABLE "email_template_binding" ADD CONSTRAINT "email_template_binding_company_id_company_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("company_id");--> statement-breakpoint
ALTER TABLE "email_template_binding" ADD CONSTRAINT "email_template_binding_IhnVWQOUFObt_fkey" FOREIGN KEY ("email_identity_id") REFERENCES "email_identity"("email_identity_id");--> statement-breakpoint
ALTER TABLE "email_template_render_log" ADD CONSTRAINT "email_template_render_log_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "email_template_render_log" ADD CONSTRAINT "email_template_render_log_5PkIsGoDeLij_fkey" FOREIGN KEY ("email_template_id") REFERENCES "email_template"("email_template_id");--> statement-breakpoint
ALTER TABLE "email_template_render_log" ADD CONSTRAINT "email_template_render_log_sI0r8Vlf6eAx_fkey" FOREIGN KEY ("email_template_binding_id") REFERENCES "email_template_binding"("email_template_binding_id");--> statement-breakpoint
ALTER TABLE "email_template_render_log" ADD CONSTRAINT "email_template_render_log_document_id_document_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "document"("document_id");--> statement-breakpoint
ALTER TABLE "email_template_render_log" ADD CONSTRAINT "email_template_render_log_vMbymJSOzBtn_fkey" FOREIGN KEY ("email_identity_id") REFERENCES "email_identity"("email_identity_id");--> statement-breakpoint
ALTER TABLE "email_template_render_log" ADD CONSTRAINT "email_template_render_log_created_by_user_id_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "email_thread" ADD CONSTRAINT "email_thread_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "email_thread" ADD CONSTRAINT "email_thread_F0MZH4J9g1gO_fkey" FOREIGN KEY ("email_account_id") REFERENCES "email_account"("email_account_id");--> statement-breakpoint
ALTER TABLE "email_thread" ADD CONSTRAINT "email_thread_related_address_id_address_address_id_fkey" FOREIGN KEY ("related_address_id") REFERENCES "address"("address_id");--> statement-breakpoint
ALTER TABLE "email_thread" ADD CONSTRAINT "email_thread_related_document_id_document_document_id_fkey" FOREIGN KEY ("related_document_id") REFERENCES "document"("document_id");