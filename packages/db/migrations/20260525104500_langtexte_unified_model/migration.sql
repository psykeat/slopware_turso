ALTER TABLE "company"
  ADD COLUMN IF NOT EXISTS "copy_long_texts_only_on_change" boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "print_address_long_text" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "print_pre_text" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "print_post_text" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "print_position_texts" boolean NOT NULL DEFAULT false;

ALTER TABLE "address"
  ADD COLUMN IF NOT EXISTS "notiztext" text,
  ADD COLUMN IF NOT EXISTS "notiztext_source_entity" text,
  ADD COLUMN IF NOT EXISTS "notiztext_source_id" uuid,
  ADD COLUMN IF NOT EXISTS "notiztext_source_field" text,
  ADD COLUMN IF NOT EXISTS "notiztext_linked_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "notiztext_overridden_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "langtext" text,
  ADD COLUMN IF NOT EXISTS "langtext_source_entity" text,
  ADD COLUMN IF NOT EXISTS "langtext_source_id" uuid,
  ADD COLUMN IF NOT EXISTS "langtext_source_field" text,
  ADD COLUMN IF NOT EXISTS "langtext_linked_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "langtext_overridden_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "warntext" text,
  ADD COLUMN IF NOT EXISTS "warntext_source_entity" text,
  ADD COLUMN IF NOT EXISTS "warntext_source_id" uuid,
  ADD COLUMN IF NOT EXISTS "warntext_source_field" text,
  ADD COLUMN IF NOT EXISTS "warntext_linked_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "warntext_overridden_at" timestamp with time zone;

ALTER TABLE "address_contact"
  ADD COLUMN IF NOT EXISTS "notiztext" text,
  ADD COLUMN IF NOT EXISTS "notiztext_source_entity" text,
  ADD COLUMN IF NOT EXISTS "notiztext_source_id" uuid,
  ADD COLUMN IF NOT EXISTS "notiztext_source_field" text,
  ADD COLUMN IF NOT EXISTS "notiztext_linked_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "notiztext_overridden_at" timestamp with time zone;

ALTER TABLE "article_group"
  ADD COLUMN IF NOT EXISTS "print_position_texts" boolean;

ALTER TABLE "article"
  ADD COLUMN IF NOT EXISTS "notiztext" text,
  ADD COLUMN IF NOT EXISTS "notiztext_source_entity" text,
  ADD COLUMN IF NOT EXISTS "notiztext_source_id" uuid,
  ADD COLUMN IF NOT EXISTS "notiztext_source_field" text,
  ADD COLUMN IF NOT EXISTS "notiztext_linked_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "notiztext_overridden_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "langtext" text,
  ADD COLUMN IF NOT EXISTS "langtext_source_entity" text,
  ADD COLUMN IF NOT EXISTS "langtext_source_id" uuid,
  ADD COLUMN IF NOT EXISTS "langtext_source_field" text,
  ADD COLUMN IF NOT EXISTS "langtext_linked_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "langtext_overridden_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "kurzbeschreibung" text,
  ADD COLUMN IF NOT EXISTS "kurzbeschreibung_source_entity" text,
  ADD COLUMN IF NOT EXISTS "kurzbeschreibung_source_id" uuid,
  ADD COLUMN IF NOT EXISTS "kurzbeschreibung_source_field" text,
  ADD COLUMN IF NOT EXISTS "kurzbeschreibung_linked_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "kurzbeschreibung_overridden_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "warntext" text,
  ADD COLUMN IF NOT EXISTS "warntext_source_entity" text,
  ADD COLUMN IF NOT EXISTS "warntext_source_id" uuid,
  ADD COLUMN IF NOT EXISTS "warntext_source_field" text,
  ADD COLUMN IF NOT EXISTS "warntext_linked_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "warntext_overridden_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "print_position_texts" boolean;

ALTER TABLE "document"
  ADD COLUMN IF NOT EXISTS "print_options" jsonb,
  ADD COLUMN IF NOT EXISTS "note_text" text,
  ADD COLUMN IF NOT EXISTS "note_text_source_entity" text,
  ADD COLUMN IF NOT EXISTS "note_text_source_id" uuid,
  ADD COLUMN IF NOT EXISTS "note_text_source_field" text,
  ADD COLUMN IF NOT EXISTS "note_text_linked_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "note_text_overridden_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "pre_text" text,
  ADD COLUMN IF NOT EXISTS "pre_text_source_entity" text,
  ADD COLUMN IF NOT EXISTS "pre_text_source_id" uuid,
  ADD COLUMN IF NOT EXISTS "pre_text_source_field" text,
  ADD COLUMN IF NOT EXISTS "pre_text_linked_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "pre_text_overridden_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "post_text" text,
  ADD COLUMN IF NOT EXISTS "post_text_source_entity" text,
  ADD COLUMN IF NOT EXISTS "post_text_source_id" uuid,
  ADD COLUMN IF NOT EXISTS "post_text_source_field" text,
  ADD COLUMN IF NOT EXISTS "post_text_linked_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "post_text_overridden_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "storno_text" text,
  ADD COLUMN IF NOT EXISTS "storno_text_source_entity" text,
  ADD COLUMN IF NOT EXISTS "storno_text_source_id" uuid,
  ADD COLUMN IF NOT EXISTS "storno_text_source_field" text,
  ADD COLUMN IF NOT EXISTS "storno_text_linked_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "storno_text_overridden_at" timestamp with time zone;

ALTER TABLE "document_line"
  ADD COLUMN IF NOT EXISTS "lang_text" text,
  ADD COLUMN IF NOT EXISTS "lang_text_source_entity" text,
  ADD COLUMN IF NOT EXISTS "lang_text_source_id" uuid,
  ADD COLUMN IF NOT EXISTS "lang_text_source_field" text,
  ADD COLUMN IF NOT EXISTS "lang_text_linked_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "lang_text_overridden_at" timestamp with time zone;
