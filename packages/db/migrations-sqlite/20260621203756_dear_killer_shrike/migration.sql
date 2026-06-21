CREATE TABLE `account_determination_rule` (
	`rule_id` text PRIMARY KEY,
	`company_id` text,
	`article_group_id` text,
	`tax_code_id` text,
	`posting_context` text NOT NULL,
	`gl_account_id` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	CONSTRAINT `fk_account_determination_rule_company_id_company_company_id_fk` FOREIGN KEY (`company_id`) REFERENCES `company`(`company_id`)
);
--> statement-breakpoint
CREATE TABLE `accounting_export_batch` (
	`batch_id` text PRIMARY KEY,
	`company_id` text NOT NULL,
	`fiscal_period_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`row_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`exported_at` integer,
	`created_by` text,
	CONSTRAINT `fk_accounting_export_batch_company_id_company_company_id_fk` FOREIGN KEY (`company_id`) REFERENCES `company`(`company_id`),
	CONSTRAINT `fk_accounting_export_batch_fiscal_period_id_fiscal_period_fiscal_period_id_fk` FOREIGN KEY (`fiscal_period_id`) REFERENCES `fiscal_period`(`fiscal_period_id`),
	CONSTRAINT `accounting_export_batch_period_company` UNIQUE(`fiscal_period_id`,`company_id`),
	CONSTRAINT "chk_accounting_export_batch_status" CHECK(status IN ('pending', 'exported', 'failed'))
);
--> statement-breakpoint
CREATE TABLE `accounting_export_row` (
	`row_id` text PRIMARY KEY,
	`batch_id` text NOT NULL,
	`company_id` text NOT NULL,
	`posting_date` text NOT NULL,
	`gl_account_id` text NOT NULL,
	`cost_center_id` text,
	`tax_code_id` text,
	`debit_amount` numeric DEFAULT '0' NOT NULL,
	`credit_amount` numeric DEFAULT '0' NOT NULL,
	`currency_id` text,
	`source_document_id` text,
	`source_document_no` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	CONSTRAINT `fk_accounting_export_row_batch_id_accounting_export_batch_batch_id_fk` FOREIGN KEY (`batch_id`) REFERENCES `accounting_export_batch`(`batch_id`),
	CONSTRAINT `fk_accounting_export_row_company_id_company_company_id_fk` FOREIGN KEY (`company_id`) REFERENCES `company`(`company_id`),
	CONSTRAINT `fk_accounting_export_row_gl_account_id_gl_account_gl_account_id_fk` FOREIGN KEY (`gl_account_id`) REFERENCES `gl_account`(`gl_account_id`),
	CONSTRAINT `fk_accounting_export_row_cost_center_id_cost_center_cost_center_id_fk` FOREIGN KEY (`cost_center_id`) REFERENCES `cost_center`(`cost_center_id`),
	CONSTRAINT `fk_accounting_export_row_tax_code_id_tax_code_tax_code_id_fk` FOREIGN KEY (`tax_code_id`) REFERENCES `tax_code`(`tax_code_id`),
	CONSTRAINT `fk_accounting_export_row_source_document_id_document_document_id_fk` FOREIGN KEY (`source_document_id`) REFERENCES `document`(`document_id`)
);
--> statement-breakpoint
CREATE TABLE `address` (
	`address_id` text PRIMARY KEY CONSTRAINT `address_tenant_address_id_key` UNIQUE,
	`address_no` text NOT NULL CONSTRAINT `address_tenant_address_no_unique` UNIQUE,
	`is_customer` integer DEFAULT false NOT NULL,
	`is_supplier` integer DEFAULT false NOT NULL,
	`company_name` text,
	`first_name` text,
	`last_name` text,
	`notiztext` text,
	`notiztext_source_entity` text,
	`notiztext_source_id` text,
	`notiztext_source_field` text,
	`notiztext_linked_at` integer,
	`notiztext_overridden_at` integer,
	`langtext` text,
	`langtext_source_entity` text,
	`langtext_source_id` text,
	`langtext_source_field` text,
	`langtext_linked_at` integer,
	`langtext_overridden_at` integer,
	`warntext` text,
	`warntext_source_entity` text,
	`warntext_source_id` text,
	`warntext_source_field` text,
	`warntext_linked_at` integer,
	`warntext_overridden_at` integer,
	`address_line_1` text NOT NULL,
	`address_line_2` text,
	`postal_code` text NOT NULL,
	`city` text NOT NULL,
	`state_province` text,
	`country_code` text NOT NULL,
	`vat_id` text,
	`tax_class_id` text,
	`currency_id` text,
	`payment_term_id` text,
	`archived_at` integer,
	`custom_attributes` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer,
	`default_delivery_address_id` text,
	`search_text` text,
	`address_category_id` text,
	`salutation` text,
	`phone_landline` text,
	`phone_fax` text,
	`phone_mobile` text,
	`email` text,
	`homepage` text,
	`leitweg_id` text,
	`peppol_id` text,
	`coordinates` text,
	`agent_id` text,
	`commission_rate` numeric,
	`credit_rating_score` text,
	`shop_active` integer DEFAULT false NOT NULL,
	CONSTRAINT `fk_address_address_category_id_address_category_category_id_fk` FOREIGN KEY (`address_category_id`) REFERENCES `address_category`(`category_id`),
	CONSTRAINT `fk_address_agent_id_agent_agent_id_fk` FOREIGN KEY (`agent_id`) REFERENCES `agent`(`agent_id`)
);
--> statement-breakpoint
CREATE TABLE `address_category` (
	`category_id` text PRIMARY KEY CONSTRAINT `address_category_tenant_category_id_key` UNIQUE,
	`name` text NOT NULL CONSTRAINT `address_category_tenant_name_unique` UNIQUE,
	`tax_class_id` text,
	`payment_term_id` text,
	`currency_id` text,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`custom_attributes` text,
	CONSTRAINT `fk_address_category_tax_class_id_tax_class_tax_class_id_fk` FOREIGN KEY (`tax_class_id`) REFERENCES `tax_class`(`tax_class_id`),
	CONSTRAINT `fk_address_category_payment_term_id_payment_term_payment_term_id_fk` FOREIGN KEY (`payment_term_id`) REFERENCES `payment_term`(`payment_term_id`)
);
--> statement-breakpoint
CREATE TABLE `address_contact` (
	`contact_id` text PRIMARY KEY,
	`address_id` text,
	`first_name` text,
	`last_name` text NOT NULL,
	`display_name` text,
	`notiztext` text,
	`notiztext_source_entity` text,
	`notiztext_source_id` text,
	`notiztext_source_field` text,
	`notiztext_linked_at` integer,
	`notiztext_overridden_at` integer,
	`email` text,
	`phone_mobile` text,
	`phone_landline` text,
	`role_function` text,
	`is_primary` integer DEFAULT false NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`salutation` text,
	`phone_fax` text,
	`twitter_handle` text,
	`youtube_url` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer,
	CONSTRAINT `fk_address_contact_address_id_address_address_id_fk` FOREIGN KEY (`address_id`) REFERENCES `address`(`address_id`)
);
--> statement-breakpoint
CREATE TABLE `address_contact_identity` (
	`identity_id` text PRIMARY KEY,
	`contact_id` text NOT NULL,
	`source_system` text NOT NULL,
	`source_account_id` text,
	`source_object_id` text,
	`identity_type` text NOT NULL,
	`value` text NOT NULL,
	`normalized_value` text NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`is_verified` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer,
	CONSTRAINT `fk_address_contact_identity_contact_id_address_contact_contact_id_fk` FOREIGN KEY (`contact_id`) REFERENCES `address_contact`(`contact_id`)
);
--> statement-breakpoint
CREATE TABLE `address_seq` (
	`next_val` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `agent` (
	`agent_id` text PRIMARY KEY,
	`agent_no` text NOT NULL CONSTRAINT `uq_agent_tenant_no` UNIQUE,
	`name` text,
	`address_id` text,
	`user_id` text,
	`commission_rate` numeric,
	`active` integer DEFAULT true NOT NULL,
	`archived_at` integer,
	`custom_attributes` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer,
	CONSTRAINT `fk_agent_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_apply_attempt` (
	`attempt_id` text PRIMARY KEY,
	`plan_id` text NOT NULL,
	`applied_plan_json` text NOT NULL,
	`status` text NOT NULL,
	`executed_by_user_id` text NOT NULL,
	`error_logs` text,
	`applied_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer,
	CONSTRAINT `fk_ai_apply_attempt_plan_id_ai_plan_plan_id_fk` FOREIGN KEY (`plan_id`) REFERENCES `ai_plan`(`plan_id`),
	CONSTRAINT `fk_ai_apply_attempt_executed_by_user_id_user_id_fk` FOREIGN KEY (`executed_by_user_id`) REFERENCES `user`(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_context_projection` (
	`projection_id` text PRIMARY KEY,
	`session_id` text NOT NULL,
	`focus_type` text NOT NULL,
	`focus_id` text NOT NULL,
	`snapshot` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_ai_context_projection_session_id_ai_session_session_id_fk` FOREIGN KEY (`session_id`) REFERENCES `ai_session`(`session_id`)
);
--> statement-breakpoint
CREATE TABLE `ai_evidence` (
	`evidence_id` text PRIMARY KEY,
	`plan_id` text NOT NULL,
	`field_name` text NOT NULL,
	`source_text` text NOT NULL,
	`match_confidence` numeric NOT NULL,
	`ambiguity_note` text,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer,
	CONSTRAINT `fk_ai_evidence_plan_id_ai_plan_plan_id_fk` FOREIGN KEY (`plan_id`) REFERENCES `ai_plan`(`plan_id`)
);
--> statement-breakpoint
CREATE TABLE `ai_interpretation` (
	`interpretation_id` text PRIMARY KEY,
	`source_thread_id` text,
	`run_id` text NOT NULL,
	`prompt_version_id` text NOT NULL,
	`business_intent` text NOT NULL,
	`confidence_score` numeric NOT NULL,
	`summary` text NOT NULL,
	`evidence_json` text NOT NULL,
	`extracted_references_json` text NOT NULL,
	`requested_resolvers_json` text NOT NULL,
	`blocking_questions_json` text NOT NULL,
	`raw_llm_trace` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer,
	CONSTRAINT `fk_ai_interpretation_source_thread_id_email_thread_email_thread_id_fk` FOREIGN KEY (`source_thread_id`) REFERENCES `email_thread`(`email_thread_id`),
	CONSTRAINT `fk_ai_interpretation_run_id_ai_run_run_id_fk` FOREIGN KEY (`run_id`) REFERENCES `ai_run`(`run_id`),
	CONSTRAINT `fk_ai_interpretation_prompt_version_id_ai_prompt_version_prompt_version_id_fk` FOREIGN KEY (`prompt_version_id`) REFERENCES `ai_prompt_version`(`prompt_version_id`)
);
--> statement-breakpoint
CREATE TABLE `ai_memory` (
	`memory_id` text PRIMARY KEY,
	`user_id` text,
	`kind` text NOT NULL,
	`text` text NOT NULL,
	`confidence` numeric NOT NULL,
	`source_review_id` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`confirmed_at` integer,
	CONSTRAINT `fk_ai_memory_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`),
	CONSTRAINT `fk_ai_memory_source_review_id_ai_tool_review_review_id_fk` FOREIGN KEY (`source_review_id`) REFERENCES `ai_tool_review`(`review_id`)
);
--> statement-breakpoint
CREATE TABLE `ai_plan` (
	`plan_id` text PRIMARY KEY,
	`run_id` text NOT NULL,
	`prompt_version_id` text NOT NULL,
	`plan_json` text NOT NULL,
	`confidence_score` numeric NOT NULL,
	`apply_readiness` text NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer,
	CONSTRAINT `fk_ai_plan_run_id_ai_run_run_id_fk` FOREIGN KEY (`run_id`) REFERENCES `ai_run`(`run_id`),
	CONSTRAINT `fk_ai_plan_prompt_version_id_ai_prompt_version_prompt_version_id_fk` FOREIGN KEY (`prompt_version_id`) REFERENCES `ai_prompt_version`(`prompt_version_id`)
);
--> statement-breakpoint
CREATE TABLE `ai_prompt_version` (
	`prompt_version_id` text PRIMARY KEY,
	`system_prompt` text NOT NULL,
	`input_schema` text NOT NULL,
	`model_config` text NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `ai_review` (
	`review_id` text PRIMARY KEY,
	`interpretation_id` text NOT NULL,
	`run_id` text NOT NULL,
	`review_status` text NOT NULL,
	`business_case` text NOT NULL,
	`headline` text NOT NULL,
	`summary` text NOT NULL,
	`intent_badge_json` text NOT NULL,
	`sections_json` text NOT NULL,
	`warnings_json` text NOT NULL,
	`blocking_issues_json` text NOT NULL,
	`proposed_apply_payload_json` text NOT NULL,
	`applied_overrides_json` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer,
	CONSTRAINT `fk_ai_review_interpretation_id_ai_interpretation_interpretation_id_fk` FOREIGN KEY (`interpretation_id`) REFERENCES `ai_interpretation`(`interpretation_id`),
	CONSTRAINT `fk_ai_review_run_id_ai_run_run_id_fk` FOREIGN KEY (`run_id`) REFERENCES `ai_run`(`run_id`)
);
--> statement-breakpoint
CREATE TABLE `ai_run` (
	`run_id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`task_scope` text NOT NULL,
	`status` text NOT NULL,
	`duration_ms` integer,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer,
	CONSTRAINT `fk_ai_run_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_session` (
	`session_id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`mode` text DEFAULT 'sync' NOT NULL,
	`focus_type` text NOT NULL,
	`focus_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	CONSTRAINT `fk_ai_session_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_tool_call` (
	`tool_call_id` text PRIMARY KEY,
	`turn_id` text NOT NULL,
	`tool_name` text NOT NULL,
	`input` text NOT NULL,
	`output` text,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_ai_tool_call_turn_id_ai_turn_turn_id_fk` FOREIGN KEY (`turn_id`) REFERENCES `ai_turn`(`turn_id`)
);
--> statement-breakpoint
CREATE TABLE `ai_tool_review` (
	`review_id` text PRIMARY KEY,
	`session_id` text NOT NULL,
	`tool_name` text NOT NULL,
	`proposal` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`applied_at` integer,
	CONSTRAINT `fk_ai_tool_review_session_id_ai_session_session_id_fk` FOREIGN KEY (`session_id`) REFERENCES `ai_session`(`session_id`)
);
--> statement-breakpoint
CREATE TABLE `ai_turn` (
	`turn_id` text PRIMARY KEY,
	`session_id` text NOT NULL,
	`role` text NOT NULL,
	`message` text NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	CONSTRAINT `fk_ai_turn_session_id_ai_session_session_id_fk` FOREIGN KEY (`session_id`) REFERENCES `ai_session`(`session_id`)
);
--> statement-breakpoint
CREATE TABLE `article` (
	`article_id` text PRIMARY KEY CONSTRAINT `article_tenant_article_id_key` UNIQUE,
	`article_no` text NOT NULL CONSTRAINT `article_tenant_article_no_unique` UNIQUE,
	`name` text NOT NULL,
	`notiztext` text,
	`langtext` text,
	`kurzbeschreibung` text,
	`warntext` text,
	`notiztext_source_entity` text,
	`notiztext_source_id` text,
	`notiztext_source_field` text,
	`notiztext_linked_at` integer,
	`notiztext_overridden_at` integer,
	`langtext_source_entity` text,
	`langtext_source_id` text,
	`langtext_source_field` text,
	`langtext_linked_at` integer,
	`langtext_overridden_at` integer,
	`kurzbeschreibung_source_entity` text,
	`kurzbeschreibung_source_id` text,
	`kurzbeschreibung_source_field` text,
	`kurzbeschreibung_linked_at` integer,
	`kurzbeschreibung_overridden_at` integer,
	`warntext_source_entity` text,
	`warntext_source_id` text,
	`warntext_source_field` text,
	`warntext_linked_at` integer,
	`warntext_overridden_at` integer,
	`description` text,
	`article_group_id` text,
	`tax_class_id` text,
	`base_unit_id` text,
	`sales_unit_id` text,
	`purchase_unit_id` text,
	`archived_at` integer,
	`custom_attributes` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer,
	`default_warehouse_id` text,
	`tracking_mode` text,
	`bom_type` text DEFAULT 'none' NOT NULL,
	`print_position_texts` integer,
	`primary_image_id` text,
	CONSTRAINT `fk_article_article_group_id_article_group_article_group_id_fk` FOREIGN KEY (`article_group_id`) REFERENCES `article_group`(`article_group_id`),
	CONSTRAINT `fk_article_tax_class_id_tax_class_tax_class_id_fk` FOREIGN KEY (`tax_class_id`) REFERENCES `tax_class`(`tax_class_id`),
	CONSTRAINT `fk_article_base_unit_id_unit_unit_id_fk` FOREIGN KEY (`base_unit_id`) REFERENCES `unit`(`unit_id`),
	CONSTRAINT `fk_article_sales_unit_id_unit_unit_id_fk` FOREIGN KEY (`sales_unit_id`) REFERENCES `unit`(`unit_id`),
	CONSTRAINT `fk_article_purchase_unit_id_unit_unit_id_fk` FOREIGN KEY (`purchase_unit_id`) REFERENCES `unit`(`unit_id`),
	CONSTRAINT "article_bom_type_check" CHECK(bom_type IN ('none', 'production', 'sales')),
	CONSTRAINT "article_tracking_mode_check" CHECK(tracking_mode IN ('serial', 'batch') OR tracking_mode IS NULL)
);
--> statement-breakpoint
CREATE TABLE `article_bom` (
	`bom_id` text PRIMARY KEY,
	`header_article_id` text NOT NULL,
	`component_article_id` text NOT NULL,
	`quantity` numeric NOT NULL,
	`scrap_percentage` numeric DEFAULT '0' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	CONSTRAINT `fk_article_bom_header_article_id_article_article_id_fk` FOREIGN KEY (`header_article_id`) REFERENCES `article`(`article_id`),
	CONSTRAINT `fk_article_bom_component_article_id_article_article_id_fk` FOREIGN KEY (`component_article_id`) REFERENCES `article`(`article_id`),
	CONSTRAINT `article_bom_tenant_header_article_id_component_article_id_un` UNIQUE(`header_article_id`,`component_article_id`),
	CONSTRAINT "article_bom_quantity_check" CHECK(quantity > 0)
);
--> statement-breakpoint
CREATE TABLE `article_category` (
	`article_category_id` text PRIMARY KEY CONSTRAINT `article_category_tenant_article_category_id_key` UNIQUE,
	`article_id` text NOT NULL,
	`category_id` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	CONSTRAINT `fk_article_category_article_id_article_article_id_fk` FOREIGN KEY (`article_id`) REFERENCES `article`(`article_id`),
	CONSTRAINT `fk_article_category_category_id_category_category_id_fk` FOREIGN KEY (`category_id`) REFERENCES `category`(`category_id`),
	CONSTRAINT `article_category_tenant_article_category_unique` UNIQUE(`article_id`,`category_id`)
);
--> statement-breakpoint
CREATE TABLE `article_group` (
	`article_group_id` text PRIMARY KEY CONSTRAINT `article_group_tenant_article_group_id_key` UNIQUE,
	`code` text NOT NULL CONSTRAINT `article_group_tenant_code_unique` UNIQUE,
	`name` text NOT NULL,
	`tax_class_id` text,
	`base_unit_id` text,
	`sales_unit_id` text,
	`purchase_unit_id` text,
	`tracking_mode` text,
	`bom_type` text DEFAULT 'none' NOT NULL,
	`print_position_texts` integer,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	CONSTRAINT `fk_article_group_tax_class_id_tax_class_tax_class_id_fk` FOREIGN KEY (`tax_class_id`) REFERENCES `tax_class`(`tax_class_id`),
	CONSTRAINT `fk_article_group_base_unit_id_unit_unit_id_fk` FOREIGN KEY (`base_unit_id`) REFERENCES `unit`(`unit_id`),
	CONSTRAINT `fk_article_group_sales_unit_id_unit_unit_id_fk` FOREIGN KEY (`sales_unit_id`) REFERENCES `unit`(`unit_id`),
	CONSTRAINT `fk_article_group_purchase_unit_id_unit_unit_id_fk` FOREIGN KEY (`purchase_unit_id`) REFERENCES `unit`(`unit_id`)
);
--> statement-breakpoint
CREATE TABLE `article_image` (
	`article_image_id` text PRIMARY KEY CONSTRAINT `article_image_tenant_image_id_key` UNIQUE,
	`article_id` text NOT NULL,
	`storage_key` text NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`file_size` integer NOT NULL,
	`width` integer,
	`height` integer,
	`alt_text` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	CONSTRAINT `fk_article_image_article_id_article_article_id_fk` FOREIGN KEY (`article_id`) REFERENCES `article`(`article_id`)
);
--> statement-breakpoint
CREATE TABLE `article_media` (
	`article_media_id` text PRIMARY KEY CONSTRAINT `article_media_tenant_article_media_id_key` UNIQUE,
	`article_id` text NOT NULL,
	`variant_id` text,
	`media_asset_id` text NOT NULL,
	`role` text DEFAULT 'gallery' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	CONSTRAINT `fk_article_media_article_id_article_article_id_fk` FOREIGN KEY (`article_id`) REFERENCES `article`(`article_id`),
	CONSTRAINT `fk_article_media_variant_id_article_variant_variant_id_fk` FOREIGN KEY (`variant_id`) REFERENCES `article_variant`(`variant_id`),
	CONSTRAINT `fk_article_media_media_asset_id_media_asset_media_asset_id_fk` FOREIGN KEY (`media_asset_id`) REFERENCES `media_asset`(`media_asset_id`),
	CONSTRAINT `article_media_tenant_article_media_unique` UNIQUE(`article_id`,`variant_id`,`media_asset_id`,`role`)
);
--> statement-breakpoint
CREATE TABLE `article_option` (
	`option_id` text PRIMARY KEY,
	`article_id` text NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `fk_article_option_article_id_article_article_id_fk` FOREIGN KEY (`article_id`) REFERENCES `article`(`article_id`),
	CONSTRAINT `uq_article_option_name` UNIQUE(`article_id`,`name`)
);
--> statement-breakpoint
CREATE TABLE `article_option_value` (
	`value_id` text PRIMARY KEY,
	`option_id` text NOT NULL,
	`value` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `fk_article_option_value_option_id_article_option_option_id_fk` FOREIGN KEY (`option_id`) REFERENCES `article_option`(`option_id`),
	CONSTRAINT `uq_article_option_value` UNIQUE(`option_id`,`value`)
);
--> statement-breakpoint
CREATE TABLE `article_variant` (
	`variant_id` text PRIMARY KEY,
	`article_id` text NOT NULL,
	`sku` text NOT NULL CONSTRAINT `uq_article_variant_sku` UNIQUE,
	`ean` text,
	`option_value_hash` text NOT NULL,
	`price` numeric,
	`weight` numeric,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	CONSTRAINT `fk_article_variant_article_id_article_article_id_fk` FOREIGN KEY (`article_id`) REFERENCES `article`(`article_id`),
	CONSTRAINT `uq_article_variant_option_hash` UNIQUE(`article_id`,`option_value_hash`)
);
--> statement-breakpoint
CREATE TABLE `article_variant_option_value` (
	`variant_id` text NOT NULL,
	`value_id` text NOT NULL,
	CONSTRAINT `fk_article_variant_option_value_variant_id_article_variant_variant_id_fk` FOREIGN KEY (`variant_id`) REFERENCES `article_variant`(`variant_id`),
	CONSTRAINT `fk_article_variant_option_value_value_id_article_option_value_value_id_fk` FOREIGN KEY (`value_id`) REFERENCES `article_option_value`(`value_id`),
	CONSTRAINT `uq_variant_optval` UNIQUE(`variant_id`,`value_id`)
);
--> statement-breakpoint
CREATE TABLE `article_variant_template` (
	`template_id` text PRIMARY KEY,
	`slug` text NOT NULL CONSTRAINT `uq_article_variant_template_slug` UNIQUE,
	`label` text NOT NULL,
	`article_group_id` text,
	`definition` text NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer,
	CONSTRAINT `fk_article_variant_template_article_group_id_article_group_article_group_id_fk` FOREIGN KEY (`article_group_id`) REFERENCES `article_group`(`article_group_id`)
);
--> statement-breakpoint
CREATE TABLE `bank_account` (
	`bank_account_id` text PRIMARY KEY,
	`address_id` text,
	`iban` text NOT NULL CONSTRAINT `bank_account_tenant_iban_unique` UNIQUE,
	`bic` text,
	`bank_name` text,
	`currency_id` text,
	`is_default` integer DEFAULT false NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`custom_attributes` text,
	CONSTRAINT `fk_bank_account_address_id_address_address_id_fk` FOREIGN KEY (`address_id`) REFERENCES `address`(`address_id`)
);
--> statement-breakpoint
CREATE TABLE `bueroware_record_field` (
	`field_id` text PRIMARY KEY,
	`layout_id` text NOT NULL,
	`bueroware_field_id` text NOT NULL,
	`label` text,
	`sample_value` text,
	`position` integer,
	`length` integer,
	`formatting` text,
	`refresh_table` text,
	`import_marker` text,
	`ordinal` integer,
	`default_target_field` text,
	`default_reference_entity` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	CONSTRAINT `fk_bueroware_record_field_layout_id_bueroware_record_layout_layout_id_fk` FOREIGN KEY (`layout_id`) REFERENCES `bueroware_record_layout`(`layout_id`)
);
--> statement-breakpoint
CREATE TABLE `bueroware_record_layout` (
	`layout_id` text PRIMARY KEY,
	`file_name` text NOT NULL,
	`data_area` text NOT NULL,
	`qualifier` text,
	`default_target_entity` text,
	`catalog_version` integer DEFAULT 1 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`field_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	CONSTRAINT `uq_bueroware_layout_file_qualifier_version` UNIQUE(`file_name`,`qualifier`,`catalog_version`)
);
--> statement-breakpoint
CREATE TABLE `capability_execution_log` (
	`capability_execution_log_id` text PRIMARY KEY,
	`idempotency_key` text NOT NULL,
	`capability_key` text NOT NULL,
	`input_hash` text NOT NULL,
	`status` text NOT NULL,
	`result` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`completed_at` integer
);
--> statement-breakpoint
CREATE TABLE `category` (
	`category_id` text PRIMARY KEY CONSTRAINT `category_tenant_category_id_key` UNIQUE,
	`parent_category_id` text,
	`code` text CONSTRAINT `category_tenant_code_unique` UNIQUE,
	`name` text NOT NULL,
	`slug` text CONSTRAINT `category_tenant_slug_unique` UNIQUE,
	`description` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `commerce_sync_dead_letter` (
	`item_id` text PRIMARY KEY,
	`run_id` text NOT NULL,
	`sales_channel_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`internal_id` text NOT NULL,
	`error_message` text NOT NULL,
	`attempt_count` integer DEFAULT 1 NOT NULL,
	`last_attempted_at` integer NOT NULL,
	`next_retry_at` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`resolved_at` integer,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	CONSTRAINT `fk_commerce_sync_dead_letter_run_id_commerce_sync_run_run_id_fk` FOREIGN KEY (`run_id`) REFERENCES `commerce_sync_run`(`run_id`),
	CONSTRAINT `fk_commerce_sync_dead_letter_sales_channel_id_sales_channel_sales_channel_id_fk` FOREIGN KEY (`sales_channel_id`) REFERENCES `sales_channel`(`sales_channel_id`)
);
--> statement-breakpoint
CREATE TABLE `commerce_sync_run` (
	`run_id` text PRIMARY KEY,
	`sales_channel_id` text NOT NULL,
	`direction` text NOT NULL,
	`mode` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`requested_entities` text NOT NULL,
	`dry_run` integer DEFAULT false NOT NULL,
	`total_items` integer DEFAULT 0 NOT NULL,
	`succeeded_items` integer DEFAULT 0 NOT NULL,
	`failed_items` integer DEFAULT 0 NOT NULL,
	`error_summary` text,
	`started_at` integer,
	`completed_at` integer,
	`cancel_requested_at` integer,
	`created_by_user_id` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	CONSTRAINT `fk_commerce_sync_run_sales_channel_id_sales_channel_sales_channel_id_fk` FOREIGN KEY (`sales_channel_id`) REFERENCES `sales_channel`(`sales_channel_id`)
);
--> statement-breakpoint
CREATE TABLE `commerce_sync_run_step` (
	`step_id` text PRIMARY KEY,
	`run_id` text NOT NULL,
	`sales_channel_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`phase` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`sequence` integer NOT NULL,
	`batch_no` integer DEFAULT 0 NOT NULL,
	`cursor` text,
	`planned_items` integer DEFAULT 0 NOT NULL,
	`succeeded_items` integer DEFAULT 0 NOT NULL,
	`failed_items` integer DEFAULT 0 NOT NULL,
	`payload_summary` text,
	`error_summary` text,
	`started_at` integer,
	`completed_at` integer,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	CONSTRAINT `fk_commerce_sync_run_step_run_id_commerce_sync_run_run_id_fk` FOREIGN KEY (`run_id`) REFERENCES `commerce_sync_run`(`run_id`),
	CONSTRAINT `fk_commerce_sync_run_step_sales_channel_id_sales_channel_sales_channel_id_fk` FOREIGN KEY (`sales_channel_id`) REFERENCES `sales_channel`(`sales_channel_id`),
	CONSTRAINT `uq_commerce_sync_step_sequence` UNIQUE(`run_id`,`sequence`,`batch_no`)
);
--> statement-breakpoint
CREATE TABLE `commerce_webhook_event` (
	`event_id` text PRIMARY KEY,
	`sales_channel_id` text NOT NULL,
	`event_name` text NOT NULL,
	`dedupe_key` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`error_message` text,
	`next_retry_at` integer,
	`processed_at` integer,
	`received_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	CONSTRAINT `fk_commerce_webhook_event_sales_channel_id_sales_channel_sales_channel_id_fk` FOREIGN KEY (`sales_channel_id`) REFERENCES `sales_channel`(`sales_channel_id`),
	CONSTRAINT `uq_commerce_webhook_event_dedupe` UNIQUE(`sales_channel_id`,`dedupe_key`)
);
--> statement-breakpoint
CREATE TABLE `company` (
	`company_id` text PRIMARY KEY CONSTRAINT `company_tenant_company_id_key` UNIQUE,
	`company_no` text NOT NULL CONSTRAINT `company_tenant_company_no_unique` UNIQUE,
	`name` text NOT NULL,
	`legal_name` text,
	`country_code` text NOT NULL,
	`currency_id` text NOT NULL,
	`vat_id` text,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`address_line_1` text,
	`address_line_2` text,
	`city` text,
	`postal_code` text,
	`phone_landline` text,
	`phone_mobile` text,
	`email` text,
	`homepage` text,
	`tax_number` text,
	`tax_authority` text,
	`gln` text,
	`eori_no` text,
	`duns_no` text,
	`custom_attributes` text,
	`bank_name` text,
	`bank_bic` text,
	`bank_iban` text,
	`fiscal_year_start_month` integer DEFAULT 1 NOT NULL,
	`default_warehouse_id` text,
	`copy_long_texts_only_on_change` integer DEFAULT true NOT NULL,
	`print_address_long_text` integer DEFAULT false NOT NULL,
	`print_pre_text` integer DEFAULT false NOT NULL,
	`print_post_text` integer DEFAULT false NOT NULL,
	`print_position_texts` integer DEFAULT false NOT NULL,
	`show_article_image_in_entry` integer DEFAULT false NOT NULL,
	`show_article_image_on_documents` integer DEFAULT false NOT NULL,
	CONSTRAINT "company_fiscal_year_start_month_check" CHECK(fiscal_year_start_month >= 1 AND fiscal_year_start_month <= 12)
);
--> statement-breakpoint
CREATE TABLE `connector_definition` (
	`connector_id` text PRIMARY KEY,
	`slug` text NOT NULL,
	`label` text NOT NULL,
	`default_mappings` text DEFAULT '{}' NOT NULL,
	`locked_fields` text DEFAULT '[]' NOT NULL,
	`atomicity_mode` text NOT NULL,
	CONSTRAINT "connector_definition_atomicity_mode_check" CHECK(atomicity_mode IN ('file', 'entity', 'run'))
);
--> statement-breakpoint
CREATE TABLE `cost_center` (
	`cost_center_id` text PRIMARY KEY CONSTRAINT `cost_center_tenant_cost_center_id_key` UNIQUE,
	`company_id` text,
	`code` text NOT NULL CONSTRAINT `cost_center_tenant_code_unique` UNIQUE,
	`name` text NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	CONSTRAINT `fk_cost_center_company_id_company_company_id_fk` FOREIGN KEY (`company_id`) REFERENCES `company`(`company_id`)
);
--> statement-breakpoint
CREATE TABLE `country` (
	`country_id` text PRIMARY KEY,
	`iso2_code` text NOT NULL,
	`iso3_code` text NOT NULL,
	`name` text NOT NULL,
	`is_eu` integer DEFAULT false NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `currency` (
	`currency_id` text PRIMARY KEY,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`symbol` text,
	`decimals` integer DEFAULT 2 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `delivery_address` (
	`delivery_address_id` text PRIMARY KEY,
	`address_id` text NOT NULL,
	`name` text,
	`address_line_1` text NOT NULL,
	`address_line_2` text,
	`postal_code` text NOT NULL,
	`city` text NOT NULL,
	`country_code` text NOT NULL,
	`default_for_shipping` integer DEFAULT false,
	`archived` integer DEFAULT false NOT NULL,
	`custom_attributes` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer,
	CONSTRAINT `fk_delivery_address_address_id_address_address_id_fk` FOREIGN KEY (`address_id`) REFERENCES `address`(`address_id`)
);
--> statement-breakpoint
CREATE TABLE `dev_cycles` (
	`cycle_id` text PRIMARY KEY,
	`cycle_number` integer NOT NULL,
	`recorded_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`slice_fit_score` integer NOT NULL,
	`slice_fit_max` integer NOT NULL,
	`story_coverage` integer NOT NULL,
	`story_coverage_max` integer NOT NULL,
	`tests_added` integer DEFAULT 0 NOT NULL,
	`vp_test_pass` integer,
	`blocker` text,
	`process_adjustment` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `discount_group` (
	`discount_group_id` text PRIMARY KEY,
	`name` text NOT NULL CONSTRAINT `discount_group_tenant_name_unique` UNIQUE,
	`percentage` numeric NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `document` (
	`document_id` text PRIMARY KEY CONSTRAINT `document_tenant_document_id_key` UNIQUE,
	`company_id` text NOT NULL,
	`document_type` text NOT NULL,
	`document_direction` text NOT NULL,
	`document_no` text NOT NULL,
	`status` text NOT NULL,
	`customer_id` text,
	`currency_id` text,
	`print_options` text,
	`document_date` text NOT NULL,
	`posting_date` text,
	`total_net` numeric,
	`total_tax` numeric,
	`total_gross` numeric,
	`version_no` integer DEFAULT 1 NOT NULL,
	`posted_at` integer,
	`posted_by` text,
	`cancelled_at` integer,
	`storno_document_id` text,
	`custom_attributes` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer,
	`transaction_id` text NOT NULL,
	`parent_document_id` text,
	`document_group_id` text,
	`archived_at` integer,
	`billing_address` text,
	`delivery_address` text,
	`delivery_address_id` text,
	`note_text` text,
	`note_text_source_entity` text,
	`note_text_source_id` text,
	`note_text_source_field` text,
	`note_text_linked_at` integer,
	`note_text_overridden_at` integer,
	`pre_text` text,
	`pre_text_source_entity` text,
	`pre_text_source_id` text,
	`pre_text_source_field` text,
	`pre_text_linked_at` integer,
	`pre_text_overridden_at` integer,
	`post_text` text,
	`post_text_source_entity` text,
	`post_text_source_id` text,
	`post_text_source_field` text,
	`post_text_linked_at` integer,
	`post_text_overridden_at` integer,
	`storno_text` text,
	`storno_text_source_entity` text,
	`storno_text_source_id` text,
	`storno_text_source_field` text,
	`storno_text_linked_at` integer,
	`storno_text_overridden_at` integer,
	`payment_term_id` text,
	`shipping_method_id` text,
	`document_type_id` text,
	`warehouse_id` text,
	`target_warehouse_id` text,
	`is_paid` integer DEFAULT false NOT NULL,
	`paid_at` integer,
	`paid_amount` numeric,
	`total_weight_kg` numeric,
	`agent_id` text,
	`commission_rate` numeric,
	CONSTRAINT `fk_document_company_id_company_company_id_fk` FOREIGN KEY (`company_id`) REFERENCES `company`(`company_id`),
	CONSTRAINT `fk_document_customer_id_address_address_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `address`(`address_id`),
	CONSTRAINT `fk_document_document_group_id_document_group_document_group_id_fk` FOREIGN KEY (`document_group_id`) REFERENCES `document_group`(`document_group_id`),
	CONSTRAINT `fk_document_delivery_address_id_delivery_address_delivery_address_id_fk` FOREIGN KEY (`delivery_address_id`) REFERENCES `delivery_address`(`delivery_address_id`),
	CONSTRAINT `fk_document_document_type_id_document_type_document_type_id_fk` FOREIGN KEY (`document_type_id`) REFERENCES `document_type`(`document_type_id`),
	CONSTRAINT `fk_document_agent_id_agent_agent_id_fk` FOREIGN KEY (`agent_id`) REFERENCES `agent`(`agent_id`),
	CONSTRAINT `document_tenant_company_id_document_no_unique` UNIQUE(`company_id`,`document_no`),
	CONSTRAINT "chk_document_type" CHECK(document_type IN ('N', 'A', 'L', 'R', 'G', 'b', 'l', 'r', 'g', 'Z', 'E', 'V', 'q', 'p', 'U'))
);
--> statement-breakpoint
CREATE TABLE `document_group` (
	`document_group_id` text PRIMARY KEY CONSTRAINT `document_group_tenant_document_group_id_key` UNIQUE,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`number_sequence_id` text,
	`description` text,
	`default_warehouse_id` text,
	`default_tax_code_id` text,
	`default_sales_account_id` text,
	`default_cost_account_id` text,
	`archived` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0,
	`updated_at` integer,
	`default_payment_term_id` text,
	`default_shipping_method_id` text,
	`require_serial_tracking` integer DEFAULT true NOT NULL,
	`require_batch_tracking` integer DEFAULT true NOT NULL,
	`document_type` text NOT NULL,
	`group_number` integer NOT NULL,
	`direction` text,
	`next_group_id` text,
	`company_id` text,
	CONSTRAINT `fk_document_group_company_id_company_company_id_fk` FOREIGN KEY (`company_id`) REFERENCES `company`(`company_id`),
	CONSTRAINT `document_group_tenant_document_type_group_number_unique` UNIQUE(`document_type`,`group_number`),
	CONSTRAINT "document_group_group_number_check" CHECK(group_number >= 0 AND group_number <= 99)
);
--> statement-breakpoint
CREATE TABLE `document_line` (
	`document_line_id` text PRIMARY KEY CONSTRAINT `document_line_tenant_document_line_id_key` UNIQUE,
	`document_id` text NOT NULL,
	`line_no` integer NOT NULL,
	`variant_id` text,
	`article_text_snapshot` text,
	`lang_text` text,
	`lang_text_source_entity` text,
	`lang_text_source_id` text,
	`lang_text_source_field` text,
	`lang_text_linked_at` integer,
	`lang_text_overridden_at` integer,
	`quantity` numeric NOT NULL,
	`unit` text,
	`net_price` numeric NOT NULL,
	`discount_percentage` numeric,
	`tax_code_id` text,
	`tax_reason` text,
	`tax_rule_id` text,
	`tax_country_code_used` text,
	`tax_rate_snapshot` numeric,
	`tax_amount` numeric,
	`line_total_net` numeric,
	`warehouse_id` text,
	`cost_center_id` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`archived_at` integer,
	`transaction_id` text,
	`movement_type` text,
	`line_type` text DEFAULT 'article' NOT NULL,
	`bom_group_id` text,
	`line_weight_kg` numeric,
	CONSTRAINT `fk_document_line_document_id_document_document_id_fk` FOREIGN KEY (`document_id`) REFERENCES `document`(`document_id`),
	CONSTRAINT `fk_document_line_variant_id_article_variant_variant_id_fk` FOREIGN KEY (`variant_id`) REFERENCES `article_variant`(`variant_id`),
	CONSTRAINT `fk_document_line_tax_rule_id_tax_rule_tax_rule_id_fk` FOREIGN KEY (`tax_rule_id`) REFERENCES `tax_rule`(`tax_rule_id`),
	CONSTRAINT `fk_document_line_cost_center_id_cost_center_cost_center_id_fk` FOREIGN KEY (`cost_center_id`) REFERENCES `cost_center`(`cost_center_id`),
	CONSTRAINT `document_line_tenant_document_id_line_no_unique` UNIQUE(`document_id`,`line_no`,`archived_at`),
	CONSTRAINT "chk_article_line_requires_variant_id" CHECK(line_type <> 'article' OR variant_id IS NOT NULL),
	CONSTRAINT "chk_document_line_movement_type" CHECK(movement_type IN ('N', 'A', 'L', 'R', 'G', 'b', 'l', 'r', 'g', 'Z', 'E', 'V', 'q', 'p', 'U') OR movement_type IS NULL),
	CONSTRAINT "document_line_line_type_check" CHECK(line_type IN ('article', 'comment', 'production_output', 'sales_bom_header', 'bom_component'))
);
--> statement-breakpoint
CREATE TABLE `document_line_allocation` (
	`allocation_id` text PRIMARY KEY,
	`source_document_line_id` text NOT NULL,
	`target_document_line_id` text NOT NULL,
	`allocated_qty` numeric NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	CONSTRAINT `fk_document_line_allocation_source_document_line_id_document_line_document_line_id_fk` FOREIGN KEY (`source_document_line_id`) REFERENCES `document_line`(`document_line_id`),
	CONSTRAINT `fk_document_line_allocation_target_document_line_id_document_line_document_line_id_fk` FOREIGN KEY (`target_document_line_id`) REFERENCES `document_line`(`document_line_id`),
	CONSTRAINT `document_line_allocation_source_target_unique` UNIQUE(`source_document_line_id`,`target_document_line_id`)
);
--> statement-breakpoint
CREATE TABLE `document_line_tracking` (
	`tracking_id` text PRIMARY KEY,
	`document_line_id` text NOT NULL,
	`serial_number_id` text,
	`serial_no` text,
	`batch_no` text,
	`qty` numeric NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	CONSTRAINT `fk_document_line_tracking_document_line_id_document_line_document_line_id_fk` FOREIGN KEY (`document_line_id`) REFERENCES `document_line`(`document_line_id`),
	CONSTRAINT "document_line_tracking_check" CHECK(
        (
          serial_number_id IS NOT NULL
          AND serial_no IS NULL
          AND batch_no IS NULL
        )
        OR (
          serial_number_id IS NULL
          AND serial_no IS NOT NULL
          AND batch_no IS NULL
        )
        OR (
          serial_number_id IS NULL
          AND serial_no IS NULL
          AND batch_no IS NOT NULL
        )
      )
);
--> statement-breakpoint
CREATE TABLE `document_shipment` (
	`document_shipment_id` text PRIMARY KEY,
	`document_id` text NOT NULL CONSTRAINT `uq_document_shipment` UNIQUE,
	`shipment_status` text DEFAULT 'open' NOT NULL,
	`carrier_key` text DEFAULT 'dhl' NOT NULL,
	`carrier_service_key` text DEFAULT 'paket' NOT NULL,
	`tracking_id` text,
	`recipient_name` text NOT NULL,
	`company` text,
	`street` text NOT NULL,
	`house_number` text NOT NULL,
	`postal_code` text NOT NULL,
	`city` text NOT NULL,
	`country_code` text DEFAULT 'DE' NOT NULL,
	`email` text,
	`phone` text,
	`exported_at` integer,
	`label_created_at` integer,
	`shipped_at` integer,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer,
	CONSTRAINT `fk_document_shipment_document_id_document_document_id_fk` FOREIGN KEY (`document_id`) REFERENCES `document`(`document_id`)
);
--> statement-breakpoint
CREATE TABLE `document_shipment_package` (
	`document_shipment_package_id` text PRIMARY KEY,
	`document_shipment_id` text NOT NULL,
	`seq` integer DEFAULT 1 NOT NULL,
	`weight_kg` numeric DEFAULT '1.0' NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	CONSTRAINT `fk_document_shipment_package_document_shipment_id_document_shipment_document_shipment_id_fk` FOREIGN KEY (`document_shipment_id`) REFERENCES `document_shipment`(`document_shipment_id`)
);
--> statement-breakpoint
CREATE TABLE `document_type` (
	`document_type_id` text PRIMARY KEY CONSTRAINT `document_type_tenant_document_type_id_key` UNIQUE,
	`code` text NOT NULL CONSTRAINT `document_type_tenant_code_unique` UNIQUE,
	`name` text NOT NULL,
	`movement_type` text NOT NULL,
	`next_document_type_id` text,
	`requires_warehouse` integer DEFAULT true NOT NULL,
	`requires_cost_center` integer DEFAULT false NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	CONSTRAINT "document_type_movement_type_check" CHECK(movement_type IN ('N', 'A', 'L', 'R', 'G', 'b', 'l', 'r', 'g', 'Z', 'E', 'V', 'q', 'p', 'U'))
);
--> statement-breakpoint
CREATE TABLE `email_account` (
	`email_account_id` text PRIMARY KEY,
	`provider` text NOT NULL,
	`provider_account_id` text NOT NULL,
	`display_name` text NOT NULL,
	`primary_email` text NOT NULL,
	`status` text DEFAULT 'connected' NOT NULL,
	`credentials_encrypted` text NOT NULL,
	`scopes` text DEFAULT '[]' NOT NULL,
	`last_sync_at` integer,
	`last_sync_status` text DEFAULT 'idle' NOT NULL,
	`last_sync_error` text,
	`watch_expires_at` integer,
	`activity_tier` text DEFAULT 'cold' NOT NULL,
	`last_user_activity_at` integer,
	`sync_priority` text DEFAULT 'normal' NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`granted_by_user_id` text,
	`granted_scopes` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer,
	CONSTRAINT `fk_email_account_granted_by_user_id_user_id_fk` FOREIGN KEY (`granted_by_user_id`) REFERENCES `user`(`id`),
	CONSTRAINT `email_account_tenant_provider_account_unique` UNIQUE(`provider`,`provider_account_id`),
	CONSTRAINT "chk_email_account_provider" CHECK(provider IN ('gmail', 'microsoft')),
	CONSTRAINT "chk_email_account_status" CHECK(status IN ('connected', 'reauth_required', 'disabled', 'error')),
	CONSTRAINT "chk_email_account_sync_status" CHECK(last_sync_status IN ('idle', 'queued', 'syncing', 'ok', 'error', 'recovery_required')),
	CONSTRAINT "chk_email_account_activity_tier" CHECK(activity_tier IN ('hot', 'warm', 'cold', 'dormant')),
	CONSTRAINT "chk_email_account_sync_priority" CHECK(sync_priority IN ('high', 'normal', 'low'))
);
--> statement-breakpoint
CREATE TABLE `email_account_user_grant` (
	`email_account_user_grant_id` text PRIMARY KEY,
	`email_account_id` text NOT NULL,
	`user_id` text NOT NULL,
	`can_read` integer DEFAULT true NOT NULL,
	`can_send` integer DEFAULT false NOT NULL,
	`can_manage` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	CONSTRAINT `fk_email_account_user_grant_email_account_id_email_account_email_account_id_fk` FOREIGN KEY (`email_account_id`) REFERENCES `email_account`(`email_account_id`),
	CONSTRAINT `fk_email_account_user_grant_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`),
	CONSTRAINT `email_account_grant_user_unique` UNIQUE(`email_account_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `email_attachment` (
	`email_attachment_id` text PRIMARY KEY,
	`email_message_id` text NOT NULL,
	`provider_attachment_id` text,
	`file_name` text NOT NULL,
	`content_type` text,
	`size_bytes` integer,
	`storage_key` text,
	`inline_content_id` text,
	`fetched_at` integer,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	CONSTRAINT `fk_email_attachment_email_message_id_email_message_email_message_id_fk` FOREIGN KEY (`email_message_id`) REFERENCES `email_message`(`email_message_id`),
	CONSTRAINT `email_attachment_message_provider_unique` UNIQUE(`email_message_id`,`provider_attachment_id`)
);
--> statement-breakpoint
CREATE TABLE `email_identity` (
	`email_identity_id` text PRIMARY KEY,
	`email_account_id` text NOT NULL,
	`email` text NOT NULL,
	`display_name` text,
	`provider_identity_id` text,
	`is_primary` integer DEFAULT false NOT NULL,
	`can_send` integer DEFAULT true NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	CONSTRAINT `fk_email_identity_email_account_id_email_account_email_account_id_fk` FOREIGN KEY (`email_account_id`) REFERENCES `email_account`(`email_account_id`),
	CONSTRAINT `email_identity_account_email_unique` UNIQUE(`email_account_id`,`email`)
);
--> statement-breakpoint
CREATE TABLE `email_job` (
	`email_job_id` text PRIMARY KEY,
	`email_account_id` text,
	`job_type` text NOT NULL,
	`idempotency_key` text NOT NULL CONSTRAINT `email_job_idempotency_unique` UNIQUE,
	`payload` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`priority` integer DEFAULT 2 NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 5 NOT NULL,
	`run_after` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`locked_at` integer,
	`locked_by` text,
	`last_error` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer,
	CONSTRAINT `fk_email_job_email_account_id_email_account_email_account_id_fk` FOREIGN KEY (`email_account_id`) REFERENCES `email_account`(`email_account_id`),
	CONSTRAINT "chk_email_job_type" CHECK(job_type IN ('initial_sync', 'incremental_sync', 'watch_renewal', 'reconcile', 'send', 'fetch_attachment', 'sync_contacts')),
	CONSTRAINT "chk_email_job_status" CHECK(status IN ('queued', 'processing', 'done', 'failed')),
	CONSTRAINT "chk_email_job_priority" CHECK(priority BETWEEN 1 AND 3)
);
--> statement-breakpoint
CREATE TABLE `email_label` (
	`email_label_id` text PRIMARY KEY,
	`email_account_id` text NOT NULL,
	`provider_label_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text DEFAULT 'label' NOT NULL,
	`color` text,
	`parent_provider_label_id` text,
	`message_count` integer DEFAULT 0 NOT NULL,
	`unread_count` integer DEFAULT 0 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer,
	CONSTRAINT `fk_email_label_email_account_id_email_account_email_account_id_fk` FOREIGN KEY (`email_account_id`) REFERENCES `email_account`(`email_account_id`),
	CONSTRAINT `email_label_account_provider_unique` UNIQUE(`email_account_id`,`provider_label_id`),
	CONSTRAINT "chk_email_label_kind" CHECK(kind IN ('system', 'folder', 'label'))
);
--> statement-breakpoint
CREATE TABLE `email_message` (
	`email_message_id` text PRIMARY KEY,
	`email_account_id` text NOT NULL,
	`email_thread_id` text NOT NULL,
	`provider_message_id` text NOT NULL,
	`provider_draft_id` text,
	`internet_message_id` text,
	`direction` text NOT NULL,
	`from_json` text DEFAULT '{}' NOT NULL,
	`to_json` text DEFAULT '[]' NOT NULL,
	`cc_json` text DEFAULT '[]' NOT NULL,
	`bcc_json` text DEFAULT '[]' NOT NULL,
	`subject` text,
	`snippet` text,
	`body_html` text,
	`body_text` text,
	`sent_at` integer,
	`received_at` integer,
	`is_read` integer DEFAULT false NOT NULL,
	`has_attachments` integer DEFAULT false NOT NULL,
	`raw_headers` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer,
	CONSTRAINT `fk_email_message_email_account_id_email_account_email_account_id_fk` FOREIGN KEY (`email_account_id`) REFERENCES `email_account`(`email_account_id`),
	CONSTRAINT `fk_email_message_email_thread_id_email_thread_email_thread_id_fk` FOREIGN KEY (`email_thread_id`) REFERENCES `email_thread`(`email_thread_id`),
	CONSTRAINT `email_message_account_provider_unique` UNIQUE(`email_account_id`,`provider_message_id`),
	CONSTRAINT "chk_email_message_direction" CHECK(direction IN ('inbound', 'outbound', 'draft'))
);
--> statement-breakpoint
CREATE TABLE `email_message_label` (
	`email_message_label_id` text PRIMARY KEY,
	`email_message_id` text NOT NULL,
	`email_label_id` text NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	CONSTRAINT `fk_email_message_label_email_message_id_email_message_email_message_id_fk` FOREIGN KEY (`email_message_id`) REFERENCES `email_message`(`email_message_id`),
	CONSTRAINT `fk_email_message_label_email_label_id_email_label_email_label_id_fk` FOREIGN KEY (`email_label_id`) REFERENCES `email_label`(`email_label_id`),
	CONSTRAINT `email_message_label_unique` UNIQUE(`email_message_id`,`email_label_id`)
);
--> statement-breakpoint
CREATE TABLE `email_outbox` (
	`email_outbox_id` text PRIMARY KEY,
	`email_account_id` text NOT NULL,
	`email_identity_id` text NOT NULL,
	`email_message_id` text,
	`provider_draft_id` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	`scheduled_for` integer,
	`sent_at` integer,
	`last_error` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer,
	`created_by` text,
	CONSTRAINT `fk_email_outbox_email_account_id_email_account_email_account_id_fk` FOREIGN KEY (`email_account_id`) REFERENCES `email_account`(`email_account_id`),
	CONSTRAINT `fk_email_outbox_email_identity_id_email_identity_email_identity_id_fk` FOREIGN KEY (`email_identity_id`) REFERENCES `email_identity`(`email_identity_id`),
	CONSTRAINT `fk_email_outbox_email_message_id_email_message_email_message_id_fk` FOREIGN KEY (`email_message_id`) REFERENCES `email_message`(`email_message_id`),
	CONSTRAINT `fk_email_outbox_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`),
	CONSTRAINT "chk_email_outbox_status" CHECK(status IN ('draft', 'queued', 'sending', 'sent', 'failed'))
);
--> statement-breakpoint
CREATE TABLE `email_subscription` (
	`email_subscription_id` text PRIMARY KEY,
	`email_account_id` text NOT NULL,
	`resource` text DEFAULT 'mail' NOT NULL,
	`provider_subscription_id` text,
	`channel_token` text,
	`expires_at` integer,
	`renewed_at` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`renewal_attempts` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer,
	CONSTRAINT `fk_email_subscription_email_account_id_email_account_email_account_id_fk` FOREIGN KEY (`email_account_id`) REFERENCES `email_account`(`email_account_id`),
	CONSTRAINT `email_subscription_account_resource_unique` UNIQUE(`email_account_id`,`resource`),
	CONSTRAINT "chk_email_subscription_resource" CHECK(resource IN ('mail', 'calendar', 'contacts')),
	CONSTRAINT "chk_email_subscription_status" CHECK(status IN ('active', 'expired', 'renewal_pending', 'failed'))
);
--> statement-breakpoint
CREATE TABLE `email_sync_state` (
	`email_sync_state_id` text PRIMARY KEY,
	`email_account_id` text NOT NULL,
	`scope` text DEFAULT 'mailbox' NOT NULL,
	`cursor` text,
	`cursor_json` text,
	`status` text DEFAULT 'idle' NOT NULL,
	`last_synced_at` integer,
	`last_error` text,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	CONSTRAINT `fk_email_sync_state_email_account_id_email_account_email_account_id_fk` FOREIGN KEY (`email_account_id`) REFERENCES `email_account`(`email_account_id`),
	CONSTRAINT `email_sync_state_account_scope_unique` UNIQUE(`email_account_id`,`scope`),
	CONSTRAINT "chk_email_sync_state_status" CHECK(status IN ('idle', 'queued', 'syncing', 'ok', 'error', 'recovery_required'))
);
--> statement-breakpoint
CREATE TABLE `email_template` (
	`email_template_id` text PRIMARY KEY,
	`category` text DEFAULT 'document' NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`subject_template` text NOT NULL,
	`body_html_template` text NOT NULL,
	`body_text_template` text,
	`language` text,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer,
	CONSTRAINT `email_template_tenant_category_code_unique` UNIQUE(`category`,`code`)
);
--> statement-breakpoint
CREATE TABLE `email_template_binding` (
	`email_template_binding_id` text PRIMARY KEY,
	`email_template_id` text NOT NULL,
	`document_type` text,
	`company_id` text,
	`language` text,
	`email_identity_id` text,
	`priority` integer DEFAULT 100 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	CONSTRAINT `fk_email_template_binding_email_template_id_email_template_email_template_id_fk` FOREIGN KEY (`email_template_id`) REFERENCES `email_template`(`email_template_id`),
	CONSTRAINT `fk_email_template_binding_company_id_company_company_id_fk` FOREIGN KEY (`company_id`) REFERENCES `company`(`company_id`),
	CONSTRAINT `fk_email_template_binding_email_identity_id_email_identity_email_identity_id_fk` FOREIGN KEY (`email_identity_id`) REFERENCES `email_identity`(`email_identity_id`)
);
--> statement-breakpoint
CREATE TABLE `email_template_render_log` (
	`email_template_render_log_id` text PRIMARY KEY,
	`email_template_id` text,
	`email_template_binding_id` text,
	`document_id` text,
	`email_identity_id` text,
	`language` text,
	`subject` text NOT NULL,
	`rendered_hash` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`created_by` text,
	CONSTRAINT `fk_email_template_render_log_email_template_id_email_template_email_template_id_fk` FOREIGN KEY (`email_template_id`) REFERENCES `email_template`(`email_template_id`),
	CONSTRAINT `fk_email_template_render_log_email_template_binding_id_email_template_binding_email_template_binding_id_fk` FOREIGN KEY (`email_template_binding_id`) REFERENCES `email_template_binding`(`email_template_binding_id`),
	CONSTRAINT `fk_email_template_render_log_document_id_document_document_id_fk` FOREIGN KEY (`document_id`) REFERENCES `document`(`document_id`),
	CONSTRAINT `fk_email_template_render_log_email_identity_id_email_identity_email_identity_id_fk` FOREIGN KEY (`email_identity_id`) REFERENCES `email_identity`(`email_identity_id`),
	CONSTRAINT `fk_email_template_render_log_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`)
);
--> statement-breakpoint
CREATE TABLE `email_thread` (
	`email_thread_id` text PRIMARY KEY,
	`email_account_id` text NOT NULL,
	`provider_thread_id` text NOT NULL,
	`subject` text,
	`snippet` text,
	`last_message_at` integer,
	`is_read` integer DEFAULT false NOT NULL,
	`is_starred` integer DEFAULT false NOT NULL,
	`message_count` integer DEFAULT 0 NOT NULL,
	`related_address_id` text,
	`related_document_id` text,
	`archived` integer DEFAULT false NOT NULL,
	`in_trash` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer,
	CONSTRAINT `fk_email_thread_email_account_id_email_account_email_account_id_fk` FOREIGN KEY (`email_account_id`) REFERENCES `email_account`(`email_account_id`),
	CONSTRAINT `fk_email_thread_related_address_id_address_address_id_fk` FOREIGN KEY (`related_address_id`) REFERENCES `address`(`address_id`),
	CONSTRAINT `fk_email_thread_related_document_id_document_document_id_fk` FOREIGN KEY (`related_document_id`) REFERENCES `document`(`document_id`),
	CONSTRAINT `email_thread_account_provider_unique` UNIQUE(`email_account_id`,`provider_thread_id`)
);
--> statement-breakpoint
CREATE TABLE `entity_commands` (
	`command_id` text PRIMARY KEY,
	`scope` text DEFAULT 'global' NOT NULL,
	`organization_id` text,
	`entity_name` text NOT NULL,
	`command_key` text NOT NULL,
	`handlerkey` text,
	`label` text NOT NULL,
	`description` text,
	`http_method` text DEFAULT 'POST' NOT NULL,
	`route_pattern` text NOT NULL,
	`entity_id_param` text,
	`parent_entity` text,
	`parent_id_source` text,
	`input_schema` text DEFAULT '{}' NOT NULL,
	`server_managed` text DEFAULT '[]' NOT NULL,
	`ui_placement` text,
	`ui_icon` text,
	`ui_shortcut` text,
	`ui_confirm` text,
	`writes_tables` text DEFAULT '[]' NOT NULL,
	`side_effects` text DEFAULT '[]' NOT NULL,
	`min_role` text DEFAULT 'tenant_user' NOT NULL,
	`visibility` text DEFAULT 'tenant' NOT NULL,
	`command_state` text DEFAULT 'published' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	CONSTRAINT `fk_entity_commands_organization_id_organization_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`organization_id`),
	CONSTRAINT `entity_commands_scope_organization_id_tenant_entity_name_com` UNIQUE(`scope`,`organization_id`,`entity_name`,`command_key`)
);
--> statement-breakpoint
CREATE TABLE `external_sync_mapping` (
	`mapping_id` text PRIMARY KEY,
	`sales_channel_id` text,
	`source_system` text DEFAULT 'sales_channel' NOT NULL,
	`entity_type` text NOT NULL,
	`internal_id` text NOT NULL,
	`external_id` text NOT NULL,
	`external_parent_id` text,
	`external_version` text,
	`sync_direction` text NOT NULL,
	`payload_snapshot` text,
	`last_sync_at` integer,
	`sync_status` text DEFAULT 'pending' NOT NULL,
	`error_log` text,
	`deleted_at` integer,
	`external_deleted_at` integer,
	CONSTRAINT `fk_external_sync_mapping_sales_channel_id_sales_channel_sales_channel_id_fk` FOREIGN KEY (`sales_channel_id`) REFERENCES `sales_channel`(`sales_channel_id`),
	CONSTRAINT `uq_ext_sync_internal` UNIQUE(`sales_channel_id`,`entity_type`,`internal_id`),
	CONSTRAINT `uq_ext_sync_external` UNIQUE(`sales_channel_id`,`entity_type`,`external_id`),
	CONSTRAINT `uq_ext_sync_external_key` UNIQUE(`source_system`,`entity_type`,`external_id`)
);
--> statement-breakpoint
CREATE TABLE `fact_purchase_event` (
	`fact_purchase_event_id` text PRIMARY KEY,
	`company_id` text NOT NULL,
	`source_document_id` text,
	`source_document_line_id` text,
	`supplier_id` text,
	`article_id` text,
	`event_type` text DEFAULT 'purchase' NOT NULL,
	`quantity_delta` numeric NOT NULL,
	`amount_net_delta` numeric NOT NULL,
	`avg_cost_before` numeric,
	`avg_cost_after` numeric,
	`fiscal_period_id` text,
	`booking_period` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `fact_sales_event` (
	`fact_sales_event_id` text PRIMARY KEY,
	`company_id` text,
	`source_document_id` text,
	`source_document_line_id` text,
	`customer_id` text,
	`article_id` text,
	`variant_id` text,
	`event_type` text,
	`quantity_delta` numeric NOT NULL,
	`amount_net_delta` numeric NOT NULL,
	`booking_period` text NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`transaction_id` text,
	`cogs_delta` numeric,
	`fiscal_period_id` text,
	CONSTRAINT `fk_fact_sales_event_company_id_company_company_id_fk` FOREIGN KEY (`company_id`) REFERENCES `company`(`company_id`),
	CONSTRAINT `fk_fact_sales_event_source_document_id_document_document_id_fk` FOREIGN KEY (`source_document_id`) REFERENCES `document`(`document_id`),
	CONSTRAINT `fk_fact_sales_event_source_document_line_id_document_line_document_line_id_fk` FOREIGN KEY (`source_document_line_id`) REFERENCES `document_line`(`document_line_id`),
	CONSTRAINT `fk_fact_sales_event_customer_id_address_address_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `address`(`address_id`),
	CONSTRAINT `fk_fact_sales_event_article_id_article_article_id_fk` FOREIGN KEY (`article_id`) REFERENCES `article`(`article_id`),
	CONSTRAINT `fk_fact_sales_event_variant_id_article_variant_variant_id_fk` FOREIGN KEY (`variant_id`) REFERENCES `article_variant`(`variant_id`)
);
--> statement-breakpoint
CREATE TABLE `fiscal_period` (
	`fiscal_period_id` text PRIMARY KEY,
	`company_id` text NOT NULL,
	`fiscal_year` integer NOT NULL,
	`period_no` integer NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`is_closed` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	CONSTRAINT `fk_fiscal_period_company_id_company_company_id_fk` FOREIGN KEY (`company_id`) REFERENCES `company`(`company_id`),
	CONSTRAINT `fiscal_period_company_year_period` UNIQUE(`company_id`,`fiscal_year`,`period_no`)
);
--> statement-breakpoint
CREATE TABLE `gl_account` (
	`gl_account_id` text PRIMARY KEY CONSTRAINT `gl_account_tenant_gl_account_id_key` UNIQUE,
	`company_id` text,
	`account_no` text NOT NULL CONSTRAINT `gl_account_tenant_account_no_unique` UNIQUE,
	`name` text NOT NULL,
	`account_type` text NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	CONSTRAINT `fk_gl_account_company_id_company_company_id_fk` FOREIGN KEY (`company_id`) REFERENCES `company`(`company_id`)
);
--> statement-breakpoint
CREATE TABLE `helper_table_registry` (
	`id` text PRIMARY KEY,
	`table_name` text NOT NULL UNIQUE,
	`label` text NOT NULL,
	`pk_column` text NOT NULL,
	`display_column` text NOT NULL,
	`display_is_i18n` integer DEFAULT false NOT NULL,
	`code_column` text,
	`is_tenant_scoped` integer DEFAULT false NOT NULL,
	`default_filter` text,
	`sort_column` text NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`value_column` text,
	`group` text,
	`category` text
);
--> statement-breakpoint
CREATE TABLE `import_batch` (
	`batch_id` text PRIMARY KEY,
	`connector_id` text,
	`profile_id` text,
	`mapping_version_id` text,
	`atomicity_mode` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`is_dry_run` integer DEFAULT true NOT NULL,
	`is_rerun` integer DEFAULT false NOT NULL,
	`source_batch_id` text,
	`source_file_name` text,
	`posted_entity_count` integer DEFAULT 0 NOT NULL,
	`failed_entity_count` integer DEFAULT 0 NOT NULL,
	`pending_reference_count` integer DEFAULT 0 NOT NULL,
	`error_summary` text,
	`file_path` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`processed_at` integer,
	`target_entity` text,
	`target_command_key` text,
	`layout_id` text,
	CONSTRAINT `fk_import_batch_profile_id_import_profile_profile_id_fk` FOREIGN KEY (`profile_id`) REFERENCES `import_profile`(`profile_id`),
	CONSTRAINT `fk_import_batch_mapping_version_id_import_profile_mapping_version_version_id_fk` FOREIGN KEY (`mapping_version_id`) REFERENCES `import_profile_mapping_version`(`version_id`),
	CONSTRAINT `fk_import_batch_layout_id_bueroware_record_layout_layout_id_fk` FOREIGN KEY (`layout_id`) REFERENCES `bueroware_record_layout`(`layout_id`),
	CONSTRAINT "import_batch_atomicity_mode_check" CHECK(atomicity_mode IN ('file', 'entity', 'run')),
	CONSTRAINT "import_batch_status_check" CHECK(status IN ('pending', 'queued', 'processing', 'validating', 'validated', 'approved', 'posted', 'failed', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE `import_field_mapping` (
	`mapping_id` text PRIMARY KEY,
	`version_id` text NOT NULL,
	`position` integer,
	`length` integer,
	`qualifier` text,
	`formatting` text,
	`source_field` text,
	`target_field` text NOT NULL,
	`target_entity` text,
	`reference_entity` text,
	`is_required` integer DEFAULT false NOT NULL,
	`default_value` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	CONSTRAINT `fk_import_field_mapping_version_id_import_profile_mapping_version_version_id_fk` FOREIGN KEY (`version_id`) REFERENCES `import_profile_mapping_version`(`version_id`)
);
--> statement-breakpoint
CREATE TABLE `import_profile` (
	`profile_id` text PRIMARY KEY,
	`slug` text NOT NULL CONSTRAINT `uq_import_profile_tenant_slug` UNIQUE,
	`label` text NOT NULL,
	`target_entity` text NOT NULL,
	`target_command_key` text NOT NULL,
	`requires_approval` integer DEFAULT true NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `import_profile_mapping_version` (
	`version_id` text PRIMARY KEY,
	`tenant_connector_id` text,
	`profile_id` text,
	`source_system` text,
	`source_file_name` text,
	`target_entity` text,
	`layout_id` text,
	`version_no` integer DEFAULT 1 NOT NULL,
	`mappings` text NOT NULL,
	`is_active` integer DEFAULT false NOT NULL,
	`activated_at` integer,
	`activated_by` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	CONSTRAINT `fk_import_profile_mapping_version_tenant_connector_id_tenant_connector_tenant_connector_id_fk` FOREIGN KEY (`tenant_connector_id`) REFERENCES `tenant_connector`(`tenant_connector_id`),
	CONSTRAINT `fk_import_profile_mapping_version_profile_id_import_profile_profile_id_fk` FOREIGN KEY (`profile_id`) REFERENCES `import_profile`(`profile_id`),
	CONSTRAINT `fk_import_profile_mapping_version_layout_id_bueroware_record_layout_layout_id_fk` FOREIGN KEY (`layout_id`) REFERENCES `bueroware_record_layout`(`layout_id`),
	CONSTRAINT `uq_import_profile_mapping_version` UNIQUE(`tenant_connector_id`,`profile_id`,`version_no`),
	CONSTRAINT `uq_import_mapping_source_version` UNIQUE(`source_system`,`source_file_name`,`layout_id`,`version_no`)
);
--> statement-breakpoint
CREATE TABLE `import_row` (
	`row_id` text PRIMARY KEY,
	`batch_id` text NOT NULL,
	`target_entity` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`missing_references` text,
	`error_detail` text,
	`posted_at` integer,
	CONSTRAINT `fk_import_row_batch_id_import_batch_batch_id_fk` FOREIGN KEY (`batch_id`) REFERENCES `import_batch`(`batch_id`),
	CONSTRAINT "import_row_status_check" CHECK(status IN ('pending', 'valid', 'posted', 'failed', 'pending_references'))
);
--> statement-breakpoint
CREATE TABLE `incoterm` (
	`incoterm_id` text PRIMARY KEY,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `industry` (
	`industry_id` text PRIMARY KEY,
	`name` text NOT NULL CONSTRAINT `industry_tenant_name_unique` UNIQUE,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`custom_attributes` text
);
--> statement-breakpoint
CREATE TABLE `inventory_balance` (
	`inventory_balance_id` text PRIMARY KEY,
	`company_id` text,
	`warehouse_id` text NOT NULL,
	`inventory_item_id` text,
	`article_id` text,
	`on_hand_qty` numeric DEFAULT '0' NOT NULL,
	`reserved_qty` numeric DEFAULT '0' NOT NULL,
	`as_of_at` integer,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`available_qty` numeric,
	`expected_purchase_qty` numeric DEFAULT '0' NOT NULL,
	`gld_purchase` numeric,
	`gld_cost` numeric,
	CONSTRAINT `fk_inventory_balance_company_id_company_company_id_fk` FOREIGN KEY (`company_id`) REFERENCES `company`(`company_id`),
	CONSTRAINT `fk_inventory_balance_warehouse_id_warehouse_warehouse_id_fk` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouse`(`warehouse_id`),
	CONSTRAINT `fk_inventory_balance_inventory_item_id_inventory_item_item_id_fk` FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_item`(`item_id`),
	CONSTRAINT `fk_inventory_balance_article_id_article_article_id_fk` FOREIGN KEY (`article_id`) REFERENCES `article`(`article_id`),
	CONSTRAINT `inventory_balance_tenant_warehouse_id_item_unique` UNIQUE(`warehouse_id`,`inventory_item_id`)
);
--> statement-breakpoint
CREATE TABLE `inventory_item` (
	`item_id` text PRIMARY KEY,
	`variant_id` text NOT NULL CONSTRAINT `uq_inv_item_variant` UNIQUE,
	`sku` text NOT NULL CONSTRAINT `uq_inv_item_sku` UNIQUE,
	`tracked` integer DEFAULT true NOT NULL,
	CONSTRAINT `fk_inventory_item_variant_id_article_variant_variant_id_fk` FOREIGN KEY (`variant_id`) REFERENCES `article_variant`(`variant_id`)
);
--> statement-breakpoint
CREATE TABLE `inventory_level` (
	`level_id` text PRIMARY KEY,
	`item_id` text NOT NULL,
	`location_id` text NOT NULL,
	`quantity` numeric DEFAULT '0' NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	CONSTRAINT `fk_inventory_level_item_id_inventory_item_item_id_fk` FOREIGN KEY (`item_id`) REFERENCES `inventory_item`(`item_id`),
	CONSTRAINT `fk_inventory_level_location_id_warehouse_warehouse_id_fk` FOREIGN KEY (`location_id`) REFERENCES `warehouse`(`warehouse_id`),
	CONSTRAINT `uq_inv_level_loc` UNIQUE(`item_id`,`location_id`)
);
--> statement-breakpoint
CREATE TABLE `inventory_movement` (
	`inventory_movement_id` text PRIMARY KEY,
	`company_id` text,
	`warehouse_id` text NOT NULL,
	`inventory_item_id` text NOT NULL,
	`variant_id` text,
	`movement_type` text NOT NULL,
	`qty_delta` numeric,
	`movement_date` integer NOT NULL,
	`source_document_id` text,
	`source_document_line_id` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`transaction_id` text,
	`absolute_qty` numeric,
	`reference_text` text,
	`serial_number_id` text,
	`batch_no` text,
	CONSTRAINT `fk_inventory_movement_company_id_company_company_id_fk` FOREIGN KEY (`company_id`) REFERENCES `company`(`company_id`),
	CONSTRAINT `fk_inventory_movement_warehouse_id_warehouse_warehouse_id_fk` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouse`(`warehouse_id`),
	CONSTRAINT `fk_inventory_movement_inventory_item_id_inventory_item_item_id_fk` FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_item`(`item_id`),
	CONSTRAINT `fk_inventory_movement_variant_id_article_variant_variant_id_fk` FOREIGN KEY (`variant_id`) REFERENCES `article_variant`(`variant_id`),
	CONSTRAINT `fk_inventory_movement_source_document_id_document_document_id_fk` FOREIGN KEY (`source_document_id`) REFERENCES `document`(`document_id`),
	CONSTRAINT `fk_inventory_movement_source_document_line_id_document_line_document_line_id_fk` FOREIGN KEY (`source_document_line_id`) REFERENCES `document_line`(`document_line_id`),
	CONSTRAINT "chk_inventory_movement_qty_logic" CHECK((movement_type = 'V' AND absolute_qty IS NOT NULL) OR (movement_type <> 'V' AND qty_delta IS NOT NULL AND absolute_qty IS NULL)),
	CONSTRAINT "chk_inventory_movement_type" CHECK(movement_type IN ('N', 'A', 'L', 'R', 'G', 'b', 'l', 'r', 'g', 'Z', 'E', 'V', 'q', 'p', 'U'))
);
--> statement-breakpoint
CREATE TABLE `journal_entry` (
	`journal_entry_id` text PRIMARY KEY CONSTRAINT `journal_entry_tenant_journal_entry_id_key` UNIQUE,
	`company_id` text NOT NULL,
	`posting_date` text NOT NULL,
	`source_document_id` text,
	`description` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	CONSTRAINT `fk_journal_entry_company_id_company_company_id_fk` FOREIGN KEY (`company_id`) REFERENCES `company`(`company_id`),
	CONSTRAINT `fk_journal_entry_source_document_id_document_document_id_fk` FOREIGN KEY (`source_document_id`) REFERENCES `document`(`document_id`)
);
--> statement-breakpoint
CREATE TABLE `journal_line` (
	`journal_line_id` text PRIMARY KEY,
	`company_id` text NOT NULL,
	`journal_entry_id` text NOT NULL,
	`gl_account_id` text NOT NULL,
	`debit_amount` numeric DEFAULT '0' NOT NULL,
	`credit_amount` numeric DEFAULT '0' NOT NULL,
	`cost_center_id` text,
	`tax_code_id` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	CONSTRAINT `fk_journal_line_company_id_company_company_id_fk` FOREIGN KEY (`company_id`) REFERENCES `company`(`company_id`),
	CONSTRAINT `fk_journal_line_journal_entry_id_journal_entry_journal_entry_id_fk` FOREIGN KEY (`journal_entry_id`) REFERENCES `journal_entry`(`journal_entry_id`),
	CONSTRAINT `fk_journal_line_gl_account_id_gl_account_gl_account_id_fk` FOREIGN KEY (`gl_account_id`) REFERENCES `gl_account`(`gl_account_id`),
	CONSTRAINT `fk_journal_line_cost_center_id_cost_center_cost_center_id_fk` FOREIGN KEY (`cost_center_id`) REFERENCES `cost_center`(`cost_center_id`),
	CONSTRAINT `fk_journal_line_tax_code_id_tax_code_tax_code_id_fk` FOREIGN KEY (`tax_code_id`) REFERENCES `tax_code`(`tax_code_id`),
	CONSTRAINT "chk_debit_or_credit" CHECK((debit_amount > 0 AND credit_amount = 0) OR (credit_amount > 0 AND debit_amount = 0))
);
--> statement-breakpoint
CREATE TABLE `media_asset` (
	`media_asset_id` text PRIMARY KEY CONSTRAINT `media_asset_tenant_media_asset_id_key` UNIQUE,
	`storage_key` text NOT NULL CONSTRAINT `media_asset_tenant_storage_key_unique` UNIQUE,
	`file_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`file_size` integer,
	`width` integer,
	`height` integer,
	`alt_text` text,
	`checksum` text,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `metadata_history` (
	`history_id` text PRIMARY KEY,
	`user_id` text,
	`entity_name` text NOT NULL,
	`metadata_type` text NOT NULL,
	`metadata_key` text NOT NULL,
	`old_value` text,
	`new_value` text,
	`change_type` text NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	CONSTRAINT `fk_metadata_history_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`)
);
--> statement-breakpoint
CREATE TABLE `modules` (
	`module_id` text PRIMARY KEY,
	`slug` text NOT NULL,
	`label` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `number_sequence` (
	`number_sequence_id` text PRIMARY KEY CONSTRAINT `number_sequence_tenant_number_sequence_id_unique` UNIQUE,
	`company_id` text NOT NULL,
	`prefix` text NOT NULL,
	`fiscal_year` integer,
	`next_value` integer DEFAULT 1 NOT NULL,
	`padding` integer DEFAULT 5 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer,
	CONSTRAINT `fk_number_sequence_company_id_company_company_id_fk` FOREIGN KEY (`company_id`) REFERENCES `company`(`company_id`),
	CONSTRAINT `number_sequence_tenant_company_id_prefix_year_unique` UNIQUE(`company_id`,`prefix`,`fiscal_year`)
);
--> statement-breakpoint
CREATE TABLE `organization` (
	`organization_id` text PRIMARY KEY,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `payment_term` (
	`payment_term_id` text PRIMARY KEY CONSTRAINT `payment_term_tenant_payment_term_id_key` UNIQUE,
	`name` text NOT NULL CONSTRAINT `payment_term_tenant_name_unique` UNIQUE,
	`net_days` integer NOT NULL,
	`discount_days` integer,
	`discount_percentage` numeric,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`custom_attributes` text
);
--> statement-breakpoint
CREATE TABLE `postal_code` (
	`postal_code_id` text PRIMARY KEY,
	`country_code` text NOT NULL,
	`plz` text NOT NULL,
	`city` text NOT NULL,
	`state` text,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	CONSTRAINT `postal_code_country_code_plz_city_state_unique` UNIQUE(`country_code`,`plz`,`city`,`state`)
);
--> statement-breakpoint
CREATE TABLE `posting_batch` (
	`batch_id` text PRIMARY KEY,
	`document_id` text,
	`posted_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`posted_by` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `posting_entry` (
	`entry_id` text PRIMARY KEY,
	`batch_id` text NOT NULL,
	`document_line_id` text,
	`variant_id` text,
	`qty_delta` numeric,
	`amount_delta` numeric,
	`account_code` text,
	`entry_type` text NOT NULL,
	`description` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	CONSTRAINT `fk_posting_entry_batch_id_posting_batch_batch_id_fk` FOREIGN KEY (`batch_id`) REFERENCES `posting_batch`(`batch_id`)
);
--> statement-breakpoint
CREATE TABLE `price_list` (
	`price_list_id` text PRIMARY KEY CONSTRAINT `price_list_tenant_price_list_id_key` UNIQUE,
	`name` text NOT NULL CONSTRAINT `price_list_tenant_name_unique` UNIQUE,
	`currency_id` text NOT NULL,
	`is_net` integer DEFAULT true NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `price_list_item` (
	`price_list_item_id` text PRIMARY KEY,
	`price_list_id` text NOT NULL,
	`article_id` text,
	`variant_id` text NOT NULL,
	`price` numeric NOT NULL,
	`valid_from` text,
	`valid_to` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	CONSTRAINT `fk_price_list_item_price_list_id_price_list_price_list_id_fk` FOREIGN KEY (`price_list_id`) REFERENCES `price_list`(`price_list_id`),
	CONSTRAINT `fk_price_list_item_article_id_article_article_id_fk` FOREIGN KEY (`article_id`) REFERENCES `article`(`article_id`),
	CONSTRAINT `fk_price_list_item_variant_id_article_variant_variant_id_fk` FOREIGN KEY (`variant_id`) REFERENCES `article_variant`(`variant_id`),
	CONSTRAINT `price_list_item_tenant_price_list_id_article_variant_valid_from_u` UNIQUE(`price_list_id`,`variant_id`,`valid_from`)
);
--> statement-breakpoint
CREATE TABLE `production_order` (
	`production_order_id` text PRIMARY KEY,
	`company_id` text,
	`order_no` text NOT NULL CONSTRAINT `production_order_tenant_order_no_unique` UNIQUE,
	`article_id` text,
	`quantity` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	`planned_start_date` text,
	`planned_end_date` text,
	`actual_start_date` text,
	`actual_end_date` text,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer,
	CONSTRAINT `fk_production_order_company_id_company_company_id_fk` FOREIGN KEY (`company_id`) REFERENCES `company`(`company_id`),
	CONSTRAINT `fk_production_order_article_id_article_article_id_fk` FOREIGN KEY (`article_id`) REFERENCES `article`(`article_id`)
);
--> statement-breakpoint
CREATE TABLE `sales_channel` (
	`sales_channel_id` text PRIMARY KEY,
	`name` text NOT NULL,
	`platform` text NOT NULL,
	`api_url` text NOT NULL,
	`credentials` text,
	`master_data_policy` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `schema_annotations` (
	`id` text PRIMARY KEY,
	`table_name` text NOT NULL,
	`column_name` text DEFAULT '' NOT NULL,
	`business_name` text NOT NULL,
	`description` text NOT NULL,
	`data_class` text NOT NULL,
	`module_id` text,
	`mandatory_for` text DEFAULT '[]' NOT NULL,
	`locked_for` text DEFAULT '[]' NOT NULL,
	`ai_generated_at` integer,
	`human_override` integer DEFAULT false NOT NULL,
	CONSTRAINT `schema_annotations_table_name_column_name_unique` UNIQUE(`table_name`,`column_name`)
);
--> statement-breakpoint
CREATE TABLE `seller_tax_registration` (
	`seller_tax_registration_id` text PRIMARY KEY,
	`company_id` text,
	`country_code` text NOT NULL,
	`vat_id` text,
	`registration_type` text NOT NULL,
	`valid_from` text NOT NULL,
	`valid_to` text,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	CONSTRAINT `fk_seller_tax_registration_company_id_company_company_id_fk` FOREIGN KEY (`company_id`) REFERENCES `company`(`company_id`)
);
--> statement-breakpoint
CREATE TABLE `serial_number` (
	`serial_number_id` text PRIMARY KEY CONSTRAINT `serial_number_tenant_serial_number_id_key` UNIQUE,
	`article_id` text NOT NULL,
	`serial_no` text NOT NULL,
	`status` text DEFAULT 'in_stock' NOT NULL,
	`created_movement_id` text,
	`consumed_movement_id` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	CONSTRAINT `fk_serial_number_article_id_article_article_id_fk` FOREIGN KEY (`article_id`) REFERENCES `article`(`article_id`),
	CONSTRAINT `fk_serial_number_created_movement_id_inventory_movement_inventory_movement_id_fk` FOREIGN KEY (`created_movement_id`) REFERENCES `inventory_movement`(`inventory_movement_id`),
	CONSTRAINT `fk_serial_number_consumed_movement_id_inventory_movement_inventory_movement_id_fk` FOREIGN KEY (`consumed_movement_id`) REFERENCES `inventory_movement`(`inventory_movement_id`),
	CONSTRAINT `serial_number_tenant_article_id_serial_no_unique` UNIQUE(`article_id`,`serial_no`),
	CONSTRAINT "serial_number_status_check" CHECK(status IN ('in_stock', 'reserved', 'sold'))
);
--> statement-breakpoint
CREATE TABLE `shipping_method` (
	`shipping_method_id` text PRIMARY KEY CONSTRAINT `shipping_method_tenant_shipping_method_id_key` UNIQUE,
	`name` text NOT NULL CONSTRAINT `shipping_method_tenant_name_unique` UNIQUE,
	`tracking_url_template` text,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`custom_attributes` text
);
--> statement-breakpoint
CREATE TABLE `system_settings` (
	`setting_id` text PRIMARY KEY,
	`scope` text NOT NULL,
	`organization_id` text,
	`key` text NOT NULL CONSTRAINT `uq_settings_global` UNIQUE,
	`value` text NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer,
	CONSTRAINT `uq_settings_org` UNIQUE(`organization_id`,`key`)
);
--> statement-breakpoint
CREATE TABLE `tax_class` (
	`tax_class_id` text PRIMARY KEY,
	`code` text NOT NULL CONSTRAINT `tax_class_tenant_code_unique` UNIQUE,
	`name` text NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`custom_attributes` text
);
--> statement-breakpoint
CREATE TABLE `tax_code` (
	`tax_code_id` text PRIMARY KEY CONSTRAINT `tax_code_tenant_tax_code_id_key` UNIQUE,
	`code` text NOT NULL CONSTRAINT `tax_code_tenant_code_unique` UNIQUE,
	`description` text,
	`tax_rate` numeric NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tax_rule` (
	`tax_rule_id` text PRIMARY KEY,
	`customer_tax_class_id` text,
	`article_tax_class_id` text,
	`country_code` text,
	`tax_code_id` text NOT NULL,
	`valid_from` text NOT NULL,
	`valid_to` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	CONSTRAINT `fk_tax_rule_customer_tax_class_id_tax_class_tax_class_id_fk` FOREIGN KEY (`customer_tax_class_id`) REFERENCES `tax_class`(`tax_class_id`),
	CONSTRAINT `fk_tax_rule_article_tax_class_id_tax_class_tax_class_id_fk` FOREIGN KEY (`article_tax_class_id`) REFERENCES `tax_class`(`tax_class_id`),
	CONSTRAINT `fk_tax_rule_tax_code_id_tax_code_tax_code_id_fk` FOREIGN KEY (`tax_code_id`) REFERENCES `tax_code`(`tax_code_id`)
);
--> statement-breakpoint
CREATE TABLE `tenant_connector` (
	`tenant_connector_id` text PRIMARY KEY CONSTRAINT `tenant_connector_tenant_tenant_connector_id_key` UNIQUE,
	`connector_id` text NOT NULL,
	`credentials` text DEFAULT '{}' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	CONSTRAINT `fk_tenant_connector_connector_id_connector_definition_connector_id_fk` FOREIGN KEY (`connector_id`) REFERENCES `connector_definition`(`connector_id`)
);
--> statement-breakpoint
CREATE TABLE `tenant_connector_mapping` (
	`mapping_id` text PRIMARY KEY,
	`tenant_connector_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`source_field` text NOT NULL,
	`target_table` text NOT NULL,
	`target_column` text NOT NULL,
	`transform` text DEFAULT '{"type":"direct"}' NOT NULL,
	`default_value` text,
	CONSTRAINT `fk_tenant_connector_mapping_tenant_connector_id_tenant_connector_tenant_connector_id_fk` FOREIGN KEY (`tenant_connector_id`) REFERENCES `tenant_connector`(`tenant_connector_id`),
	CONSTRAINT `fk_tenant_connector_mapping_profile_id_import_profile_profile_id_fk` FOREIGN KEY (`profile_id`) REFERENCES `import_profile`(`profile_id`),
	CONSTRAINT `uq_tenant_connector_mapping_connector_profile_field` UNIQUE(`tenant_connector_id`,`profile_id`,`source_field`)
);
--> statement-breakpoint
CREATE TABLE `tenant_fields` (
	`field_id` text PRIMARY KEY,
	`scope` text DEFAULT 'tenant' NOT NULL,
	`organization_id` text,
	`entity_name` text NOT NULL,
	`field_name` text NOT NULL,
	`field_type` text NOT NULL,
	`is_required` integer DEFAULT false NOT NULL,
	`custom_attributes` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`label` text,
	`help_text` text,
	`is_visible` integer DEFAULT true NOT NULL,
	`display_order` integer,
	`import_column` text,
	`import_type` text,
	`import_required` integer DEFAULT false NOT NULL,
	`import_transform` text,
	`group_id` text,
	`lookup_table` text,
	`lookup_filter` text,
	`archived` integer DEFAULT false NOT NULL,
	CONSTRAINT `fk_tenant_fields_organization_id_organization_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`organization_id`)
);
--> statement-breakpoint
CREATE TABLE `tenant_groups` (
	`group_id` text PRIMARY KEY,
	`scope` text DEFAULT 'tenant' NOT NULL,
	`organization_id` text,
	`entity_name` text NOT NULL,
	`group_key` text NOT NULL,
	`label` text NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`is_visible` integer DEFAULT true NOT NULL,
	`custom_attributes` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	CONSTRAINT `fk_tenant_groups_organization_id_organization_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`organization_id`)
);
--> statement-breakpoint
CREATE TABLE `tenant_layouts` (
	`layout_id` text PRIMARY KEY,
	`scope` text DEFAULT 'tenant' NOT NULL,
	`organization_id` text,
	`user_id` text,
	`entity_name` text NOT NULL,
	`layout_key` text NOT NULL,
	`layout_definition` text NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	CONSTRAINT `fk_tenant_layouts_organization_id_organization_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`organization_id`),
	CONSTRAINT `fk_tenant_layouts_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`)
);
--> statement-breakpoint
CREATE TABLE `tenant_llm_config` (
	`tenant_llm_config_id` text PRIMARY KEY,
	`company_id` text NOT NULL CONSTRAINT `uq_tenant_llm_config_company` UNIQUE,
	`provider` text,
	`endpoint_url` text,
	`model` text,
	`api_key` text,
	`github_token` text,
	`github_repo` text,
	`vertex_credentials` text,
	`vertex_project` text,
	`vertex_location` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer,
	CONSTRAINT `fk_tenant_llm_config_company_id_company_company_id_fk` FOREIGN KEY (`company_id`) REFERENCES `company`(`company_id`)
);
--> statement-breakpoint
CREATE TABLE `tenant_rules` (
	`rule_id` text PRIMARY KEY,
	`scope` text DEFAULT 'tenant' NOT NULL,
	`organization_id` text,
	`entity_name` text NOT NULL,
	`hook_name` text NOT NULL,
	`rule_state` text DEFAULT 'draft' NOT NULL,
	`rule_definition` text NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`rule_source` text,
	CONSTRAINT `fk_tenant_rules_organization_id_organization_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`organization_id`),
	CONSTRAINT `uq_rules_global` UNIQUE(`entity_name`,`hook_name`),
	CONSTRAINT `uq_rules_org` UNIQUE(`organization_id`,`entity_name`,`hook_name`),
	CONSTRAINT `uq_rules_tenant` UNIQUE(`entity_name`,`hook_name`)
);
--> statement-breakpoint
CREATE TABLE `unit` (
	`unit_id` text PRIMARY KEY,
	`code` text NOT NULL CONSTRAINT `unit_tenant_code_unique` UNIQUE,
	`name` text NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`custom_attributes` text
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY
);
--> statement-breakpoint
CREATE TABLE `warehouse` (
	`warehouse_id` text PRIMARY KEY CONSTRAINT `warehouse_tenant_warehouse_id_key` UNIQUE,
	`company_id` text,
	`code` text NOT NULL CONSTRAINT `warehouse_tenant_code_unique` UNIQUE,
	`name` text NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	CONSTRAINT `fk_warehouse_company_id_company_company_id_fk` FOREIGN KEY (`company_id`) REFERENCES `company`(`company_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_acct_det_lookup` ON `account_determination_rule` (`posting_context`,`article_group_id`,`tax_code_id`);--> statement-breakpoint
CREATE INDEX `idx_accounting_export_batch_period` ON `accounting_export_batch` (`fiscal_period_id`);--> statement-breakpoint
CREATE INDEX `idx_accounting_export_row_batch` ON `accounting_export_row` (`batch_id`);--> statement-breakpoint
CREATE INDEX `idx_address_category` ON `address` (`address_category_id`);--> statement-breakpoint
CREATE INDEX `idx_address_customer` ON `address` (`is_customer`);--> statement-breakpoint
CREATE INDEX `idx_address_supplier` ON `address` (`is_supplier`);--> statement-breakpoint
CREATE INDEX `idx_address_agent` ON `address` (`agent_id`);--> statement-breakpoint
CREATE INDEX `idx_address_contact_address` ON `address_contact` (`address_id`);--> statement-breakpoint
CREATE INDEX `idx_address_contact_identity_contact` ON `address_contact_identity` (`contact_id`);--> statement-breakpoint
CREATE INDEX `idx_address_contact_identity_value` ON `address_contact_identity` (`value`);--> statement-breakpoint
CREATE INDEX `idx_address_contact_identity_normalized` ON `address_contact_identity` (`normalized_value`);--> statement-breakpoint
CREATE INDEX `idx_agent_address` ON `agent` (`address_id`);--> statement-breakpoint
CREATE INDEX `idx_agent_user` ON `agent` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_ai_apply_attempt_plan` ON `ai_apply_attempt` (`plan_id`);--> statement-breakpoint
CREATE INDEX `idx_ai_apply_attempt_executor` ON `ai_apply_attempt` (`executed_by_user_id`);--> statement-breakpoint
CREATE INDEX `idx_ai_apply_attempt_status` ON `ai_apply_attempt` (`status`);--> statement-breakpoint
CREATE INDEX `idx_ai_context_projection_session` ON `ai_context_projection` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_ai_evidence_plan` ON `ai_evidence` (`plan_id`);--> statement-breakpoint
CREATE INDEX `idx_ai_evidence_field` ON `ai_evidence` (`field_name`);--> statement-breakpoint
CREATE INDEX `idx_ai_interpretation_run` ON `ai_interpretation` (`run_id`);--> statement-breakpoint
CREATE INDEX `idx_ai_memory_user` ON `ai_memory` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_ai_memory_kind` ON `ai_memory` (`kind`);--> statement-breakpoint
CREATE INDEX `idx_ai_memory_confirmed` ON `ai_memory` (`confirmed_at`);--> statement-breakpoint
CREATE INDEX `idx_ai_plan_run` ON `ai_plan` (`run_id`);--> statement-breakpoint
CREATE INDEX `idx_ai_plan_prompt_version` ON `ai_plan` (`prompt_version_id`);--> statement-breakpoint
CREATE INDEX `idx_ai_plan_readiness` ON `ai_plan` (`apply_readiness`);--> statement-breakpoint
CREATE INDEX `idx_ai_review_interpretation` ON `ai_review` (`interpretation_id`);--> statement-breakpoint
CREATE INDEX `idx_ai_run_user` ON `ai_run` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_ai_run_status` ON `ai_run` (`status`);--> statement-breakpoint
CREATE INDEX `idx_ai_session_user` ON `ai_session` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_ai_session_status` ON `ai_session` (`status`);--> statement-breakpoint
CREATE INDEX `idx_ai_session_focus` ON `ai_session` (`focus_type`,`focus_id`);--> statement-breakpoint
CREATE INDEX `idx_ai_tool_call_turn` ON `ai_tool_call` (`turn_id`);--> statement-breakpoint
CREATE INDEX `idx_ai_tool_call_status` ON `ai_tool_call` (`status`);--> statement-breakpoint
CREATE INDEX `idx_ai_tool_review_session` ON `ai_tool_review` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_ai_turn_session` ON `ai_turn` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_article_default_wh` ON `article` (`default_warehouse_id`);--> statement-breakpoint
CREATE INDEX `idx_article_group_fk` ON `article` (`article_group_id`);--> statement-breakpoint
CREATE INDEX `idx_article_tenant_archived` ON `article` (`archived_at`);--> statement-breakpoint
CREATE INDEX `idx_article_category_tenant_article` ON `article_category` (`article_id`);--> statement-breakpoint
CREATE INDEX `idx_article_category_tenant_category` ON `article_category` (`category_id`);--> statement-breakpoint
CREATE INDEX `idx_article_image_tenant_article` ON `article_image` (`article_id`);--> statement-breakpoint
CREATE INDEX `idx_article_image_tenant_archived` ON `article_image` (`archived`);--> statement-breakpoint
CREATE INDEX `idx_article_media_tenant_article` ON `article_media` (`article_id`);--> statement-breakpoint
CREATE INDEX `idx_article_media_tenant_variant` ON `article_media` (`variant_id`);--> statement-breakpoint
CREATE INDEX `idx_article_media_tenant_asset` ON `article_media` (`media_asset_id`);--> statement-breakpoint
CREATE INDEX `idx_article_option_article` ON `article_option` (`article_id`);--> statement-breakpoint
CREATE INDEX `idx_article_optval_option` ON `article_option_value` (`option_id`);--> statement-breakpoint
CREATE INDEX `idx_article_variant_article` ON `article_variant` (`article_id`);--> statement-breakpoint
CREATE INDEX `idx_variant_optval_variant` ON `article_variant_option_value` (`variant_id`);--> statement-breakpoint
CREATE INDEX `idx_bank_account_address` ON `bank_account` (`address_id`);--> statement-breakpoint
CREATE INDEX `idx_bueroware_field_layout` ON `bueroware_record_field` (`layout_id`);--> statement-breakpoint
CREATE INDEX `idx_bueroware_layout_file_active` ON `bueroware_record_layout` (`file_name`,`is_active`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_capability_execution_log_key` ON `capability_execution_log` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_category_parent` ON `category` (`parent_category_id`);--> statement-breakpoint
CREATE INDEX `idx_category_tenant_archived` ON `category` (`archived`);--> statement-breakpoint
CREATE INDEX `idx_commerce_sync_dlq_pending` ON `commerce_sync_dead_letter` (`status`,`next_retry_at`);--> statement-breakpoint
CREATE INDEX `idx_commerce_sync_dlq_item` ON `commerce_sync_dead_letter` (`sales_channel_id`,`entity_type`,`internal_id`);--> statement-breakpoint
CREATE INDEX `idx_commerce_sync_run_sales_channel` ON `commerce_sync_run` (`sales_channel_id`);--> statement-breakpoint
CREATE INDEX `idx_commerce_sync_run_status` ON `commerce_sync_run` (`status`);--> statement-breakpoint
CREATE INDEX `idx_commerce_sync_step_run` ON `commerce_sync_run_step` (`run_id`);--> statement-breakpoint
CREATE INDEX `idx_commerce_webhook_event_pending` ON `commerce_webhook_event` (`sales_channel_id`,`status`,`next_retry_at`);--> statement-breakpoint
CREATE INDEX `idx_company_tenant_archived` ON `company` (`archived`);--> statement-breakpoint
CREATE INDEX `connector_definition_slug_key` ON `connector_definition` (`slug`);--> statement-breakpoint
CREATE INDEX `country_iso2_code_key` ON `country` (`iso2_code`);--> statement-breakpoint
CREATE INDEX `country_iso3_code_key` ON `country` (`iso3_code`);--> statement-breakpoint
CREATE INDEX `currency_code_key` ON `currency` (`code`);--> statement-breakpoint
CREATE INDEX `idx_delivery_address_partner` ON `delivery_address` (`address_id`);--> statement-breakpoint
CREATE INDEX `idx_document_company` ON `document` (`company_id`);--> statement-breakpoint
CREATE INDEX `idx_document_customer` ON `document` (`customer_id`);--> statement-breakpoint
CREATE INDEX `idx_document_delivery_address` ON `document` (`delivery_address_id`);--> statement-breakpoint
CREATE INDEX `idx_document_group` ON `document` (`document_group_id`);--> statement-breakpoint
CREATE INDEX `idx_document_group_type` ON `document` (`document_group_id`,`document_type_id`);--> statement-breakpoint
CREATE INDEX `idx_document_parent` ON `document` (`parent_document_id`);--> statement-breakpoint
CREATE INDEX `idx_document_payment_term` ON `document` (`payment_term_id`);--> statement-breakpoint
CREATE INDEX `idx_document_posted_at` ON `document` (`posted_at`);--> statement-breakpoint
CREATE INDEX `idx_document_shipping_method` ON `document` (`shipping_method_id`);--> statement-breakpoint
CREATE INDEX `idx_document_transaction` ON `document` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `idx_document_type_status` ON `document` (`document_type`,`status`);--> statement-breakpoint
CREATE INDEX `idx_document_warehouse` ON `document` (`warehouse_id`);--> statement-breakpoint
CREATE INDEX `idx_document_agent` ON `document` (`agent_id`);--> statement-breakpoint
CREATE INDEX `idx_document_group_company` ON `document_group` (`company_id`);--> statement-breakpoint
CREATE INDEX `idx_document_line_article` ON `document_line` (`variant_id`);--> statement-breakpoint
CREATE INDEX `idx_document_line_variant` ON `document_line` (`variant_id`);--> statement-breakpoint
CREATE INDEX `idx_document_line_document` ON `document_line` (`document_id`);--> statement-breakpoint
CREATE INDEX `idx_document_line_tenant_document` ON `document_line` (`document_id`);--> statement-breakpoint
CREATE INDEX `idx_document_line_tenant_archived` ON `document_line` (`archived_at`);--> statement-breakpoint
CREATE INDEX `idx_document_line_tx` ON `document_line` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `idx_dla_source` ON `document_line_allocation` (`source_document_line_id`);--> statement-breakpoint
CREATE INDEX `idx_dla_target` ON `document_line_allocation` (`target_document_line_id`);--> statement-breakpoint
CREATE INDEX `idx_document_line_tracking_tenant_line` ON `document_line_tracking` (`document_line_id`);--> statement-breakpoint
CREATE INDEX `idx_document_line_tracking_tenant_created` ON `document_line_tracking` (`document_line_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_shipment_document` ON `document_shipment` (`document_id`);--> statement-breakpoint
CREATE INDEX `idx_shipment_status` ON `document_shipment` (`shipment_status`);--> statement-breakpoint
CREATE INDEX `idx_shipment_package_shipment` ON `document_shipment_package` (`document_shipment_id`);--> statement-breakpoint
CREATE INDEX `idx_email_account_status` ON `email_account` (`status`);--> statement-breakpoint
CREATE INDEX `idx_email_account_backstop` ON `email_account` (`archived`,`activity_tier`,`last_sync_at`) WHERE archived = false;--> statement-breakpoint
CREATE INDEX `idx_email_account_grant_user` ON `email_account_user_grant` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_email_attachment_message` ON `email_attachment` (`email_message_id`);--> statement-breakpoint
CREATE INDEX `idx_email_attachment_storage` ON `email_attachment` (`storage_key`);--> statement-breakpoint
CREATE INDEX `idx_email_identity_account` ON `email_identity` (`email_account_id`);--> statement-breakpoint
CREATE INDEX `idx_email_job_queue_claim` ON `email_job` (`status`,`priority`,`run_after`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_email_job_account` ON `email_job` (`email_account_id`);--> statement-breakpoint
CREATE INDEX `idx_email_job_stale` ON `email_job` (`locked_at`) WHERE status = 'processing';--> statement-breakpoint
CREATE INDEX `idx_email_label_account_active` ON `email_label` (`email_account_id`,`archived`,`kind`,`name`);--> statement-breakpoint
CREATE INDEX `idx_email_message_thread` ON `email_message` (`email_thread_id`);--> statement-breakpoint
CREATE INDEX `idx_email_message_thread_timeline` ON `email_message` (`email_thread_id`,`received_at`,`sent_at`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_email_message_account_date` ON `email_message` (`email_account_id`,`received_at`);--> statement-breakpoint
CREATE INDEX `idx_email_message_label_label` ON `email_message_label` (`email_label_id`);--> statement-breakpoint
CREATE INDEX `idx_email_outbox_queue` ON `email_outbox` (`email_account_id`,`status`,`updated_at`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_email_outbox_message` ON `email_outbox` (`email_message_id`);--> statement-breakpoint
CREATE INDEX `idx_email_subscription_expires` ON `email_subscription` (`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_email_subscription_account` ON `email_subscription` (`email_account_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_email_subscription_channel_token` ON `email_subscription` (`channel_token`) WHERE channel_token IS NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_email_sync_state_account` ON `email_sync_state` (`email_account_id`);--> statement-breakpoint
CREATE INDEX `idx_email_template_tenant` ON `email_template` (`category`);--> statement-breakpoint
CREATE INDEX `idx_email_template_binding_lookup` ON `email_template_binding` (`document_type`,`company_id`,`language`,`email_identity_id`);--> statement-breakpoint
CREATE INDEX `idx_email_template_render_log_document` ON `email_template_render_log` (`document_id`);--> statement-breakpoint
CREATE INDEX `idx_email_template_render_log_template` ON `email_template_render_log` (`email_template_id`);--> statement-breakpoint
CREATE INDEX `idx_email_thread_mailbox_list` ON `email_thread` (`email_account_id`,`archived`,`last_message_at`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_email_thread_document` ON `email_thread` (`related_document_id`);--> statement-breakpoint
CREATE INDEX `idx_email_thread_address` ON `email_thread` (`related_address_id`);--> statement-breakpoint
CREATE INDEX `idx_entity_commands_entity` ON `entity_commands` (`entity_name`,`command_state`);--> statement-breakpoint
CREATE INDEX `idx_entity_commands_org` ON `entity_commands` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_ext_sync_tenant_lookup` ON `external_sync_mapping` (`source_system`,`entity_type`);--> statement-breakpoint
CREATE INDEX `idx_fact_purchase_tenant_company` ON `fact_purchase_event` (`company_id`);--> statement-breakpoint
CREATE INDEX `idx_fact_purchase_supplier` ON `fact_purchase_event` (`supplier_id`);--> statement-breakpoint
CREATE INDEX `idx_fact_purchase_article` ON `fact_purchase_event` (`article_id`);--> statement-breakpoint
CREATE INDEX `idx_fact_purchase_period` ON `fact_purchase_event` (`fiscal_period_id`);--> statement-breakpoint
CREATE INDEX `idx_fact_sales_article` ON `fact_sales_event` (`article_id`);--> statement-breakpoint
CREATE INDEX `idx_fact_sales_variant` ON `fact_sales_event` (`variant_id`);--> statement-breakpoint
CREATE INDEX `idx_fact_sales_customer` ON `fact_sales_event` (`customer_id`);--> statement-breakpoint
CREATE INDEX `idx_fact_sales_period` ON `fact_sales_event` (`booking_period`);--> statement-breakpoint
CREATE INDEX `idx_fact_sales_tx` ON `fact_sales_event` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `idx_fiscal_period_tenant_date` ON `fiscal_period` (`company_id`,`start_date`,`end_date`);--> statement-breakpoint
CREATE INDEX `idx_field_mapping_version` ON `import_field_mapping` (`version_id`);--> statement-breakpoint
CREATE INDEX `idx_import_mapping_version_lookup` ON `import_profile_mapping_version` (`tenant_connector_id`,`profile_id`,`is_active`);--> statement-breakpoint
CREATE INDEX `idx_import_mapping_version_source_file` ON `import_profile_mapping_version` (`source_system`,`source_file_name`,`is_active`);--> statement-breakpoint
CREATE INDEX `idx_import_row_batch_status` ON `import_row` (`batch_id`,`status`);--> statement-breakpoint
CREATE INDEX `incoterm_code_key` ON `incoterm` (`code`);--> statement-breakpoint
CREATE INDEX `idx_inv_balance_lookup` ON `inventory_balance` (`warehouse_id`,`inventory_item_id`);--> statement-breakpoint
CREATE INDEX `idx_inv_balance_article` ON `inventory_balance` (`warehouse_id`,`article_id`);--> statement-breakpoint
CREATE INDEX `idx_inv_item_variant` ON `inventory_item` (`variant_id`);--> statement-breakpoint
CREATE INDEX `idx_inv_level_item` ON `inventory_level` (`item_id`);--> statement-breakpoint
CREATE INDEX `idx_inv_movement_date` ON `inventory_movement` (`movement_date`);--> statement-breakpoint
CREATE INDEX `idx_inv_movement_inventory_item_anchor` ON `inventory_movement` (`warehouse_id`,`inventory_item_id`,`variant_id`,`movement_date`);--> statement-breakpoint
CREATE INDEX `idx_inv_movement_inventory_item` ON `inventory_movement` (`inventory_item_id`,`movement_date`);--> statement-breakpoint
CREATE INDEX `idx_inv_movement_variant` ON `inventory_movement` (`variant_id`,`movement_date`);--> statement-breakpoint
CREATE INDEX `idx_inv_movement_tx` ON `inventory_movement` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `idx_inv_movement_warehouse_inventory_item` ON `inventory_movement` (`warehouse_id`,`inventory_item_id`);--> statement-breakpoint
CREATE INDEX `idx_inventory_movement_batch_balance` ON `inventory_movement` (`warehouse_id`,`variant_id`,`batch_no`);--> statement-breakpoint
CREATE INDEX `idx_inventory_movement_batch_balance_item` ON `inventory_movement` (`warehouse_id`,`inventory_item_id`,`batch_no`);--> statement-breakpoint
CREATE INDEX `idx_journal_entry_company` ON `journal_entry` (`company_id`);--> statement-breakpoint
CREATE INDEX `idx_journal_entry_date` ON `journal_entry` (`posting_date`);--> statement-breakpoint
CREATE INDEX `idx_journal_entry_document` ON `journal_entry` (`source_document_id`);--> statement-breakpoint
CREATE INDEX `idx_journal_line_account` ON `journal_line` (`gl_account_id`);--> statement-breakpoint
CREATE INDEX `idx_journal_line_entry` ON `journal_line` (`journal_entry_id`);--> statement-breakpoint
CREATE INDEX `idx_media_asset_tenant_archived` ON `media_asset` (`archived`);--> statement-breakpoint
CREATE INDEX `idx_metadata_history_entity` ON `metadata_history` (`entity_name`);--> statement-breakpoint
CREATE INDEX `modules_slug_key` ON `modules` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_number_sequence_tenant_company` ON `number_sequence` (`company_id`);--> statement-breakpoint
CREATE INDEX `organization_slug_key` ON `organization` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_postal_code_lookup` ON `postal_code` (`country_code`,`plz`);--> statement-breakpoint
CREATE INDEX `idx_posting_batch_document` ON `posting_batch` (`document_id`);--> statement-breakpoint
CREATE INDEX `idx_posting_entry_batch` ON `posting_entry` (`batch_id`);--> statement-breakpoint
CREATE INDEX `idx_posting_entry_document_line` ON `posting_entry` (`document_line_id`);--> statement-breakpoint
CREATE INDEX `idx_posting_entry_variant` ON `posting_entry` (`variant_id`);--> statement-breakpoint
CREATE INDEX `idx_price_list_item_variant` ON `price_list_item` (`price_list_id`,`variant_id`,`valid_from`);--> statement-breakpoint
CREATE INDEX `idx_production_order_article` ON `production_order` (`article_id`);--> statement-breakpoint
CREATE INDEX `idx_production_order_status` ON `production_order` (`status`);--> statement-breakpoint
CREATE INDEX `idx_seller_tax_registration_lookup` ON `seller_tax_registration` (`company_id`,`country_code`,`registration_type`,`valid_from`);--> statement-breakpoint
CREATE INDEX `idx_tax_rule_lookup` ON `tax_rule` (`customer_tax_class_id`,`article_tax_class_id`,`country_code`,`valid_from`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_fields_global` ON `tenant_fields` (`entity_name`,`field_name`) WHERE scope = 'global';--> statement-breakpoint
CREATE UNIQUE INDEX `uq_fields_org` ON `tenant_fields` (`organization_id`,`entity_name`,`field_name`) WHERE scope = 'org';--> statement-breakpoint
CREATE UNIQUE INDEX `uq_fields_tenant` ON `tenant_fields` (`entity_name`,`field_name`) WHERE scope = 'tenant';--> statement-breakpoint
CREATE UNIQUE INDEX `uq_groups_global` ON `tenant_groups` (`entity_name`,`group_key`) WHERE scope = 'global';--> statement-breakpoint
CREATE UNIQUE INDEX `uq_groups_org` ON `tenant_groups` (`organization_id`,`entity_name`,`group_key`) WHERE scope = 'org';--> statement-breakpoint
CREATE UNIQUE INDEX `uq_groups_tenant` ON `tenant_groups` (`entity_name`,`group_key`) WHERE scope = 'tenant';--> statement-breakpoint
CREATE UNIQUE INDEX `uq_layouts_global` ON `tenant_layouts` (`entity_name`,`layout_key`) WHERE scope = 'global';--> statement-breakpoint
CREATE UNIQUE INDEX `uq_layouts_org` ON `tenant_layouts` (`organization_id`,`entity_name`,`layout_key`) WHERE scope = 'org';--> statement-breakpoint
CREATE UNIQUE INDEX `uq_layouts_tenant` ON `tenant_layouts` (`entity_name`,`layout_key`) WHERE scope = 'tenant';--> statement-breakpoint
CREATE UNIQUE INDEX `uq_layouts_user` ON `tenant_layouts` (`user_id`,`entity_name`,`layout_key`) WHERE scope = 'user';