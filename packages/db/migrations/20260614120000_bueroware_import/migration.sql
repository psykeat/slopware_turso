ALTER TYPE "external_sync_entity_type" ADD VALUE IF NOT EXISTS 'address';--> statement-breakpoint
ALTER TYPE "external_sync_entity_type" ADD VALUE IF NOT EXISTS 'article_group';--> statement-breakpoint

ALTER TABLE "external_sync_mapping" ALTER COLUMN "sales_channel_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "external_sync_mapping" ADD COLUMN IF NOT EXISTS "source_system" text DEFAULT 'sales_channel' NOT NULL;--> statement-breakpoint

ALTER TABLE "import_batch" ADD COLUMN IF NOT EXISTS "is_dry_run" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "import_batch" ADD COLUMN IF NOT EXISTS "failed_entity_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "import_batch" ADD COLUMN IF NOT EXISTS "pending_reference_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "import_batch" ADD COLUMN IF NOT EXISTS "file_path" text;--> statement-breakpoint
ALTER TABLE "import_batch" ADD COLUMN IF NOT EXISTS "source_file_name" text;--> statement-breakpoint

ALTER TABLE "import_profile_mapping_version" ALTER COLUMN "tenant_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "import_profile_mapping_version" ALTER COLUMN "tenant_connector_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "import_profile_mapping_version" ALTER COLUMN "profile_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "import_profile_mapping_version" ADD COLUMN IF NOT EXISTS "source_system" text;--> statement-breakpoint
ALTER TABLE "import_profile_mapping_version" ADD COLUMN IF NOT EXISTS "source_file_name" text;--> statement-breakpoint
ALTER TABLE "import_profile_mapping_version" ADD COLUMN IF NOT EXISTS "target_entity" text;--> statement-breakpoint

ALTER TABLE "import_row" ADD COLUMN IF NOT EXISTS "missing_references" jsonb;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "import_field_mapping" (
  "mapping_id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "tenant_id" uuid,
  "version_id" uuid NOT NULL,
  "position" integer,
  "length" integer,
  "qualifier" text,
  "formatting" text,
  "source_field" text,
  "target_field" text NOT NULL,
  "target_entity" text,
  "reference_entity" text,
  "is_required" boolean DEFAULT false NOT NULL,
  "default_value" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "import_field_mapping" ALTER COLUMN "tenant_id" DROP NOT NULL;--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "import_field_mapping" ADD CONSTRAINT "import_field_mapping_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("tenant_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "import_field_mapping" ADD CONSTRAINT "import_field_mapping_version_id_import_profile_mapping_version_version_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."import_profile_mapping_version"("version_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

ALTER TABLE "import_batch" DROP CONSTRAINT IF EXISTS "import_batch_status_check";--> statement-breakpoint
ALTER TABLE "import_batch" ADD CONSTRAINT "import_batch_status_check" CHECK (status IN ('pending', 'queued', 'processing', 'validating', 'validated', 'approved', 'posted', 'failed', 'rejected'));--> statement-breakpoint

ALTER TABLE "import_row" DROP CONSTRAINT IF EXISTS "import_row_status_check";--> statement-breakpoint
ALTER TABLE "import_row" ADD CONSTRAINT "import_row_status_check" CHECK (status IN ('pending', 'valid', 'posted', 'failed', 'pending_references'));--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_field_mapping_version" ON "import_field_mapping" USING btree ("version_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_field_mapping_tenant" ON "import_field_mapping" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_import_mapping_version_source_file" ON "import_profile_mapping_version" USING btree ("source_system","source_file_name","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_import_mapping_source_version" ON "import_profile_mapping_version" USING btree ("source_system","source_file_name","version_no");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_import_row_batch_status" ON "import_row" USING btree ("batch_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ext_sync_tenant_lookup" ON "external_sync_mapping" USING btree ("tenant_id","source_system","entity_type");--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "uq_ext_sync_external_key" ON "external_sync_mapping" USING btree ("tenant_id","source_system","entity_type","external_id");
