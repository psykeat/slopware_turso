CREATE TABLE IF NOT EXISTS "email_account" (
  "email_account_id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenant"("tenant_id"),
  "provider" text NOT NULL,
  "provider_account_id" text NOT NULL,
  "display_name" text NOT NULL,
  "primary_email" text NOT NULL,
  "status" text DEFAULT 'connected' NOT NULL,
  "credentials_encrypted" text NOT NULL,
  "scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "last_sync_at" timestamp with time zone,
  "last_sync_status" text DEFAULT 'idle' NOT NULL,
  "last_sync_error" text,
  "watch_expires_at" timestamp with time zone,
  "archived" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone,
  CONSTRAINT "email_account_tenant_provider_account_unique" UNIQUE("tenant_id","provider","provider_account_id"),
  CONSTRAINT "chk_email_account_provider" CHECK ("provider" IN ('gmail', 'microsoft')),
  CONSTRAINT "chk_email_account_status" CHECK ("status" IN ('connected', 'reauth_required', 'disabled', 'error')),
  CONSTRAINT "chk_email_account_sync_status" CHECK ("last_sync_status" IN ('idle', 'queued', 'syncing', 'ok', 'error', 'recovery_required'))
);

CREATE TABLE IF NOT EXISTS "email_identity" (
  "email_identity_id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenant"("tenant_id"),
  "email_account_id" uuid NOT NULL REFERENCES "email_account"("email_account_id"),
  "email" text NOT NULL,
  "display_name" text,
  "provider_identity_id" text,
  "is_primary" boolean DEFAULT false NOT NULL,
  "can_send" boolean DEFAULT true NOT NULL,
  "archived" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "email_identity_account_email_unique" UNIQUE("tenant_id","email_account_id","email")
);

CREATE TABLE IF NOT EXISTS "email_account_user_grant" (
  "email_account_user_grant_id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenant"("tenant_id"),
  "email_account_id" uuid NOT NULL REFERENCES "email_account"("email_account_id"),
  "user_id" text NOT NULL REFERENCES "user"("id"),
  "can_read" boolean DEFAULT true NOT NULL,
  "can_send" boolean DEFAULT false NOT NULL,
  "can_manage" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "email_account_grant_user_unique" UNIQUE("tenant_id","email_account_id","user_id")
);

CREATE TABLE IF NOT EXISTS "email_thread" (
  "email_thread_id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenant"("tenant_id"),
  "email_account_id" uuid NOT NULL REFERENCES "email_account"("email_account_id"),
  "provider_thread_id" text NOT NULL,
  "subject" text,
  "snippet" text,
  "last_message_at" timestamp with time zone,
  "is_read" boolean DEFAULT false NOT NULL,
  "is_starred" boolean DEFAULT false NOT NULL,
  "message_count" integer DEFAULT 0 NOT NULL,
  "related_address_id" uuid REFERENCES "address"("address_id"),
  "related_document_id" uuid REFERENCES "document"("document_id"),
  "archived" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone,
  CONSTRAINT "email_thread_account_provider_unique" UNIQUE("tenant_id","email_account_id","provider_thread_id")
);

CREATE TABLE IF NOT EXISTS "email_message" (
  "email_message_id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenant"("tenant_id"),
  "email_account_id" uuid NOT NULL REFERENCES "email_account"("email_account_id"),
  "email_thread_id" uuid NOT NULL REFERENCES "email_thread"("email_thread_id"),
  "provider_message_id" text NOT NULL,
  "provider_draft_id" text,
  "internet_message_id" text,
  "direction" text NOT NULL,
  "from_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "to_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "cc_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "bcc_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "subject" text,
  "snippet" text,
  "body_html" text,
  "body_text" text,
  "sent_at" timestamp with time zone,
  "received_at" timestamp with time zone,
  "is_read" boolean DEFAULT false NOT NULL,
  "has_attachments" boolean DEFAULT false NOT NULL,
  "raw_headers" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone,
  CONSTRAINT "email_message_account_provider_unique" UNIQUE("tenant_id","email_account_id","provider_message_id"),
  CONSTRAINT "chk_email_message_direction" CHECK ("direction" IN ('inbound', 'outbound', 'draft'))
);

CREATE TABLE IF NOT EXISTS "email_attachment" (
  "email_attachment_id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenant"("tenant_id"),
  "email_message_id" uuid NOT NULL REFERENCES "email_message"("email_message_id"),
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

CREATE TABLE IF NOT EXISTS "email_label" (
  "email_label_id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenant"("tenant_id"),
  "email_account_id" uuid NOT NULL REFERENCES "email_account"("email_account_id"),
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
  CONSTRAINT "chk_email_label_kind" CHECK ("kind" IN ('system', 'folder', 'label'))
);

CREATE TABLE IF NOT EXISTS "email_message_label" (
  "email_message_label_id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenant"("tenant_id"),
  "email_message_id" uuid NOT NULL REFERENCES "email_message"("email_message_id"),
  "email_label_id" uuid NOT NULL REFERENCES "email_label"("email_label_id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "email_message_label_unique" UNIQUE("tenant_id","email_message_id","email_label_id")
);

CREATE TABLE IF NOT EXISTS "email_sync_state" (
  "email_sync_state_id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenant"("tenant_id"),
  "email_account_id" uuid NOT NULL REFERENCES "email_account"("email_account_id"),
  "scope" text DEFAULT 'mailbox' NOT NULL,
  "cursor" text,
  "cursor_json" jsonb,
  "status" text DEFAULT 'idle' NOT NULL,
  "last_synced_at" timestamp with time zone,
  "last_error" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "email_sync_state_account_scope_unique" UNIQUE("tenant_id","email_account_id","scope"),
  CONSTRAINT "chk_email_sync_state_status" CHECK ("status" IN ('idle', 'queued', 'syncing', 'ok', 'error', 'recovery_required'))
);

CREATE TABLE IF NOT EXISTS "email_template" (
  "email_template_id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenant"("tenant_id"),
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

CREATE TABLE IF NOT EXISTS "email_template_binding" (
  "email_template_binding_id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenant"("tenant_id"),
  "email_template_id" uuid NOT NULL REFERENCES "email_template"("email_template_id"),
  "document_type" char(1),
  "company_id" uuid REFERENCES "company"("company_id"),
  "language" char(2),
  "email_identity_id" uuid REFERENCES "email_identity"("email_identity_id"),
  "priority" integer DEFAULT 100 NOT NULL,
  "archived" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "email_template_render_log" (
  "email_template_render_log_id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenant"("tenant_id"),
  "email_template_id" uuid REFERENCES "email_template"("email_template_id"),
  "email_template_binding_id" uuid REFERENCES "email_template_binding"("email_template_binding_id"),
  "document_id" uuid REFERENCES "document"("document_id"),
  "email_identity_id" uuid REFERENCES "email_identity"("email_identity_id"),
  "language" char(2),
  "subject" text NOT NULL,
  "rendered_hash" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" text REFERENCES "user"("id")
);

CREATE TABLE IF NOT EXISTS "email_job" (
  "email_job_id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenant"("tenant_id"),
  "email_account_id" uuid REFERENCES "email_account"("email_account_id"),
  "job_type" text NOT NULL,
  "idempotency_key" text NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
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
  CONSTRAINT "chk_email_job_type" CHECK ("job_type" IN ('initial_sync', 'incremental_sync', 'watch_renewal', 'reconcile', 'send', 'fetch_attachment')),
  CONSTRAINT "chk_email_job_status" CHECK ("status" IN ('queued', 'running', 'done', 'failed'))
);

CREATE TABLE IF NOT EXISTS "email_outbox" (
  "email_outbox_id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenant"("tenant_id"),
  "email_account_id" uuid NOT NULL REFERENCES "email_account"("email_account_id"),
  "email_identity_id" uuid NOT NULL REFERENCES "email_identity"("email_identity_id"),
  "email_message_id" uuid REFERENCES "email_message"("email_message_id"),
  "provider_draft_id" text,
  "status" text DEFAULT 'draft' NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "scheduled_for" timestamp with time zone,
  "sent_at" timestamp with time zone,
  "last_error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone,
  "created_by" text REFERENCES "user"("id"),
  CONSTRAINT "chk_email_outbox_status" CHECK ("status" IN ('draft', 'queued', 'sending', 'sent', 'failed'))
);

CREATE INDEX IF NOT EXISTS "idx_email_account_tenant" ON "email_account" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_email_account_status" ON "email_account" ("tenant_id","status");
CREATE INDEX IF NOT EXISTS "idx_email_identity_account" ON "email_identity" ("tenant_id","email_account_id");
CREATE INDEX IF NOT EXISTS "idx_email_account_grant_user" ON "email_account_user_grant" ("tenant_id","user_id");
CREATE INDEX IF NOT EXISTS "idx_email_thread_mailbox_list" ON "email_thread" ("tenant_id","email_account_id","archived","last_message_at","created_at");
CREATE INDEX IF NOT EXISTS "idx_email_thread_document" ON "email_thread" ("tenant_id","related_document_id");
CREATE INDEX IF NOT EXISTS "idx_email_thread_address" ON "email_thread" ("tenant_id","related_address_id");
CREATE INDEX IF NOT EXISTS "idx_email_message_thread" ON "email_message" ("tenant_id","email_thread_id");
CREATE INDEX IF NOT EXISTS "idx_email_message_thread_timeline" ON "email_message" ("tenant_id","email_thread_id","received_at","sent_at","created_at");
CREATE INDEX IF NOT EXISTS "idx_email_message_account_date" ON "email_message" ("tenant_id","email_account_id","received_at");
CREATE INDEX IF NOT EXISTS "idx_email_attachment_message" ON "email_attachment" ("tenant_id","email_message_id");
CREATE INDEX IF NOT EXISTS "idx_email_attachment_storage" ON "email_attachment" ("tenant_id","storage_key");
CREATE INDEX IF NOT EXISTS "idx_email_label_account_active" ON "email_label" ("tenant_id","email_account_id","archived","kind","name");
CREATE INDEX IF NOT EXISTS "idx_email_message_label_label" ON "email_message_label" ("tenant_id","email_label_id");
CREATE INDEX IF NOT EXISTS "idx_email_sync_state_account" ON "email_sync_state" ("tenant_id","email_account_id");
CREATE INDEX IF NOT EXISTS "idx_email_template_tenant" ON "email_template" ("tenant_id","category");
CREATE INDEX IF NOT EXISTS "idx_email_template_binding_lookup" ON "email_template_binding" ("tenant_id","document_type","company_id","language","email_identity_id");
CREATE INDEX IF NOT EXISTS "idx_email_template_render_log_document" ON "email_template_render_log" ("tenant_id","document_id");
CREATE INDEX IF NOT EXISTS "idx_email_template_render_log_template" ON "email_template_render_log" ("tenant_id","email_template_id");
CREATE INDEX IF NOT EXISTS "idx_email_job_queue_claim" ON "email_job" ("tenant_id","status","run_after","created_at");
CREATE INDEX IF NOT EXISTS "idx_email_job_account" ON "email_job" ("tenant_id","email_account_id");
CREATE INDEX IF NOT EXISTS "idx_email_outbox_queue" ON "email_outbox" ("tenant_id","email_account_id","status","updated_at","created_at");
CREATE INDEX IF NOT EXISTS "idx_email_outbox_message" ON "email_outbox" ("tenant_id","email_message_id");
