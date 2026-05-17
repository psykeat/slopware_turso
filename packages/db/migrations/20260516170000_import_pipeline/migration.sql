CREATE TABLE "import_profile" (
  "profile_id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "slug" text NOT NULL,
  "label" text NOT NULL,
  "target_entity" text NOT NULL,
  "target_command_key" text NOT NULL,
  "requires_approval" boolean DEFAULT true NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "archived" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone,
  CONSTRAINT "uq_import_profile_tenant_slug" UNIQUE("tenant_id","slug")
);
--> statement-breakpoint
CREATE TABLE "import_profile_mapping_version" (
  "version_id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "tenant_connector_id" uuid NOT NULL,
  "profile_id" uuid NOT NULL,
  "version_no" integer DEFAULT 1 NOT NULL,
  "mappings" jsonb NOT NULL,
  "is_active" boolean DEFAULT false NOT NULL,
  "activated_at" timestamp with time zone,
  "activated_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "uq_import_profile_mapping_version" UNIQUE("tenant_connector_id","profile_id","version_no")
);
--> statement-breakpoint
ALTER TABLE "import_batch" ADD COLUMN "profile_id" uuid;
--> statement-breakpoint
ALTER TABLE "import_batch" ADD COLUMN "mapping_version_id" uuid;
--> statement-breakpoint
ALTER TABLE "tenant_connector_mapping" ADD COLUMN "profile_id" uuid;
--> statement-breakpoint
ALTER TABLE "tenant_connector_mapping" DROP CONSTRAINT "tenant_connector_mapping_tenant_connector_id_source_field_uniqu";
--> statement-breakpoint
ALTER TABLE "import_profile" ADD CONSTRAINT "import_profile_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("tenant_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "import_profile_mapping_version" ADD CONSTRAINT "import_profile_mapping_version_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("tenant_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "import_profile_mapping_version" ADD CONSTRAINT "import_profile_mapping_version_tenant_connector_id_fk" FOREIGN KEY ("tenant_connector_id") REFERENCES "public"."tenant_connector"("tenant_connector_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "import_profile_mapping_version" ADD CONSTRAINT "import_profile_mapping_version_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."import_profile"("profile_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "import_batch" ADD CONSTRAINT "import_batch_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."import_profile"("profile_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "import_batch" ADD CONSTRAINT "import_batch_mapping_version_id_fk" FOREIGN KEY ("mapping_version_id") REFERENCES "public"."import_profile_mapping_version"("version_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tenant_connector_mapping" ADD CONSTRAINT "uq_tenant_connector_mapping_connector_profile_field" UNIQUE("tenant_connector_id","profile_id","source_field");
--> statement-breakpoint
CREATE INDEX "idx_import_profile_tenant" ON "import_profile" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "idx_import_mapping_version_lookup" ON "import_profile_mapping_version" USING btree ("tenant_connector_id","profile_id","is_active");
