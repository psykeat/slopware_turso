DROP TABLE "app_user";--> statement-breakpoint
ALTER TABLE "user_tenant" DROP CONSTRAINT "user_tenant_user_id_tenant_id_unique";--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "display_name" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "last_company_id" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "is_system_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "locale" varchar(5) DEFAULT 'de' NOT NULL;--> statement-breakpoint
ALTER TABLE "helper_table_registry" ADD COLUMN "id" uuid DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "schema_annotations" ADD COLUMN "id" uuid DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "user_tenant" ADD COLUMN "id" uuid DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "schema_annotations" ADD PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "user_tenant" ADD PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "helper_table_registry" DROP CONSTRAINT "helper_table_registry_pkey";--> statement-breakpoint
ALTER TABLE "helper_table_registry" ADD PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "access_token_expires_at" SET DATA TYPE timestamp with time zone USING "access_token_expires_at"::timestamp with time zone;--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "refresh_token_expires_at" SET DATA TYPE timestamp with time zone USING "refresh_token_expires_at"::timestamp with time zone;--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at"::timestamp with time zone;--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at"::timestamp with time zone;--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "expires_at" SET DATA TYPE timestamp with time zone USING "expires_at"::timestamp with time zone;--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at"::timestamp with time zone;--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at"::timestamp with time zone;--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at"::timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at"::timestamp with time zone;--> statement-breakpoint
ALTER TABLE "verification" ALTER COLUMN "expires_at" SET DATA TYPE timestamp with time zone USING "expires_at"::timestamp with time zone;--> statement-breakpoint
ALTER TABLE "verification" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at"::timestamp with time zone;--> statement-breakpoint
ALTER TABLE "verification" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at"::timestamp with time zone;--> statement-breakpoint
ALTER TABLE "account_determination_rule" ALTER COLUMN "rule_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "address" ALTER COLUMN "address_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "address_category" ALTER COLUMN "category_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "address_contact" ALTER COLUMN "contact_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "article" ALTER COLUMN "article_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "article_bom" ALTER COLUMN "bom_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "article_group" ALTER COLUMN "article_group_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "bank_account" ALTER COLUMN "bank_account_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "company" ALTER COLUMN "company_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "connector_definition" ALTER COLUMN "connector_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "cost_center" ALTER COLUMN "cost_center_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "country" ALTER COLUMN "country_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "currency" ALTER COLUMN "currency_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "delivery_address" ALTER COLUMN "delivery_address_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "discount_group" ALTER COLUMN "discount_group_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "document" ALTER COLUMN "document_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "document_group" ALTER COLUMN "document_group_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "document_line" ALTER COLUMN "document_line_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "document_line_tracking" ALTER COLUMN "tracking_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "document_type" ALTER COLUMN "document_type_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "entity_commands" ALTER COLUMN "command_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "fact_sales_event" ALTER COLUMN "fact_sales_event_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "gl_account" ALTER COLUMN "gl_account_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "import_batch" ALTER COLUMN "batch_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "import_row" ALTER COLUMN "row_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "incoterm" ALTER COLUMN "incoterm_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "industry" ALTER COLUMN "industry_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "inventory_balance" ALTER COLUMN "inventory_balance_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "inventory_movement" ALTER COLUMN "inventory_movement_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "journal_entry" ALTER COLUMN "journal_entry_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "journal_line" ALTER COLUMN "journal_line_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "modules" ALTER COLUMN "module_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "number_sequence" ALTER COLUMN "number_sequence_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "organization" ALTER COLUMN "organization_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "payment_term" ALTER COLUMN "payment_term_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "postal_code" ALTER COLUMN "postal_code_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "price_list" ALTER COLUMN "price_list_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "price_list_item" ALTER COLUMN "price_list_item_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "production_order" ALTER COLUMN "production_order_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "serial_number" ALTER COLUMN "serial_number_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "shipping_method" ALTER COLUMN "shipping_method_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "system_settings" ALTER COLUMN "setting_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "tax_class" ALTER COLUMN "tax_class_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "tax_code" ALTER COLUMN "tax_code_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "tax_rule" ALTER COLUMN "tax_rule_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "tenant" ALTER COLUMN "tenant_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "tenant_connector" ALTER COLUMN "tenant_connector_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "tenant_connector_mapping" ALTER COLUMN "mapping_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "tenant_fields" ALTER COLUMN "field_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "tenant_groups" ALTER COLUMN "group_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "tenant_layouts" ALTER COLUMN "layout_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "tenant_rules" ALTER COLUMN "rule_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "unit" ALTER COLUMN "unit_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "warehouse" ALTER COLUMN "warehouse_id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "user_tenant" ADD CONSTRAINT "user_tenant_tenant_id_user_id_unique" UNIQUE("tenant_id","user_id");--> statement-breakpoint
ALTER TABLE "helper_table_registry" ADD CONSTRAINT "helper_table_registry_table_name_key" UNIQUE("table_name");--> statement-breakpoint
ALTER TABLE "user_tenant" ADD CONSTRAINT "user_tenant_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "user_tenant" ADD CONSTRAINT "user_tenant_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");