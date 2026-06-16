-- Büroware Satzbeschreibung catalog (global reference data) + data-area binding.

CREATE TABLE IF NOT EXISTS "bueroware_record_layout" (
  "layout_id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "file_name" text NOT NULL,
  "data_area" text NOT NULL,
  "qualifier" text,
  "default_target_entity" text,
  "catalog_version" integer DEFAULT 1 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "field_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "bueroware_record_field" (
  "field_id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "layout_id" uuid NOT NULL,
  "bueroware_field_id" text NOT NULL,
  "label" text,
  "sample_value" text,
  "position" integer,
  "length" integer,
  "formatting" text,
  "refresh_table" text,
  "import_marker" text,
  "ordinal" integer,
  "default_target_field" text,
  "default_reference_entity" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "bueroware_record_field" ADD CONSTRAINT "bueroware_record_field_layout_id_fk" FOREIGN KEY ("layout_id") REFERENCES "public"."bueroware_record_layout"("layout_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "uq_bueroware_layout_file_qualifier_version" ON "bueroware_record_layout" USING btree ("file_name","qualifier","catalog_version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bueroware_layout_file_active" ON "bueroware_record_layout" USING btree ("file_name","is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bueroware_field_layout" ON "bueroware_record_field" USING btree ("layout_id");--> statement-breakpoint

ALTER TABLE "import_batch" ADD COLUMN IF NOT EXISTS "layout_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "import_batch" ADD CONSTRAINT "import_batch_layout_id_fk" FOREIGN KEY ("layout_id") REFERENCES "public"."bueroware_record_layout"("layout_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

ALTER TABLE "import_profile_mapping_version" ADD COLUMN IF NOT EXISTS "layout_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "import_profile_mapping_version" ADD CONSTRAINT "import_profile_mapping_version_layout_id_fk" FOREIGN KEY ("layout_id") REFERENCES "public"."bueroware_record_layout"("layout_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

ALTER TABLE "import_profile_mapping_version" DROP CONSTRAINT IF EXISTS "uq_import_mapping_source_version";--> statement-breakpoint
DROP INDEX IF EXISTS "uq_import_mapping_source_version";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_import_mapping_source_version" ON "import_profile_mapping_version" USING btree ("source_system","source_file_name","layout_id","version_no");
