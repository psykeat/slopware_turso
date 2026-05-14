CREATE TABLE "account_determination_rule" (
	"rule_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"company_id" uuid,
	"article_group_id" uuid,
	"tax_code_id" uuid,
	"posting_context" text NOT NULL,
	"gl_account_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "address" (
	"address_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"address_no" text NOT NULL,
	"address_type" text NOT NULL,
	"is_customer" boolean DEFAULT false NOT NULL,
	"is_supplier" boolean DEFAULT false NOT NULL,
	"company_name" text,
	"first_name" text,
	"last_name" text,
	"address_line_1" text NOT NULL,
	"address_line_2" text,
	"postal_code" text NOT NULL,
	"city" text NOT NULL,
	"state_province" text,
	"country_code" char(2) NOT NULL,
	"vat_id" text,
	"tax_class_id" uuid,
	"currency_id" char(3),
	"payment_term_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"archived_at" timestamp with time zone,
	"custom_attributes" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"bank_account_id" uuid,
	"default_delivery_address_id" uuid,
	"search_text" text,
	"address_category_id" uuid,
	CONSTRAINT "address_tenant_id_address_id_key" UNIQUE("tenant_id","address_id"),
	CONSTRAINT "address_tenant_id_address_no_unique" UNIQUE("tenant_id","address_no")
);
--> statement-breakpoint
CREATE TABLE "address_category" (
	"category_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"name" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"custom_attributes" jsonb,
	CONSTRAINT "address_category_tenant_id_category_id_key" UNIQUE("tenant_id","category_id"),
	CONSTRAINT "address_category_tenant_id_name_unique" UNIQUE("tenant_id","name")
);
--> statement-breakpoint
CREATE TABLE "address_contact" (
	"contact_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"address_id" uuid NOT NULL,
	"first_name" text,
	"last_name" text NOT NULL,
	"email" text,
	"phone_mobile" text,
	"phone_landline" text,
	"role_function" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "address_seq" (
	"tenant_id" uuid PRIMARY KEY,
	"next_val" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_user" (
	"user_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"email" text NOT NULL UNIQUE,
	"password_hash" text NOT NULL,
	"display_name" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_company_id" uuid,
	"is_system_admin" boolean DEFAULT false NOT NULL,
	"locale" varchar(5) DEFAULT 'de' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "article" (
	"article_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"article_no" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"article_group_id" uuid,
	"tax_class_id" uuid,
	"base_unit" text,
	"sales_unit" text,
	"purchase_unit" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"archived_at" timestamp with time zone,
	"custom_attributes" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"default_warehouse_id" uuid,
	"tracking_mode" text,
	"bom_type" text DEFAULT 'none' NOT NULL,
	CONSTRAINT "article_tenant_id_article_id_key" UNIQUE("tenant_id","article_id"),
	CONSTRAINT "article_tenant_id_article_no_unique" UNIQUE("tenant_id","article_no"),
	CONSTRAINT "article_bom_type_check" CHECK (bom_type IN ('none', 'production', 'sales')),
	CONSTRAINT "article_tracking_mode_check" CHECK (tracking_mode IN ('serial', 'batch') OR tracking_mode IS NULL)
);
--> statement-breakpoint
CREATE TABLE "article_bom" (
	"bom_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"header_article_id" uuid NOT NULL,
	"component_article_id" uuid NOT NULL,
	"quantity" numeric NOT NULL,
	"scrap_percentage" numeric DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "article_bom_tenant_id_header_article_id_component_article_id_un" UNIQUE("tenant_id","header_article_id","component_article_id"),
	CONSTRAINT "article_bom_quantity_check" CHECK (quantity > 0)
);
--> statement-breakpoint
CREATE TABLE "article_group" (
	"article_group_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "article_group_tenant_id_article_group_id_key" UNIQUE("tenant_id","article_group_id"),
	CONSTRAINT "article_group_tenant_id_code_unique" UNIQUE("tenant_id","code")
);
--> statement-breakpoint
CREATE TABLE "bank_account" (
	"bank_account_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"company_id" uuid,
	"address_id" uuid,
	"iban" text NOT NULL,
	"bic" text,
	"bank_name" text,
	"currency_id" char(3),
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"custom_attributes" jsonb,
	CONSTRAINT "bank_account_tenant_id_iban_unique" UNIQUE("tenant_id","iban"),
	CONSTRAINT "chk_bank_account_target" CHECK ((company_id IS NOT NULL AND address_id IS NULL) OR (company_id IS NULL AND address_id IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "company" (
	"company_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"company_no" text NOT NULL,
	"name" text NOT NULL,
	"legal_name" text,
	"country_code" char(2) NOT NULL,
	"currency_id" char(3) NOT NULL,
	"vat_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"address_line_1" text,
	"address_line_2" text,
	"city" text,
	"postal_code" text,
	"phone_landline" text,
	"phone_mobile" text,
	"email" text,
	"homepage" text,
	"tax_number" text,
	"tax_authority" text,
	"gln" text,
	"eori_no" text,
	"duns_no" text,
	"custom_attributes" jsonb,
	"bank_name" text,
	"bank_bic" text,
	"bank_iban" text,
	"fiscal_year_start_month" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "company_tenant_id_company_id_key" UNIQUE("tenant_id","company_id"),
	CONSTRAINT "company_tenant_id_company_no_unique" UNIQUE("tenant_id","company_no"),
	CONSTRAINT "company_fiscal_year_start_month_check" CHECK (fiscal_year_start_month >= 1 AND fiscal_year_start_month <= 12)
);
--> statement-breakpoint
CREATE TABLE "connector_definition" (
	"connector_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"slug" text NOT NULL UNIQUE,
	"label" jsonb NOT NULL,
	"default_mappings" jsonb DEFAULT '{}' NOT NULL,
	"locked_fields" jsonb DEFAULT '[]' NOT NULL,
	"atomicity_mode" text NOT NULL,
	CONSTRAINT "connector_definition_atomicity_mode_check" CHECK (atomicity_mode IN ('file', 'entity', 'run'))
);
--> statement-breakpoint
CREATE TABLE "cost_center" (
	"cost_center_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"company_id" uuid,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cost_center_tenant_id_code_unique" UNIQUE("tenant_id","code"),
	CONSTRAINT "cost_center_tenant_id_cost_center_id_key" UNIQUE("tenant_id","cost_center_id")
);
--> statement-breakpoint
CREATE TABLE "country" (
	"country_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"iso2_code" varchar(2) NOT NULL UNIQUE,
	"iso3_code" varchar(3) NOT NULL UNIQUE,
	"name" jsonb NOT NULL,
	"is_eu" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "currency" (
	"currency_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"code" varchar(3) NOT NULL UNIQUE,
	"name" jsonb NOT NULL,
	"symbol" varchar(5),
	"decimals" integer DEFAULT 2 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_address" (
	"delivery_address_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"address_id" uuid NOT NULL,
	"name" text,
	"address_line_1" text NOT NULL,
	"address_line_2" text,
	"postal_code" text NOT NULL,
	"city" text NOT NULL,
	"country_code" char(2) NOT NULL,
	"is_active" boolean DEFAULT true,
	"default_for_shipping" boolean DEFAULT false,
	"custom_attributes" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "discount_group" (
	"discount_group_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"percentage" numeric NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discount_group_tenant_id_name_unique" UNIQUE("tenant_id","name")
);
--> statement-breakpoint
CREATE TABLE "document" (
	"document_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"document_type" char(1) NOT NULL,
	"document_direction" text NOT NULL,
	"document_no" text NOT NULL,
	"status" text NOT NULL,
	"customer_id" uuid,
	"currency_id" char(3),
	"document_date" date NOT NULL,
	"posting_date" date,
	"total_net" numeric,
	"total_tax" numeric,
	"total_gross" numeric,
	"version_no" integer DEFAULT 1 NOT NULL,
	"posted_at" timestamp with time zone,
	"posted_by" uuid,
	"cancelled_at" timestamp with time zone,
	"storno_document_id" uuid,
	"custom_attributes" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"transaction_id" uuid NOT NULL,
	"parent_document_id" uuid,
	"document_group_id" uuid,
	"archived_at" timestamp with time zone,
	"billing_address" jsonb,
	"delivery_address" jsonb,
	"delivery_address_id" uuid,
	"payment_term_id" uuid,
	"shipping_method_id" uuid,
	"document_type_id" uuid,
	"warehouse_id" uuid,
	"target_warehouse_id" uuid,
	CONSTRAINT "document_tenant_id_company_id_document_no_unique" UNIQUE("tenant_id","company_id","document_no"),
	CONSTRAINT "document_tenant_id_document_id_key" UNIQUE("tenant_id","document_id"),
	CONSTRAINT "chk_document_type" CHECK (document_type IN ('N', 'A', 'L', 'R', 'G', 'b', 'l', 'r', 'g', 'Z', 'E', 'V', 'q', 'p', 'U'))
);
--> statement-breakpoint
CREATE TABLE "document_group" (
	"document_group_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"number_sequence_id" uuid,
	"description" text,
	"default_warehouse_id" uuid,
	"default_tax_code_id" uuid,
	"default_sales_account_id" uuid,
	"default_cost_account_id" uuid,
	"is_active" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"updated_at" timestamp with time zone,
	"default_payment_term_id" uuid,
	"default_shipping_method_id" uuid,
	"require_serial_tracking" boolean DEFAULT true NOT NULL,
	"require_batch_tracking" boolean DEFAULT true NOT NULL,
	"document_type" varchar(1) NOT NULL,
	"group_number" integer NOT NULL,
	"direction" varchar(20),
	"next_group_id" uuid,
	"company_id" uuid,
	CONSTRAINT "document_group_tenant_id_document_group_id_key" UNIQUE("tenant_id","document_group_id"),
	CONSTRAINT "document_group_tenant_id_document_type_group_number_unique" UNIQUE("tenant_id","document_type","group_number"),
	CONSTRAINT "document_group_group_number_check" CHECK (group_number >= 0 AND group_number <= 99)
);
--> statement-breakpoint
CREATE TABLE "document_line" (
	"document_line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"line_no" integer NOT NULL,
	"article_id" uuid,
	"article_text_snapshot" text,
	"quantity" numeric NOT NULL,
	"unit" text,
	"net_price" numeric NOT NULL,
	"discount_percentage" numeric,
	"tax_code_id" uuid,
	"tax_amount" numeric,
	"line_total_net" numeric,
	"warehouse_id" uuid,
	"cost_center_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"transaction_id" uuid,
	"movement_type" char(1),
	"line_type" varchar(20) DEFAULT 'article' NOT NULL,
	CONSTRAINT "document_line_tenant_id_document_id_line_no_unique" UNIQUE("tenant_id","document_id","line_no"),
	CONSTRAINT "document_line_tenant_id_document_line_id_key" UNIQUE("tenant_id","document_line_id"),
	CONSTRAINT "chk_article_line_requires_article_id" CHECK (line_type = 'comment' OR article_id IS NOT NULL),
	CONSTRAINT "chk_document_line_movement_type" CHECK (movement_type IN ('N', 'A', 'L', 'R', 'G', 'b', 'l', 'r', 'g', 'Z', 'E', 'V', 'q', 'p', 'U') OR movement_type IS NULL),
	CONSTRAINT "document_line_line_type_check" CHECK (line_type IN ('article', 'comment', 'production_output', 'production_input', 'bom_component'))
);
--> statement-breakpoint
CREATE TABLE "document_line_tracking" (
	"tracking_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"document_line_id" uuid NOT NULL,
	"serial_number_id" uuid,
	"batch_no" text,
	"qty" numeric NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_line_tracking_check" CHECK ((serial_number_id IS NOT NULL AND batch_no IS NULL) OR (serial_number_id IS NULL AND batch_no IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "document_type" (
	"document_type_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(100) NOT NULL,
	"movement_type" char(1) NOT NULL,
	"next_document_type_id" uuid,
	"requires_warehouse" boolean DEFAULT true NOT NULL,
	"requires_cost_center" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_type_tenant_id_code_unique" UNIQUE("tenant_id","code"),
	CONSTRAINT "document_type_tenant_id_document_type_id_key" UNIQUE("tenant_id","document_type_id"),
	CONSTRAINT "document_type_movement_type_check" CHECK (movement_type IN ('N', 'A', 'L', 'R', 'G', 'b', 'l', 'r', 'g', 'Z', 'E', 'V', 'q', 'p', 'U'))
);
--> statement-breakpoint
CREATE TABLE "entity_commands" (
	"command_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"scope" text DEFAULT 'global' NOT NULL,
	"organization_id" uuid,
	"tenant_id" uuid,
	"entity_name" text NOT NULL,
	"command_key" text NOT NULL,
	"handlerkey" text,
	"label" jsonb NOT NULL,
	"description" jsonb,
	"http_method" text DEFAULT 'POST' NOT NULL,
	"route_pattern" text NOT NULL,
	"entity_id_param" text,
	"parent_entity" text,
	"parent_id_source" text,
	"input_schema" jsonb DEFAULT '{}' NOT NULL,
	"server_managed" jsonb DEFAULT '[]' NOT NULL,
	"ui_placement" text,
	"ui_icon" text,
	"ui_shortcut" text,
	"ui_confirm" jsonb,
	"writes_tables" jsonb DEFAULT '[]' NOT NULL,
	"side_effects" jsonb DEFAULT '[]' NOT NULL,
	"min_role" text DEFAULT 'tenant_user' NOT NULL,
	"visibility" text DEFAULT 'tenant' NOT NULL,
	"command_state" text DEFAULT 'published' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entity_commands_scope_organization_id_tenant_id_entity_name_com" UNIQUE("scope","organization_id","tenant_id","entity_name","command_key")
);
--> statement-breakpoint
CREATE TABLE "fact_sales_event" (
	"fact_sales_event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"company_id" uuid,
	"source_document_id" uuid,
	"source_document_line_id" uuid,
	"customer_id" uuid,
	"article_id" uuid,
	"event_type" text,
	"quantity_delta" numeric NOT NULL,
	"amount_net_delta" numeric NOT NULL,
	"booking_period" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"transaction_id" uuid
);
--> statement-breakpoint
CREATE TABLE "gl_account" (
	"gl_account_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"company_id" uuid,
	"account_no" text NOT NULL,
	"name" text NOT NULL,
	"account_type" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gl_account_tenant_id_account_no_unique" UNIQUE("tenant_id","account_no"),
	CONSTRAINT "gl_account_tenant_id_gl_account_id_key" UNIQUE("tenant_id","gl_account_id")
);
--> statement-breakpoint
CREATE TABLE "helper_table_registry" (
	"table_name" text PRIMARY KEY,
	"label" jsonb NOT NULL,
	"pk_column" text NOT NULL,
	"display_column" text NOT NULL,
	"display_is_i18n" boolean DEFAULT false NOT NULL,
	"code_column" text,
	"is_tenant_scoped" boolean DEFAULT false NOT NULL,
	"default_filter" jsonb,
	"sort_column" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"value_column" text
);
--> statement-breakpoint
CREATE TABLE "import_batch" (
	"batch_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"connector_id" uuid,
	"atomicity_mode" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"is_rerun" boolean DEFAULT false NOT NULL,
	"source_batch_id" uuid,
	"posted_entity_count" integer DEFAULT 0 NOT NULL,
	"error_summary" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"target_entity" text,
	"target_command_key" text,
	CONSTRAINT "import_batch_atomicity_mode_check" CHECK (atomicity_mode IN ('file', 'entity', 'run')),
	CONSTRAINT "import_batch_status_check" CHECK (status IN ('pending', 'validating', 'approved', 'posted', 'failed', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "import_row" (
	"row_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"batch_id" uuid NOT NULL,
	"target_entity" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_detail" jsonb,
	"posted_at" timestamp with time zone,
	CONSTRAINT "import_row_status_check" CHECK (status IN ('pending', 'posted', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "incoterm" (
	"incoterm_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"code" char(3) NOT NULL UNIQUE,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "industry" (
	"industry_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"name" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"custom_attributes" jsonb,
	CONSTRAINT "industry_tenant_id_name_unique" UNIQUE("tenant_id","name")
);
--> statement-breakpoint
CREATE TABLE "inventory_balance" (
	"inventory_balance_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"company_id" uuid,
	"warehouse_id" uuid NOT NULL,
	"article_id" uuid NOT NULL,
	"on_hand_qty" numeric DEFAULT '0' NOT NULL,
	"reserved_qty" numeric DEFAULT '0' NOT NULL,
	"as_of_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"available_qty" numeric,
	"expected_purchase_qty" numeric DEFAULT '0' NOT NULL,
	"gld_purchase" numeric,
	"gld_cost" numeric,
	CONSTRAINT "inventory_balance_tenant_id_warehouse_id_article_id_unique" UNIQUE("tenant_id","warehouse_id","article_id")
);
--> statement-breakpoint
CREATE TABLE "inventory_movement" (
	"inventory_movement_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"company_id" uuid,
	"warehouse_id" uuid NOT NULL,
	"article_id" uuid NOT NULL,
	"movement_type" char(1) NOT NULL,
	"qty_delta" numeric,
	"movement_date" timestamp with time zone NOT NULL,
	"source_document_id" uuid,
	"source_document_line_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"transaction_id" uuid,
	"absolute_qty" numeric,
	"reference_text" text,
	"serial_number_id" uuid,
	"batch_no" text,
	CONSTRAINT "chk_inventory_movement_qty_logic" CHECK ((movement_type = 'V' AND absolute_qty IS NOT NULL) OR (movement_type <> 'V' AND qty_delta IS NOT NULL AND absolute_qty IS NULL)),
	CONSTRAINT "chk_inventory_movement_type" CHECK (movement_type IN ('N', 'A', 'L', 'R', 'G', 'b', 'l', 'r', 'g', 'Z', 'E', 'V', 'q', 'p', 'U'))
);
--> statement-breakpoint
CREATE TABLE "journal_entry" (
	"journal_entry_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"posting_date" date NOT NULL,
	"source_document_id" uuid,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "journal_entry_tenant_id_journal_entry_id_key" UNIQUE("tenant_id","journal_entry_id")
);
--> statement-breakpoint
CREATE TABLE "journal_line" (
	"journal_line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"journal_entry_id" uuid NOT NULL,
	"gl_account_id" uuid NOT NULL,
	"debit_amount" numeric DEFAULT '0' NOT NULL,
	"credit_amount" numeric DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_debit_or_credit" CHECK ((debit_amount > 0 AND credit_amount = 0) OR (credit_amount > 0 AND debit_amount = 0))
);
--> statement-breakpoint
CREATE TABLE "modules" (
	"module_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"slug" text NOT NULL UNIQUE,
	"label" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "number_sequence" (
	"number_sequence_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"prefix" varchar(10) NOT NULL,
	"next_value" integer DEFAULT 1 NOT NULL,
	"padding" integer DEFAULT 5 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "number_sequence_tenant_id_company_id_prefix_unique" UNIQUE("tenant_id","company_id","prefix"),
	CONSTRAINT "number_sequence_tenant_id_number_sequence_id_unique" UNIQUE("tenant_id","number_sequence_id")
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"organization_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"slug" varchar(63) NOT NULL UNIQUE,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_term" (
	"payment_term_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"name" jsonb NOT NULL,
	"net_days" integer NOT NULL,
	"discount_days" integer,
	"discount_percentage" numeric,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"custom_attributes" jsonb,
	CONSTRAINT "payment_term_tenant_id_name_unique" UNIQUE("tenant_id","name"),
	CONSTRAINT "payment_term_tenant_id_payment_term_id_key" UNIQUE("tenant_id","payment_term_id")
);
--> statement-breakpoint
CREATE TABLE "postal_code" (
	"postal_code_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"country_code" varchar(2) NOT NULL,
	"plz" text NOT NULL,
	"city" text NOT NULL,
	"state" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "postal_code_country_code_plz_city_state_unique" UNIQUE("country_code","plz","city","state")
);
--> statement-breakpoint
CREATE TABLE "price_list" (
	"price_list_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"currency_id" char(3) NOT NULL,
	"is_net" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_list_tenant_id_name_unique" UNIQUE("tenant_id","name"),
	CONSTRAINT "price_list_tenant_id_price_list_id_key" UNIQUE("tenant_id","price_list_id")
);
--> statement-breakpoint
CREATE TABLE "price_list_item" (
	"price_list_item_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"price_list_id" uuid NOT NULL,
	"article_id" uuid NOT NULL,
	"price" numeric NOT NULL,
	"valid_from" date,
	"valid_to" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_list_item_tenant_id_price_list_id_article_id_valid_from_u" UNIQUE("tenant_id","price_list_id","article_id","valid_from")
);
--> statement-breakpoint
CREATE TABLE "production_order" (
	"production_order_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"company_id" uuid,
	"order_no" varchar(50) NOT NULL,
	"article_id" uuid,
	"quantity" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'planned' NOT NULL,
	"planned_start_date" date,
	"planned_end_date" date,
	"actual_start_date" date,
	"actual_end_date" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "production_order_tenant_id_order_no_unique" UNIQUE("tenant_id","order_no")
);
--> statement-breakpoint
CREATE TABLE "schema_annotations" (
	"table_name" text NOT NULL,
	"column_name" text DEFAULT '' NOT NULL,
	"business_name" text NOT NULL,
	"description" text NOT NULL,
	"data_class" text NOT NULL,
	"module_id" uuid,
	"mandatory_for" jsonb DEFAULT '[]' NOT NULL,
	"locked_for" jsonb DEFAULT '[]' NOT NULL,
	"ai_generated_at" timestamp with time zone,
	"human_override" boolean DEFAULT false NOT NULL,
	CONSTRAINT "schema_annotations_table_name_column_name_unique" UNIQUE("table_name","column_name")
);
--> statement-breakpoint
CREATE TABLE "serial_number" (
	"serial_number_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"article_id" uuid NOT NULL,
	"serial_no" text NOT NULL,
	"status" text DEFAULT 'in_stock' NOT NULL,
	"created_movement_id" uuid,
	"consumed_movement_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "serial_number_tenant_id_article_id_serial_no_unique" UNIQUE("tenant_id","article_id","serial_no"),
	CONSTRAINT "serial_number_tenant_id_serial_number_id_key" UNIQUE("tenant_id","serial_number_id"),
	CONSTRAINT "serial_number_status_check" CHECK (status IN ('in_stock', 'reserved', 'sold'))
);
--> statement-breakpoint
CREATE TABLE "shipping_method" (
	"shipping_method_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"name" jsonb NOT NULL,
	"tracking_url_template" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"custom_attributes" jsonb,
	CONSTRAINT "shipping_method_tenant_id_name_unique" UNIQUE("tenant_id","name"),
	CONSTRAINT "shipping_method_tenant_id_shipping_method_id_key" UNIQUE("tenant_id","shipping_method_id")
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"setting_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"scope" text NOT NULL,
	"organization_id" uuid,
	"tenant_id" uuid,
	"key" text NOT NULL CONSTRAINT "uq_settings_global" UNIQUE,
	"value" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "uq_settings_org" UNIQUE("organization_id","key"),
	CONSTRAINT "uq_settings_tenant" UNIQUE("tenant_id","key")
);
--> statement-breakpoint
CREATE TABLE "tax_class" (
	"tax_class_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"custom_attributes" jsonb,
	CONSTRAINT "tax_class_tenant_id_code_unique" UNIQUE("tenant_id","code")
);
--> statement-breakpoint
CREATE TABLE "tax_code" (
	"tax_code_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"tax_rate" numeric NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tax_code_tenant_id_code_unique" UNIQUE("tenant_id","code"),
	CONSTRAINT "tax_code_tenant_id_tax_code_id_key" UNIQUE("tenant_id","tax_code_id")
);
--> statement-breakpoint
CREATE TABLE "tax_rule" (
	"tax_rule_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"customer_tax_class_id" uuid,
	"article_tax_class_id" uuid,
	"country_code" char(2),
	"tax_code_id" uuid NOT NULL,
	"valid_from" date NOT NULL,
	"valid_to" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant" (
	"tenant_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" uuid NOT NULL,
	"slug" varchar(63) NOT NULL UNIQUE,
	"name" text NOT NULL,
	"is_base" boolean DEFAULT false NOT NULL CONSTRAINT "uq_single_base_tenant" UNIQUE,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_connector" (
	"tenant_connector_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"connector_id" uuid NOT NULL,
	"credentials" jsonb DEFAULT '{}' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_connector_tenant_id_tenant_connector_id_key" UNIQUE("tenant_id","tenant_connector_id")
);
--> statement-breakpoint
CREATE TABLE "tenant_connector_mapping" (
	"mapping_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"tenant_connector_id" uuid NOT NULL,
	"source_field" text NOT NULL,
	"target_table" text NOT NULL,
	"target_column" text NOT NULL,
	"transform" jsonb DEFAULT '{"type":"direct"}' NOT NULL,
	"default_value" jsonb,
	CONSTRAINT "tenant_connector_mapping_tenant_connector_id_source_field_uniqu" UNIQUE("tenant_connector_id","source_field")
);
--> statement-breakpoint
CREATE TABLE "tenant_fields" (
	"field_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"scope" text DEFAULT 'tenant' NOT NULL,
	"organization_id" uuid,
	"tenant_id" uuid,
	"entity_name" text NOT NULL,
	"field_name" text NOT NULL,
	"field_type" text NOT NULL,
	"is_required" boolean DEFAULT false NOT NULL,
	"custom_attributes" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"label" jsonb,
	"help_text" jsonb,
	"is_visible" boolean DEFAULT true NOT NULL,
	"display_order" integer,
	"import_column" text,
	"import_type" text,
	"import_required" boolean DEFAULT false NOT NULL,
	"import_transform" text,
	"group_id" text,
	"lookup_table" text,
	"lookup_filter" jsonb,
	CONSTRAINT "uq_fields_global" UNIQUE("entity_name","field_name"),
	CONSTRAINT "uq_fields_org" UNIQUE("organization_id","entity_name","field_name"),
	CONSTRAINT "uq_fields_tenant" UNIQUE("tenant_id","entity_name","field_name")
);
--> statement-breakpoint
CREATE TABLE "tenant_groups" (
	"group_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"scope" text DEFAULT 'tenant' NOT NULL,
	"organization_id" uuid,
	"tenant_id" uuid,
	"entity_name" text NOT NULL,
	"group_key" text NOT NULL,
	"label" jsonb NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"custom_attributes" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_groups_global" UNIQUE("entity_name","group_key"),
	CONSTRAINT "uq_groups_org" UNIQUE("organization_id","entity_name","group_key"),
	CONSTRAINT "uq_groups_tenant" UNIQUE("tenant_id","entity_name","group_key")
);
--> statement-breakpoint
CREATE TABLE "tenant_layouts" (
	"layout_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"scope" text DEFAULT 'tenant' NOT NULL,
	"organization_id" uuid,
	"tenant_id" uuid,
	"entity_name" text NOT NULL,
	"layout_key" text NOT NULL,
	"layout_definition" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_layouts_global" UNIQUE("entity_name","layout_key"),
	CONSTRAINT "uq_layouts_org" UNIQUE("organization_id","entity_name","layout_key"),
	CONSTRAINT "uq_layouts_tenant" UNIQUE("tenant_id","entity_name","layout_key")
);
--> statement-breakpoint
CREATE TABLE "tenant_rules" (
	"rule_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"scope" text DEFAULT 'tenant' NOT NULL,
	"organization_id" uuid,
	"tenant_id" uuid,
	"entity_name" text NOT NULL,
	"hook_name" text NOT NULL,
	"rule_state" text DEFAULT 'draft' NOT NULL,
	"rule_definition" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rule_source" text,
	CONSTRAINT "uq_rules_global" UNIQUE("entity_name","hook_name"),
	CONSTRAINT "uq_rules_org" UNIQUE("organization_id","entity_name","hook_name"),
	CONSTRAINT "uq_rules_tenant" UNIQUE("tenant_id","entity_name","hook_name")
);
--> statement-breakpoint
CREATE TABLE "unit" (
	"unit_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"code" varchar(10) NOT NULL,
	"name" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"custom_attributes" jsonb,
	CONSTRAINT "unit_tenant_id_code_unique" UNIQUE("tenant_id","code")
);
--> statement-breakpoint
CREATE TABLE "user_tenant" (
	"user_id" text NOT NULL,
	"tenant_id" uuid NOT NULL,
	"role" text NOT NULL,
	CONSTRAINT "user_tenant_user_id_tenant_id_unique" UNIQUE("user_id","tenant_id")
);
--> statement-breakpoint
CREATE TABLE "warehouse" (
	"warehouse_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"tenant_id" uuid NOT NULL,
	"company_id" uuid,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "warehouse_tenant_id_code_unique" UNIQUE("tenant_id","code"),
	CONSTRAINT "warehouse_tenant_id_warehouse_id_key" UNIQUE("tenant_id","warehouse_id")
);
--> statement-breakpoint
CREATE INDEX "idx_acct_det_lookup" ON "account_determination_rule" ("tenant_id","posting_context","article_group_id","tax_code_id");--> statement-breakpoint
CREATE INDEX "idx_acct_det_tenant" ON "account_determination_rule" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_address_category" ON "address" ("tenant_id","address_category_id");--> statement-breakpoint
CREATE INDEX "idx_address_customer" ON "address" ("tenant_id","is_customer");--> statement-breakpoint
CREATE INDEX "idx_address_supplier" ON "address" ("tenant_id","is_supplier");--> statement-breakpoint
CREATE INDEX "idx_address_tenant" ON "address" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_address_type" ON "address" ("tenant_id","address_type");--> statement-breakpoint
CREATE INDEX "idx_address_category_tenant" ON "address_category" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_address_contact_address" ON "address_contact" ("address_id");--> statement-breakpoint
CREATE INDEX "idx_address_contact_tenant" ON "address_contact" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_address_seq_tenant" ON "address_seq" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_article_default_wh" ON "article" ("tenant_id","default_warehouse_id");--> statement-breakpoint
CREATE INDEX "idx_article_group_fk" ON "article" ("article_group_id");--> statement-breakpoint
CREATE INDEX "idx_article_tenant" ON "article" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_article_tenant_active" ON "article" ("tenant_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_article_group_tenant" ON "article_group" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_bank_account_address" ON "bank_account" ("address_id");--> statement-breakpoint
CREATE INDEX "idx_bank_account_company" ON "bank_account" ("company_id");--> statement-breakpoint
CREATE INDEX "idx_bank_account_tenant" ON "bank_account" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_company_tenant" ON "company" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_company_tenant_active" ON "company" ("tenant_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_cost_center_tenant" ON "cost_center" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_delivery_address_partner" ON "delivery_address" ("address_id");--> statement-breakpoint
CREATE INDEX "idx_delivery_address_tenant" ON "delivery_address" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_discount_group_tenant" ON "discount_group" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_document_company" ON "document" ("tenant_id","company_id");--> statement-breakpoint
CREATE INDEX "idx_document_customer" ON "document" ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX "idx_document_delivery_address" ON "document" ("tenant_id","delivery_address_id");--> statement-breakpoint
CREATE INDEX "idx_document_group" ON "document" ("document_group_id");--> statement-breakpoint
CREATE INDEX "idx_document_group_type" ON "document" ("document_group_id","document_type_id");--> statement-breakpoint
CREATE INDEX "idx_document_parent" ON "document" ("parent_document_id");--> statement-breakpoint
CREATE INDEX "idx_document_payment_term" ON "document" ("payment_term_id");--> statement-breakpoint
CREATE INDEX "idx_document_posted_at" ON "document" ("tenant_id","posted_at");--> statement-breakpoint
CREATE INDEX "idx_document_shipping_method" ON "document" ("shipping_method_id");--> statement-breakpoint
CREATE INDEX "idx_document_tenant" ON "document" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_document_transaction" ON "document" ("tenant_id","transaction_id");--> statement-breakpoint
CREATE INDEX "idx_document_type_status" ON "document" ("tenant_id","document_type","status");--> statement-breakpoint
CREATE INDEX "idx_document_warehouse" ON "document" ("warehouse_id");--> statement-breakpoint
CREATE INDEX "idx_document_group_company" ON "document_group" ("company_id");--> statement-breakpoint
CREATE INDEX "idx_document_group_tenant" ON "document_group" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_document_line_article" ON "document_line" ("article_id");--> statement-breakpoint
CREATE INDEX "idx_document_line_document" ON "document_line" ("document_id");--> statement-breakpoint
CREATE INDEX "idx_document_line_tenant" ON "document_line" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_document_line_tx" ON "document_line" ("tenant_id","transaction_id");--> statement-breakpoint
CREATE INDEX "idx_document_type_tenant" ON "document_type" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_entity_commands_entity" ON "entity_commands" ("entity_name","command_state");--> statement-breakpoint
CREATE INDEX "idx_entity_commands_org" ON "entity_commands" ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_entity_commands_tenant" ON "entity_commands" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_fact_sales_article" ON "fact_sales_event" ("tenant_id","article_id");--> statement-breakpoint
CREATE INDEX "idx_fact_sales_customer" ON "fact_sales_event" ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX "idx_fact_sales_period" ON "fact_sales_event" ("tenant_id","booking_period");--> statement-breakpoint
CREATE INDEX "idx_fact_sales_tenant" ON "fact_sales_event" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_fact_sales_tx" ON "fact_sales_event" ("tenant_id","transaction_id");--> statement-breakpoint
CREATE INDEX "idx_gl_account_tenant" ON "gl_account" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_industry_tenant" ON "industry" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_inv_balance_lookup" ON "inventory_balance" ("tenant_id","warehouse_id","article_id");--> statement-breakpoint
CREATE INDEX "idx_inv_balance_tenant" ON "inventory_balance" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_inv_movement_date" ON "inventory_movement" ("tenant_id","movement_date");--> statement-breakpoint
CREATE INDEX "idx_inv_movement_inventory_anchor" ON "inventory_movement" ("tenant_id","warehouse_id","article_id","movement_date");--> statement-breakpoint
CREATE INDEX "idx_inv_movement_lookup" ON "inventory_movement" ("tenant_id","warehouse_id","article_id","movement_date");--> statement-breakpoint
CREATE INDEX "idx_inv_movement_tenant" ON "inventory_movement" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_inv_movement_tx" ON "inventory_movement" ("tenant_id","transaction_id");--> statement-breakpoint
CREATE INDEX "idx_inv_movement_warehouse_article" ON "inventory_movement" ("tenant_id","warehouse_id","article_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_movement_batch_balance" ON "inventory_movement" ("tenant_id","warehouse_id","article_id","batch_no");--> statement-breakpoint
CREATE INDEX "idx_journal_entry_company" ON "journal_entry" ("tenant_id","company_id");--> statement-breakpoint
CREATE INDEX "idx_journal_entry_date" ON "journal_entry" ("tenant_id","posting_date");--> statement-breakpoint
CREATE INDEX "idx_journal_entry_document" ON "journal_entry" ("source_document_id");--> statement-breakpoint
CREATE INDEX "idx_journal_entry_tenant" ON "journal_entry" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_journal_line_account" ON "journal_line" ("gl_account_id");--> statement-breakpoint
CREATE INDEX "idx_journal_line_entry" ON "journal_line" ("journal_entry_id");--> statement-breakpoint
CREATE INDEX "idx_journal_line_tenant" ON "journal_line" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_number_sequence_tenant" ON "number_sequence" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_number_sequence_tenant_company" ON "number_sequence" ("tenant_id","company_id");--> statement-breakpoint
CREATE INDEX "idx_payment_term_tenant" ON "payment_term" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_postal_code_lookup" ON "postal_code" ("country_code","plz");--> statement-breakpoint
CREATE INDEX "idx_price_list_tenant" ON "price_list" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_price_list_item_lookup" ON "price_list_item" ("price_list_id","article_id","valid_from");--> statement-breakpoint
CREATE INDEX "idx_price_list_item_tenant" ON "price_list_item" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_production_order_article" ON "production_order" ("article_id");--> statement-breakpoint
CREATE INDEX "idx_production_order_status" ON "production_order" ("status");--> statement-breakpoint
CREATE INDEX "idx_production_order_tenant" ON "production_order" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_shipping_method_tenant" ON "shipping_method" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_tax_class_tenant" ON "tax_class" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_tax_code_tenant" ON "tax_code" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_tax_rule_lookup" ON "tax_rule" ("tenant_id","customer_tax_class_id","article_tax_class_id","country_code","valid_from");--> statement-breakpoint
CREATE INDEX "idx_tax_rule_tenant" ON "tax_rule" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_tenant_organization" ON "tenant" ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_unit_tenant" ON "unit" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_user_tenant_tenant" ON "user_tenant" ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_user_tenant_user" ON "user_tenant" ("user_id");--> statement-breakpoint
CREATE INDEX "idx_warehouse_tenant" ON "warehouse" ("tenant_id");--> statement-breakpoint
ALTER TABLE "account_determination_rule" ADD CONSTRAINT "account_determination_rule_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "account_determination_rule" ADD CONSTRAINT "account_determination_rule_company_id_company_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("company_id");--> statement-breakpoint
ALTER TABLE "address" ADD CONSTRAINT "address_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "address" ADD CONSTRAINT "address_address_category_id_address_category_category_id_fkey" FOREIGN KEY ("address_category_id") REFERENCES "address_category"("category_id");--> statement-breakpoint
ALTER TABLE "address_category" ADD CONSTRAINT "address_category_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "address_contact" ADD CONSTRAINT "address_contact_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "address_contact" ADD CONSTRAINT "address_contact_address_id_address_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "address"("address_id");--> statement-breakpoint
ALTER TABLE "address_seq" ADD CONSTRAINT "address_seq_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "article" ADD CONSTRAINT "article_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "article" ADD CONSTRAINT "article_article_group_id_article_group_article_group_id_fkey" FOREIGN KEY ("article_group_id") REFERENCES "article_group"("article_group_id");--> statement-breakpoint
ALTER TABLE "article_bom" ADD CONSTRAINT "article_bom_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "article_bom" ADD CONSTRAINT "article_bom_header_article_id_article_article_id_fkey" FOREIGN KEY ("header_article_id") REFERENCES "article"("article_id");--> statement-breakpoint
ALTER TABLE "article_bom" ADD CONSTRAINT "article_bom_component_article_id_article_article_id_fkey" FOREIGN KEY ("component_article_id") REFERENCES "article"("article_id");--> statement-breakpoint
ALTER TABLE "article_group" ADD CONSTRAINT "article_group_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "bank_account" ADD CONSTRAINT "bank_account_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "bank_account" ADD CONSTRAINT "bank_account_company_id_company_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("company_id");--> statement-breakpoint
ALTER TABLE "bank_account" ADD CONSTRAINT "bank_account_address_id_address_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "address"("address_id");--> statement-breakpoint
ALTER TABLE "company" ADD CONSTRAINT "company_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "cost_center" ADD CONSTRAINT "cost_center_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "cost_center" ADD CONSTRAINT "cost_center_company_id_company_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("company_id");--> statement-breakpoint
ALTER TABLE "delivery_address" ADD CONSTRAINT "delivery_address_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "delivery_address" ADD CONSTRAINT "delivery_address_address_id_address_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "address"("address_id");--> statement-breakpoint
ALTER TABLE "discount_group" ADD CONSTRAINT "discount_group_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_company_id_company_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("company_id");--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_customer_id_address_address_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "address"("address_id");--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_IHjrWqOzpS79_fkey" FOREIGN KEY ("document_group_id") REFERENCES "document_group"("document_group_id");--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_TmGs0yaFu3BP_fkey" FOREIGN KEY ("delivery_address_id") REFERENCES "delivery_address"("delivery_address_id");--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_document_type_id_document_type_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "document_type"("document_type_id");--> statement-breakpoint
ALTER TABLE "document_group" ADD CONSTRAINT "document_group_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "document_group" ADD CONSTRAINT "document_group_company_id_company_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("company_id");--> statement-breakpoint
ALTER TABLE "document_line" ADD CONSTRAINT "document_line_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "document_line" ADD CONSTRAINT "document_line_document_id_document_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "document"("document_id");--> statement-breakpoint
ALTER TABLE "document_line" ADD CONSTRAINT "document_line_article_id_article_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "article"("article_id");--> statement-breakpoint
ALTER TABLE "document_line" ADD CONSTRAINT "document_line_cost_center_id_cost_center_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "cost_center"("cost_center_id");--> statement-breakpoint
ALTER TABLE "document_line_tracking" ADD CONSTRAINT "document_line_tracking_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "document_line_tracking" ADD CONSTRAINT "document_line_tracking_kgh0lcfaIQqB_fkey" FOREIGN KEY ("document_line_id") REFERENCES "document_line"("document_line_id");--> statement-breakpoint
ALTER TABLE "document_type" ADD CONSTRAINT "document_type_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "entity_commands" ADD CONSTRAINT "entity_commands_d4ol2p0cdbYU_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("organization_id");--> statement-breakpoint
ALTER TABLE "entity_commands" ADD CONSTRAINT "entity_commands_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "fact_sales_event" ADD CONSTRAINT "fact_sales_event_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "fact_sales_event" ADD CONSTRAINT "fact_sales_event_company_id_company_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("company_id");--> statement-breakpoint
ALTER TABLE "fact_sales_event" ADD CONSTRAINT "fact_sales_event_source_document_id_document_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "document"("document_id");--> statement-breakpoint
ALTER TABLE "fact_sales_event" ADD CONSTRAINT "fact_sales_event_CDf5lB0Idqcv_fkey" FOREIGN KEY ("source_document_line_id") REFERENCES "document_line"("document_line_id");--> statement-breakpoint
ALTER TABLE "fact_sales_event" ADD CONSTRAINT "fact_sales_event_customer_id_address_address_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "address"("address_id");--> statement-breakpoint
ALTER TABLE "fact_sales_event" ADD CONSTRAINT "fact_sales_event_article_id_article_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "article"("article_id");--> statement-breakpoint
ALTER TABLE "gl_account" ADD CONSTRAINT "gl_account_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "gl_account" ADD CONSTRAINT "gl_account_company_id_company_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("company_id");--> statement-breakpoint
ALTER TABLE "import_batch" ADD CONSTRAINT "import_batch_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "import_row" ADD CONSTRAINT "import_row_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "import_row" ADD CONSTRAINT "import_row_batch_id_import_batch_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "import_batch"("batch_id");--> statement-breakpoint
ALTER TABLE "industry" ADD CONSTRAINT "industry_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "inventory_balance" ADD CONSTRAINT "inventory_balance_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "inventory_balance" ADD CONSTRAINT "inventory_balance_company_id_company_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("company_id");--> statement-breakpoint
ALTER TABLE "inventory_balance" ADD CONSTRAINT "inventory_balance_warehouse_id_warehouse_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouse"("warehouse_id");--> statement-breakpoint
ALTER TABLE "inventory_balance" ADD CONSTRAINT "inventory_balance_article_id_article_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "article"("article_id");--> statement-breakpoint
ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_company_id_company_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("company_id");--> statement-breakpoint
ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_warehouse_id_warehouse_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouse"("warehouse_id");--> statement-breakpoint
ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_article_id_article_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "article"("article_id");--> statement-breakpoint
ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_source_document_id_document_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "document"("document_id");--> statement-breakpoint
ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_jnnVULNjQ3TP_fkey" FOREIGN KEY ("source_document_line_id") REFERENCES "document_line"("document_line_id");--> statement-breakpoint
ALTER TABLE "journal_entry" ADD CONSTRAINT "journal_entry_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "journal_entry" ADD CONSTRAINT "journal_entry_company_id_company_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("company_id");--> statement-breakpoint
ALTER TABLE "journal_entry" ADD CONSTRAINT "journal_entry_source_document_id_document_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "document"("document_id");--> statement-breakpoint
ALTER TABLE "journal_line" ADD CONSTRAINT "journal_line_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "journal_line" ADD CONSTRAINT "journal_line_company_id_company_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("company_id");--> statement-breakpoint
ALTER TABLE "journal_line" ADD CONSTRAINT "journal_line_QVXgVFk95qzz_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entry"("journal_entry_id");--> statement-breakpoint
ALTER TABLE "journal_line" ADD CONSTRAINT "journal_line_gl_account_id_gl_account_gl_account_id_fkey" FOREIGN KEY ("gl_account_id") REFERENCES "gl_account"("gl_account_id");--> statement-breakpoint
ALTER TABLE "number_sequence" ADD CONSTRAINT "number_sequence_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "number_sequence" ADD CONSTRAINT "number_sequence_company_id_company_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("company_id");--> statement-breakpoint
ALTER TABLE "payment_term" ADD CONSTRAINT "payment_term_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "price_list" ADD CONSTRAINT "price_list_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "price_list_item" ADD CONSTRAINT "price_list_item_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "price_list_item" ADD CONSTRAINT "price_list_item_price_list_id_price_list_price_list_id_fkey" FOREIGN KEY ("price_list_id") REFERENCES "price_list"("price_list_id");--> statement-breakpoint
ALTER TABLE "price_list_item" ADD CONSTRAINT "price_list_item_article_id_article_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "article"("article_id");--> statement-breakpoint
ALTER TABLE "production_order" ADD CONSTRAINT "production_order_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "production_order" ADD CONSTRAINT "production_order_company_id_company_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("company_id");--> statement-breakpoint
ALTER TABLE "production_order" ADD CONSTRAINT "production_order_article_id_article_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "article"("article_id");--> statement-breakpoint
ALTER TABLE "serial_number" ADD CONSTRAINT "serial_number_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "serial_number" ADD CONSTRAINT "serial_number_article_id_article_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "article"("article_id");--> statement-breakpoint
ALTER TABLE "serial_number" ADD CONSTRAINT "serial_number_CJHmzR9l2H7j_fkey" FOREIGN KEY ("created_movement_id") REFERENCES "inventory_movement"("inventory_movement_id");--> statement-breakpoint
ALTER TABLE "serial_number" ADD CONSTRAINT "serial_number_HxipihGhSGcb_fkey" FOREIGN KEY ("consumed_movement_id") REFERENCES "inventory_movement"("inventory_movement_id");--> statement-breakpoint
ALTER TABLE "shipping_method" ADD CONSTRAINT "shipping_method_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "tax_class" ADD CONSTRAINT "tax_class_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "tax_code" ADD CONSTRAINT "tax_code_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "tax_rule" ADD CONSTRAINT "tax_rule_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "tax_rule" ADD CONSTRAINT "tax_rule_customer_tax_class_id_tax_class_tax_class_id_fkey" FOREIGN KEY ("customer_tax_class_id") REFERENCES "tax_class"("tax_class_id");--> statement-breakpoint
ALTER TABLE "tax_rule" ADD CONSTRAINT "tax_rule_article_tax_class_id_tax_class_tax_class_id_fkey" FOREIGN KEY ("article_tax_class_id") REFERENCES "tax_class"("tax_class_id");--> statement-breakpoint
ALTER TABLE "tax_rule" ADD CONSTRAINT "tax_rule_tax_code_id_tax_code_tax_code_id_fkey" FOREIGN KEY ("tax_code_id") REFERENCES "tax_code"("tax_code_id");--> statement-breakpoint
ALTER TABLE "tenant" ADD CONSTRAINT "tenant_organization_id_organization_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("organization_id");--> statement-breakpoint
ALTER TABLE "tenant_connector" ADD CONSTRAINT "tenant_connector_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "tenant_connector" ADD CONSTRAINT "tenant_connector_TkgcWwiSJ3vq_fkey" FOREIGN KEY ("connector_id") REFERENCES "connector_definition"("connector_id");--> statement-breakpoint
ALTER TABLE "tenant_connector_mapping" ADD CONSTRAINT "tenant_connector_mapping_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "tenant_connector_mapping" ADD CONSTRAINT "tenant_connector_mapping_Py766Lfc0XlU_fkey" FOREIGN KEY ("tenant_connector_id") REFERENCES "tenant_connector"("tenant_connector_id");--> statement-breakpoint
ALTER TABLE "tenant_fields" ADD CONSTRAINT "tenant_fields_organization_id_organization_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("organization_id");--> statement-breakpoint
ALTER TABLE "tenant_fields" ADD CONSTRAINT "tenant_fields_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "tenant_groups" ADD CONSTRAINT "tenant_groups_organization_id_organization_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("organization_id");--> statement-breakpoint
ALTER TABLE "tenant_groups" ADD CONSTRAINT "tenant_groups_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "tenant_layouts" ADD CONSTRAINT "tenant_layouts_dnOBHdr5nxNC_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("organization_id");--> statement-breakpoint
ALTER TABLE "tenant_layouts" ADD CONSTRAINT "tenant_layouts_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "tenant_rules" ADD CONSTRAINT "tenant_rules_organization_id_organization_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("organization_id");--> statement-breakpoint
ALTER TABLE "tenant_rules" ADD CONSTRAINT "tenant_rules_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "unit" ADD CONSTRAINT "unit_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "warehouse" ADD CONSTRAINT "warehouse_tenant_id_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("tenant_id");--> statement-breakpoint
ALTER TABLE "warehouse" ADD CONSTRAINT "warehouse_company_id_company_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("company_id");