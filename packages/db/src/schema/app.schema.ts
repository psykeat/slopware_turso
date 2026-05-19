import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  numeric,
  date,
  char,
  unique,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";

import { user } from "./auth.schema";

// Core Infrastructure

export const organization = pgTable(
  "organization",
  {
    organizationId: uuid("organization_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    slug: varchar("slug", { length: 63 }).notNull().unique(),
    name: text("name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("organization_slug_key").on(table.slug)],
);

export const tenant = pgTable(
  "tenant",
  {
    tenantId: uuid("tenant_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.organizationId),
    slug: varchar("slug", { length: 63 }).notNull().unique(),
    name: text("name").notNull(),
    isBase: boolean("is_base").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_tenant_organization").on(table.organizationId),
    index("tenant_slug_key").on(table.slug),
    uniqueIndex("uq_single_base_tenant")
      .on(table.isBase)
      .where(sql`is_base = true`),
  ],
);

export const company = pgTable(
  "company",
  {
    companyId: uuid("company_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    companyNo: text("company_no").notNull(),
    name: text("name").notNull(),
    legalName: text("legal_name"),
    countryCode: char("country_code", { length: 2 }).notNull(),
    currencyId: char("currency_id", { length: 3 }).notNull(),
    vatId: text("vat_id"),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    addressLine1: text("address_line_1"),
    addressLine2: text("address_line_2"),
    city: text("city"),
    postalCode: text("postal_code"),
    phoneLandline: text("phone_landline"),
    phoneMobile: text("phone_mobile"),
    email: text("email"),
    homepage: text("homepage"),
    taxNumber: text("tax_number"),
    taxAuthority: text("tax_authority"),
    gln: text("gln"),
    eoriNo: text("eori_no"),
    dunsNo: text("duns_no"),
    customAttributes: jsonb("custom_attributes"),
    bankName: text("bank_name"),
    bankBic: text("bank_bic"),
    bankIban: text("bank_iban"),
    fiscalYearStartMonth: integer("fiscal_year_start_month").notNull().default(1),
    defaultWarehouseId: uuid("default_warehouse_id"),
  },
  (table) => [
    unique("company_tenant_id_company_id_key").on(table.tenantId, table.companyId),
    unique("company_tenant_id_company_no_unique").on(table.tenantId, table.companyNo),
    index("idx_company_tenant").on(table.tenantId),
    index("idx_company_tenant_archived").on(table.tenantId, table.archived),
    check(
      "company_fiscal_year_start_month_check",
      sql`fiscal_year_start_month >= 1 AND fiscal_year_start_month <= 12`,
    ),
  ],
);

export const userTenant = pgTable(
  "user_tenant",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    role: text("role").notNull(),
  },
  (table) => [
    unique("user_tenant_tenant_id_user_id_unique").on(table.tenantId, table.userId),
    index("idx_user_tenant_tenant").on(table.tenantId),
    index("idx_user_tenant_user").on(table.userId),
  ],
);

export const modules = pgTable(
  "modules",
  {
    moduleId: uuid("module_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    slug: text("slug").notNull().unique(),
    label: jsonb("label").notNull(),
  },
  (table) => [index("modules_slug_key").on(table.slug)],
);

export const connectorDefinition = pgTable(
  "connector_definition",
  {
    connectorId: uuid("connector_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    slug: text("slug").notNull().unique(),
    label: jsonb("label").notNull(),
    defaultMappings: jsonb("default_mappings").notNull().default({}),
    lockedFields: jsonb("locked_fields").notNull().default([]),
    atomicityMode: text("atomicity_mode").notNull(),
  },
  (table) => [
    index("connector_definition_slug_key").on(table.slug),
    check(
      "connector_definition_atomicity_mode_check",
      sql`atomicity_mode IN ('file', 'entity', 'run')`,
    ),
  ],
);

export const systemSettings = pgTable(
  "system_settings",
  {
    settingId: uuid("setting_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    scope: text("scope").notNull(),
    organizationId: uuid("organization_id"),
    tenantId: uuid("tenant_id"),
    key: text("key").notNull(),
    value: jsonb("value").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    unique("uq_settings_global").on(table.key),
    unique("uq_settings_org").on(table.organizationId, table.key),
    unique("uq_settings_tenant").on(table.tenantId, table.key),
  ],
);

export const accountDeterminationRule = pgTable(
  "account_determination_rule",
  {
    ruleId: uuid("rule_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    companyId: uuid("company_id").references(() => company.companyId),
    articleGroupId: uuid("article_group_id"),
    taxCodeId: uuid("tax_code_id"),
    postingContext: text("posting_context").notNull(),
    glAccountId: uuid("gl_account_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_acct_det_lookup").on(
      table.tenantId,
      table.postingContext,
      table.articleGroupId,
      table.taxCodeId,
    ),
    index("idx_acct_det_tenant").on(table.tenantId),
  ],
);

export const addressCategory = pgTable(
  "address_category",
  {
    categoryId: uuid("category_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    name: jsonb("name").notNull(),
    taxClassId: uuid("tax_class_id").references(() => taxClass.taxClassId),
    paymentTermId: uuid("payment_term_id").references(() => paymentTerm.paymentTermId),
    currencyId: char("currency_id", { length: 3 }),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    customAttributes: jsonb("custom_attributes"),
  },
  (table) => [
    unique("address_category_tenant_id_category_id_key").on(table.tenantId, table.categoryId),
    unique("address_category_tenant_id_name_unique").on(table.tenantId, table.name),
    index("idx_address_category_tenant").on(table.tenantId),
  ],
);

export const address = pgTable(
  "address",
  {
    addressId: uuid("address_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    addressNo: text("address_no").notNull(),
    isCustomer: boolean("is_customer").notNull().default(false),
    isSupplier: boolean("is_supplier").notNull().default(false),
    companyName: text("company_name"),
    firstName: text("first_name"),
    lastName: text("last_name"),
    addressLine1: text("address_line_1").notNull(),
    addressLine2: text("address_line_2"),
    postalCode: text("postal_code").notNull(),
    city: text("city").notNull(),
    stateProvince: text("state_province"),
    countryCode: char("country_code", { length: 2 }).notNull(),
    vatId: text("vat_id"),
    taxClassId: uuid("tax_class_id"),
    currencyId: char("currency_id", { length: 3 }),
    paymentTermId: uuid("payment_term_id"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    customAttributes: jsonb("custom_attributes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
    defaultDeliveryAddressId: uuid("default_delivery_address_id"),
    searchText: text("search_text"),
    addressCategoryId: uuid("address_category_id").references(() => addressCategory.categoryId),
  },
  (table) => [
    unique("address_tenant_id_address_id_key").on(table.tenantId, table.addressId),
    unique("address_tenant_id_address_no_unique").on(table.tenantId, table.addressNo),
    index("idx_address_category").on(table.tenantId, table.addressCategoryId),
    index("idx_address_customer").on(table.tenantId, table.isCustomer),
    index("idx_address_supplier").on(table.tenantId, table.isSupplier),
    index("idx_address_tenant").on(table.tenantId),
  ],
);

export const addressContact = pgTable(
  "address_contact",
  {
    contactId: uuid("contact_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    addressId: uuid("address_id")
      .notNull()
      .references(() => address.addressId),
    firstName: text("first_name"),
    lastName: text("last_name").notNull(),
    email: text("email"),
    phoneMobile: text("phone_mobile"),
    phoneLandline: text("phone_landline"),
    roleFunction: text("role_function"),
    isPrimary: boolean("is_primary").notNull().default(false),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_address_contact_address").on(table.addressId),
    index("idx_address_contact_tenant").on(table.tenantId),
  ],
);

export const addressSeq = pgTable(
  "address_seq",
  {
    tenantId: uuid("tenant_id")
      .primaryKey()
      .references(() => tenant.tenantId),
    nextVal: integer("next_val").notNull().default(1),
  },
  (table) => [index("idx_address_seq_tenant").on(table.tenantId)],
);

export const articleGroup = pgTable(
  "article_group",
  {
    articleGroupId: uuid("article_group_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    code: text("code").notNull(),
    name: text("name").notNull(),
    taxClassId: uuid("tax_class_id").references(() => taxClass.taxClassId),
    baseUnitId: uuid("base_unit_id").references(() => unit.unitId),
    salesUnitId: uuid("sales_unit_id").references(() => unit.unitId),
    purchaseUnitId: uuid("purchase_unit_id").references(() => unit.unitId),
    trackingMode: text("tracking_mode"),
    bomType: text("bom_type").notNull().default("none"),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("article_group_tenant_id_article_group_id_key").on(table.tenantId, table.articleGroupId),
    unique("article_group_tenant_id_code_unique").on(table.tenantId, table.code),
    index("idx_article_group_tenant").on(table.tenantId),
  ],
);

export const article = pgTable(
  "article",
  {
    articleId: uuid("article_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    articleNo: text("article_no").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    articleGroupId: uuid("article_group_id").references(() => articleGroup.articleGroupId),
    taxClassId: uuid("tax_class_id").references(() => taxClass.taxClassId),
    baseUnitId: uuid("base_unit_id").references(() => unit.unitId),
    salesUnitId: uuid("sales_unit_id").references(() => unit.unitId),
    purchaseUnitId: uuid("purchase_unit_id").references(() => unit.unitId),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    customAttributes: jsonb("custom_attributes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
    defaultWarehouseId: uuid("default_warehouse_id"),
    trackingMode: text("tracking_mode"),
    bomType: text("bom_type").notNull().default("none"),
  },
  (table) => [
    unique("article_tenant_id_article_id_key").on(table.tenantId, table.articleId),
    unique("article_tenant_id_article_no_unique").on(table.tenantId, table.articleNo),
    index("idx_article_default_wh").on(table.tenantId, table.defaultWarehouseId),
    index("idx_article_group_fk").on(table.articleGroupId),
    index("idx_article_tenant").on(table.tenantId),
    index("idx_article_tenant_archived").on(table.tenantId, table.archivedAt),
    check("article_bom_type_check", sql`bom_type IN ('none', 'production', 'sales')`),
    check(
      "article_tracking_mode_check",
      sql`tracking_mode IN ('serial', 'batch') OR tracking_mode IS NULL`,
    ),
  ],
);

export const articleBom = pgTable(
  "article_bom",
  {
    bomId: uuid("bom_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    headerArticleId: uuid("header_article_id")
      .notNull()
      .references(() => article.articleId),
    componentArticleId: uuid("component_article_id")
      .notNull()
      .references(() => article.articleId),
    quantity: numeric("quantity").notNull(),
    scrapPercentage: numeric("scrap_percentage").notNull().default("0"),
    sortOrder: integer("sort_order").notNull().default(0),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("article_bom_tenant_id_header_article_id_component_article_id_un").on(
      table.tenantId,
      table.headerArticleId,
      table.componentArticleId,
    ),
    check("article_bom_quantity_check", sql`quantity > 0`),
  ],
);

export const bankAccount = pgTable(
  "bank_account",
  {
    bankAccountId: uuid("bank_account_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    addressId: uuid("address_id").references(() => address.addressId),
    iban: text("iban").notNull(),
    bic: text("bic"),
    bankName: text("bank_name"),
    currencyId: char("currency_id", { length: 3 }),
    isDefault: boolean("is_default").notNull().default(false),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    customAttributes: jsonb("custom_attributes"),
  },
  (table) => [
    unique("bank_account_tenant_id_iban_unique").on(table.tenantId, table.iban),
    index("idx_bank_account_address").on(table.addressId),
    index("idx_bank_account_tenant").on(table.tenantId),
  ],
);

export const costCenter = pgTable(
  "cost_center",
  {
    costCenterId: uuid("cost_center_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    companyId: uuid("company_id").references(() => company.companyId),
    code: text("code").notNull(),
    name: text("name").notNull(),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("cost_center_tenant_id_code_unique").on(table.tenantId, table.code),
    unique("cost_center_tenant_id_cost_center_id_key").on(table.tenantId, table.costCenterId),
    index("idx_cost_center_tenant").on(table.tenantId),
  ],
);

export const country = pgTable(
  "country",
  {
    countryId: uuid("country_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    iso2Code: varchar("iso2_code", { length: 2 }).notNull().unique(),
    iso3Code: varchar("iso3_code", { length: 3 }).notNull().unique(),
    name: jsonb("name").notNull(),
    isEu: boolean("is_eu").notNull().default(false),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("country_iso2_code_key").on(table.iso2Code),
    index("country_iso3_code_key").on(table.iso3Code),
  ],
);

export const currency = pgTable(
  "currency",
  {
    currencyId: uuid("currency_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    code: varchar("code", { length: 3 }).notNull().unique(),
    name: jsonb("name").notNull(),
    symbol: varchar("symbol", { length: 5 }),
    decimals: integer("decimals").notNull().default(2),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("currency_code_key").on(table.code)],
);

export const deliveryAddress = pgTable(
  "delivery_address",
  {
    deliveryAddressId: uuid("delivery_address_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    addressId: uuid("address_id")
      .notNull()
      .references(() => address.addressId),
    name: text("name"),
    addressLine1: text("address_line_1").notNull(),
    addressLine2: text("address_line_2"),
    postalCode: text("postal_code").notNull(),
    city: text("city").notNull(),
    countryCode: char("country_code", { length: 2 }).notNull(),
    defaultForShipping: boolean("default_for_shipping").default(false),
    archived: boolean("archived").notNull().default(false),
    customAttributes: jsonb("custom_attributes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_delivery_address_partner").on(table.addressId),
    index("idx_delivery_address_tenant").on(table.tenantId),
  ],
);

export const discountGroup = pgTable(
  "discount_group",
  {
    discountGroupId: uuid("discount_group_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    name: text("name").notNull(),
    percentage: numeric("percentage").notNull(),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("discount_group_tenant_id_name_unique").on(table.tenantId, table.name),
    index("idx_discount_group_tenant").on(table.tenantId),
  ],
);

export const documentType = pgTable(
  "document_type",
  {
    documentTypeId: uuid("document_type_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    code: varchar("code", { length: 20 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    movementType: char("movement_type", { length: 1 }).notNull(),
    nextDocumentTypeId: uuid("next_document_type_id"),
    requiresWarehouse: boolean("requires_warehouse").notNull().default(true),
    requiresCostCenter: boolean("requires_cost_center").notNull().default(false),
    archived: boolean("archived").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("document_type_tenant_id_code_unique").on(table.tenantId, table.code),
    unique("document_type_tenant_id_document_type_id_key").on(table.tenantId, table.documentTypeId),
    index("idx_document_type_tenant").on(table.tenantId),
    check(
      "document_type_movement_type_check",
      sql`movement_type IN ('N', 'A', 'L', 'R', 'G', 'b', 'l', 'r', 'g', 'Z', 'E', 'V', 'q', 'p', 'U')`,
    ),
  ],
);

export const documentGroup = pgTable(
  "document_group",
  {
    documentGroupId: uuid("document_group_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    numberSequenceId: uuid("number_sequence_id"),
    description: text("description"),
    defaultWarehouseId: uuid("default_warehouse_id"),
    defaultTaxCodeId: uuid("default_tax_code_id"),
    defaultSalesAccountId: uuid("default_sales_account_id"),
    defaultCostAccountId: uuid("default_cost_account_id"),
    archived: boolean("archived").notNull().default(false),
    sortOrder: integer("sort_order").default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
    defaultPaymentTermId: uuid("default_payment_term_id"),
    defaultShippingMethodId: uuid("default_shipping_method_id"),
    requireSerialTracking: boolean("require_serial_tracking").notNull().default(true),
    requireBatchTracking: boolean("require_batch_tracking").notNull().default(true),
    documentType: varchar("document_type", { length: 1 }).notNull(),
    groupNumber: integer("group_number").notNull(),
    direction: varchar("direction", { length: 20 }),
    nextGroupId: uuid("next_group_id"),
    companyId: uuid("company_id").references(() => company.companyId),
  },
  (table) => [
    unique("document_group_tenant_id_document_group_id_key").on(
      table.tenantId,
      table.documentGroupId,
    ),
    unique("document_group_tenant_id_document_type_group_number_unique").on(
      table.tenantId,
      table.documentType,
      table.groupNumber,
    ),
    index("idx_document_group_company").on(table.companyId),
    index("idx_document_group_tenant").on(table.tenantId),
    check("document_group_group_number_check", sql`group_number >= 0 AND group_number <= 99`),
  ],
);

export const document = pgTable(
  "document",
  {
    documentId: uuid("document_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    companyId: uuid("company_id")
      .notNull()
      .references(() => company.companyId),
    documentType: char("document_type", { length: 1 }).notNull(),
    documentDirection: text("document_direction").notNull(),
    documentNo: text("document_no").notNull(),
    status: text("status").notNull(),
    customerId: uuid("customer_id").references(() => address.addressId),
    currencyId: char("currency_id", { length: 3 }),
    documentDate: date("document_date").notNull(),
    postingDate: date("posting_date"),
    totalNet: numeric("total_net"),
    totalTax: numeric("total_tax"),
    totalGross: numeric("total_gross"),
    versionNo: integer("version_no").notNull().default(1),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    postedBy: text("posted_by"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    stornoDocumentId: uuid("storno_document_id"),
    customAttributes: jsonb("custom_attributes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
    transactionId: uuid("transaction_id").notNull(),
    parentDocumentId: uuid("parent_document_id"),
    documentGroupId: uuid("document_group_id").references(() => documentGroup.documentGroupId),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    billingAddress: jsonb("billing_address"),
    deliveryAddress: jsonb("delivery_address"),
    deliveryAddressId: uuid("delivery_address_id").references(
      () => deliveryAddress.deliveryAddressId,
    ),
    paymentTermId: uuid("payment_term_id"),
    shippingMethodId: uuid("shipping_method_id"),
    documentTypeId: uuid("document_type_id").references(() => documentType.documentTypeId),
    warehouseId: uuid("warehouse_id"),
    targetWarehouseId: uuid("target_warehouse_id"),
    isPaid: boolean("is_paid").notNull().default(false),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    paidAmount: numeric("paid_amount"),
  },
  (table) => [
    unique("document_tenant_id_company_id_document_no_unique").on(
      table.tenantId,
      table.companyId,
      table.documentNo,
    ),
    unique("document_tenant_id_document_id_key").on(table.tenantId, table.documentId),
    index("idx_document_company").on(table.tenantId, table.companyId),
    index("idx_document_customer").on(table.tenantId, table.customerId),
    index("idx_document_delivery_address").on(table.tenantId, table.deliveryAddressId),
    index("idx_document_group").on(table.documentGroupId),
    index("idx_document_group_type").on(table.documentGroupId, table.documentTypeId),
    index("idx_document_parent").on(table.parentDocumentId),
    index("idx_document_payment_term").on(table.paymentTermId),
    index("idx_document_posted_at").on(table.tenantId, table.postedAt),
    index("idx_document_shipping_method").on(table.shippingMethodId),
    index("idx_document_tenant").on(table.tenantId),
    index("idx_document_transaction").on(table.tenantId, table.transactionId),
    index("idx_document_type_status").on(table.tenantId, table.documentType, table.status),
    index("idx_document_warehouse").on(table.warehouseId),
    check(
      "chk_document_type",
      sql`document_type IN ('N', 'A', 'L', 'R', 'G', 'b', 'l', 'r', 'g', 'Z', 'E', 'V', 'q', 'p', 'U')`,
    ),
  ],
);

export const documentLine = pgTable(
  "document_line",
  {
    documentLineId: uuid("document_line_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    documentId: uuid("document_id")
      .notNull()
      .references(() => document.documentId),
    lineNo: integer("line_no").notNull(),
    articleId: uuid("article_id").references(() => article.articleId),
    articleTextSnapshot: text("article_text_snapshot"),
    quantity: numeric("quantity").notNull(),
    unit: text("unit"),
    netPrice: numeric("net_price").notNull(),
    discountPercentage: numeric("discount_percentage"),
    taxCodeId: uuid("tax_code_id"),
    taxAmount: numeric("tax_amount"),
    lineTotalNet: numeric("line_total_net"),
    warehouseId: uuid("warehouse_id"),
    costCenterId: uuid("cost_center_id").references(() => costCenter.costCenterId),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    transactionId: uuid("transaction_id"),
    movementType: char("movement_type", { length: 1 }),
    lineType: varchar("line_type", { length: 20 }).notNull().default("article"),
    bomGroupId: uuid("bom_group_id"),
  },
  (table) => [
    unique("document_line_tenant_id_document_id_line_no_unique").on(
      table.tenantId,
      table.documentId,
      table.lineNo,
    ),
    unique("document_line_tenant_id_document_line_id_key").on(table.tenantId, table.documentLineId),
    index("idx_document_line_article").on(table.articleId),
    index("idx_document_line_document").on(table.documentId),
    index("idx_document_line_tenant").on(table.tenantId),
    index("idx_document_line_tx").on(table.tenantId, table.transactionId),
    check(
      "chk_article_line_requires_article_id",
      sql`line_type = 'comment' OR article_id IS NOT NULL`,
    ),
    check(
      "chk_document_line_movement_type",
      sql`movement_type IN ('N', 'A', 'L', 'R', 'G', 'b', 'l', 'r', 'g', 'Z', 'E', 'V', 'q', 'p', 'U') OR movement_type IS NULL`,
    ),
    check(
      "document_line_line_type_check",
      sql`line_type IN ('article', 'comment', 'production_output', 'sales_bom_header', 'bom_component')`,
    ),
  ],
);

export const documentLineAllocation = pgTable(
  "document_line_allocation",
  {
    allocationId: uuid("allocation_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    sourceDocumentLineId: uuid("source_document_line_id")
      .notNull()
      .references(() => documentLine.documentLineId),
    targetDocumentLineId: uuid("target_document_line_id")
      .notNull()
      .references(() => documentLine.documentLineId),
    allocatedQty: numeric("allocated_qty").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("document_line_allocation_source_target_unique").on(
      table.sourceDocumentLineId,
      table.targetDocumentLineId,
    ),
    index("idx_dla_source").on(table.tenantId, table.sourceDocumentLineId),
    index("idx_dla_target").on(table.tenantId, table.targetDocumentLineId),
  ],
);

export const documentLineTracking = pgTable(
  "document_line_tracking",
  {
    trackingId: uuid("tracking_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    documentLineId: uuid("document_line_id")
      .notNull()
      .references(() => documentLine.documentLineId),
    serialNumberId: uuid("serial_number_id"),
    serialNo: text("serial_no"),
    batchNo: text("batch_no"),
    qty: numeric("qty").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (_table) => [
    check(
      "document_line_tracking_check",
      sql`
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
      `,
    ),
  ],
);

export const entityCommands = pgTable(
  "entity_commands",
  {
    commandId: uuid("command_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    scope: text("scope").notNull().default("global"),
    organizationId: uuid("organization_id").references(() => organization.organizationId),
    tenantId: uuid("tenant_id").references(() => tenant.tenantId),
    entityName: text("entity_name").notNull(),
    commandKey: text("command_key").notNull(),
    handlerkey: text("handlerkey"),
    label: jsonb("label").notNull(),
    description: jsonb("description"),
    httpMethod: text("http_method").notNull().default("POST"),
    routePattern: text("route_pattern").notNull(),
    entityIdParam: text("entity_id_param"),
    parentEntity: text("parent_entity"),
    parentIdSource: text("parent_id_source"),
    inputSchema: jsonb("input_schema").notNull().default({}),
    serverManaged: jsonb("server_managed").notNull().default([]),
    uiPlacement: text("ui_placement"),
    uiIcon: text("ui_icon"),
    uiShortcut: text("ui_shortcut"),
    uiConfirm: jsonb("ui_confirm"),
    writesTables: jsonb("writes_tables").notNull().default([]),
    sideEffects: jsonb("side_effects").notNull().default([]),
    minRole: text("min_role").notNull().default("tenant_user"),
    visibility: text("visibility").notNull().default("tenant"),
    commandState: text("command_state").notNull().default("published"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("entity_commands_scope_organization_id_tenant_id_entity_name_com").on(
      table.scope,
      table.organizationId,
      table.tenantId,
      table.entityName,
      table.commandKey,
    ),
    index("idx_entity_commands_entity").on(table.entityName, table.commandState),
    index("idx_entity_commands_org").on(table.organizationId),
    index("idx_entity_commands_tenant").on(table.tenantId),
  ],
);

export const factSalesEvent = pgTable(
  "fact_sales_event",
  {
    factSalesEventId: uuid("fact_sales_event_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    companyId: uuid("company_id").references(() => company.companyId),
    sourceDocumentId: uuid("source_document_id").references(() => document.documentId),
    sourceDocumentLineId: uuid("source_document_line_id").references(
      () => documentLine.documentLineId,
    ),
    customerId: uuid("customer_id").references(() => address.addressId),
    articleId: uuid("article_id").references(() => article.articleId),
    eventType: text("event_type"),
    quantityDelta: numeric("quantity_delta").notNull(),
    amountNetDelta: numeric("amount_net_delta").notNull(),
    bookingPeriod: date("booking_period").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    transactionId: uuid("transaction_id"),
    cogsDelta: numeric("cogs_delta"),
    fiscalPeriodId: uuid("fiscal_period_id"),
  },
  (table) => [
    index("idx_fact_sales_article").on(table.tenantId, table.articleId),
    index("idx_fact_sales_customer").on(table.tenantId, table.customerId),
    index("idx_fact_sales_period").on(table.tenantId, table.bookingPeriod),
    index("idx_fact_sales_tenant").on(table.tenantId),
    index("idx_fact_sales_tx").on(table.tenantId, table.transactionId),
  ],
);

export const glAccount = pgTable(
  "gl_account",
  {
    glAccountId: uuid("gl_account_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    companyId: uuid("company_id").references(() => company.companyId),
    accountNo: text("account_no").notNull(),
    name: text("name").notNull(),
    accountType: text("account_type").notNull(),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("gl_account_tenant_id_account_no_unique").on(table.tenantId, table.accountNo),
    unique("gl_account_tenant_id_gl_account_id_key").on(table.tenantId, table.glAccountId),
    index("idx_gl_account_tenant").on(table.tenantId),
  ],
);

export const helperTableRegistry = pgTable("helper_table_registry", {
  id: uuid("id")
    .primaryKey()
    .default(sql`uuidv7()`),
  tableName: text("table_name").notNull().unique(),
  label: jsonb("label").notNull(),
  pkColumn: text("pk_column").notNull(),
  displayColumn: text("display_column").notNull(),
  displayIsI18n: boolean("display_is_i18n").notNull().default(false),
  codeColumn: text("code_column"),
  isTenantScoped: boolean("is_tenant_scoped").notNull().default(false),
  defaultFilter: jsonb("default_filter"),
  sortColumn: text("sort_column").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  valueColumn: text("value_column"),
  group: text("group"),
  category: text("category"),
});

export const importBatch = pgTable(
  "import_batch",
  {
    batchId: uuid("batch_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    connectorId: uuid("connector_id"),
    profileId: uuid("profile_id").references(() => importProfile.profileId),
    mappingVersionId: uuid("mapping_version_id").references(
      () => importProfileMappingVersion.versionId,
    ),
    atomicityMode: text("atomicity_mode").notNull(),
    status: text("status").notNull().default("pending"),
    isRerun: boolean("is_rerun").notNull().default(false),
    sourceBatchId: uuid("source_batch_id"),
    postedEntityCount: integer("posted_entity_count").notNull().default(0),
    errorSummary: jsonb("error_summary"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    targetEntity: text("target_entity"),
    targetCommandKey: text("target_command_key"),
  },
  (_table) => [
    check("import_batch_atomicity_mode_check", sql`atomicity_mode IN ('file', 'entity', 'run')`),
    check(
      "import_batch_status_check",
      sql`status IN ('pending', 'validating', 'approved', 'posted', 'failed', 'rejected')`,
    ),
  ],
);

export const importRow = pgTable(
  "import_row",
  {
    rowId: uuid("row_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => importBatch.batchId),
    targetEntity: text("target_entity").notNull(),
    payload: jsonb("payload").notNull(),
    status: text("status").notNull().default("pending"),
    errorDetail: jsonb("error_detail"),
    postedAt: timestamp("posted_at", { withTimezone: true }),
  },
  (_table) => [check("import_row_status_check", sql`status IN ('pending', 'posted', 'failed')`)],
);

export const importProfile = pgTable(
  "import_profile",
  {
    profileId: uuid("profile_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    slug: text("slug").notNull(),
    label: text("label").notNull(),
    targetEntity: text("target_entity").notNull(),
    targetCommandKey: text("target_command_key").notNull(),
    requiresApproval: boolean("requires_approval").notNull().default(true),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    unique("uq_import_profile_tenant_slug").on(table.tenantId, table.slug),
    index("idx_import_profile_tenant").on(table.tenantId),
  ],
);

export const importProfileMappingVersion = pgTable(
  "import_profile_mapping_version",
  {
    versionId: uuid("version_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    tenantConnectorId: uuid("tenant_connector_id")
      .notNull()
      .references(() => tenantConnector.tenantConnectorId),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => importProfile.profileId),
    versionNo: integer("version_no").notNull().default(1),
    mappings: jsonb("mappings").notNull(),
    isActive: boolean("is_active").notNull().default(false),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    activatedBy: text("activated_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("uq_import_profile_mapping_version").on(
      table.tenantConnectorId,
      table.profileId,
      table.versionNo,
    ),
    index("idx_import_mapping_version_lookup").on(
      table.tenantConnectorId,
      table.profileId,
      table.isActive,
    ),
  ],
);

export const incoterm = pgTable(
  "incoterm",
  {
    incotermId: uuid("incoterm_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    code: char("code", { length: 3 }).notNull().unique(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("incoterm_code_key").on(table.code)],
);

export const industry = pgTable(
  "industry",
  {
    industryId: uuid("industry_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    name: jsonb("name").notNull(),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    customAttributes: jsonb("custom_attributes"),
  },
  (table) => [
    unique("industry_tenant_id_name_unique").on(table.tenantId, table.name),
    index("idx_industry_tenant").on(table.tenantId),
  ],
);

export const warehouse = pgTable(
  "warehouse",
  {
    warehouseId: uuid("warehouse_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    companyId: uuid("company_id").references(() => company.companyId),
    code: text("code").notNull(),
    name: text("name").notNull(),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("warehouse_tenant_id_code_unique").on(table.tenantId, table.code),
    unique("warehouse_tenant_id_warehouse_id_key").on(table.tenantId, table.warehouseId),
    index("idx_warehouse_tenant").on(table.tenantId),
  ],
);

export const inventoryBalance = pgTable(
  "inventory_balance",
  {
    inventoryBalanceId: uuid("inventory_balance_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    companyId: uuid("company_id").references(() => company.companyId),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouse.warehouseId),
    articleId: uuid("article_id")
      .notNull()
      .references(() => article.articleId),
    onHandQty: numeric("on_hand_qty").notNull().default("0"),
    reservedQty: numeric("reserved_qty").notNull().default("0"),
    asOfAt: timestamp("as_of_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    availableQty: numeric("available_qty"),
    expectedPurchaseQty: numeric("expected_purchase_qty").notNull().default("0"),
    gldPurchase: numeric("gld_purchase"),
    gldCost: numeric("gld_cost"),
  },
  (table) => [
    unique("inventory_balance_tenant_id_warehouse_id_article_id_unique").on(
      table.tenantId,
      table.warehouseId,
      table.articleId,
    ),
    index("idx_inv_balance_lookup").on(table.tenantId, table.warehouseId, table.articleId),
    index("idx_inv_balance_tenant").on(table.tenantId),
  ],
);

export const inventoryMovement = pgTable(
  "inventory_movement",
  {
    inventoryMovementId: uuid("inventory_movement_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    companyId: uuid("company_id").references(() => company.companyId),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouse.warehouseId),
    articleId: uuid("article_id")
      .notNull()
      .references(() => article.articleId),
    movementType: char("movement_type", { length: 1 }).notNull(),
    qtyDelta: numeric("qty_delta"),
    movementDate: timestamp("movement_date", { withTimezone: true }).notNull(),
    sourceDocumentId: uuid("source_document_id").references(() => document.documentId),
    sourceDocumentLineId: uuid("source_document_line_id").references(
      () => documentLine.documentLineId,
    ),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    transactionId: uuid("transaction_id"),
    absoluteQty: numeric("absolute_qty"),
    referenceText: text("reference_text"),
    serialNumberId: uuid("serial_number_id"),
    batchNo: text("batch_no"),
  },
  (table) => [
    index("idx_inv_movement_date").on(table.tenantId, table.movementDate),
    index("idx_inv_movement_inventory_anchor").on(
      table.tenantId,
      table.warehouseId,
      table.articleId,
      table.movementDate,
    ),
    index("idx_inv_movement_lookup").on(
      table.tenantId,
      table.warehouseId,
      table.articleId,
      table.movementDate,
    ),
    index("idx_inv_movement_tenant").on(table.tenantId),
    index("idx_inv_movement_tx").on(table.tenantId, table.transactionId),
    index("idx_inv_movement_warehouse_article").on(
      table.tenantId,
      table.warehouseId,
      table.articleId,
    ),
    index("idx_inventory_movement_batch_balance").on(
      table.tenantId,
      table.warehouseId,
      table.articleId,
      table.batchNo,
    ),
    check(
      "chk_inventory_movement_qty_logic",
      sql`(movement_type = 'V' AND absolute_qty IS NOT NULL) OR (movement_type <> 'V' AND qty_delta IS NOT NULL AND absolute_qty IS NULL)`,
    ),
    check(
      "chk_inventory_movement_type",
      sql`movement_type IN ('N', 'A', 'L', 'R', 'G', 'b', 'l', 'r', 'g', 'Z', 'E', 'V', 'q', 'p', 'U')`,
    ),
  ],
);

export const journalEntry = pgTable(
  "journal_entry",
  {
    journalEntryId: uuid("journal_entry_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    companyId: uuid("company_id")
      .notNull()
      .references(() => company.companyId),
    postingDate: date("posting_date").notNull(),
    sourceDocumentId: uuid("source_document_id").references(() => document.documentId),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("journal_entry_tenant_id_journal_entry_id_key").on(table.tenantId, table.journalEntryId),
    index("idx_journal_entry_company").on(table.tenantId, table.companyId),
    index("idx_journal_entry_date").on(table.tenantId, table.postingDate),
    index("idx_journal_entry_document").on(table.sourceDocumentId),
    index("idx_journal_entry_tenant").on(table.tenantId),
  ],
);

export const journalLine = pgTable(
  "journal_line",
  {
    journalLineId: uuid("journal_line_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    companyId: uuid("company_id")
      .notNull()
      .references(() => company.companyId),
    journalEntryId: uuid("journal_entry_id")
      .notNull()
      .references(() => journalEntry.journalEntryId),
    glAccountId: uuid("gl_account_id")
      .notNull()
      .references(() => glAccount.glAccountId),
    debitAmount: numeric("debit_amount").notNull().default("0"),
    creditAmount: numeric("credit_amount").notNull().default("0"),
    costCenterId: uuid("cost_center_id").references(() => costCenter.costCenterId),
    taxCodeId: uuid("tax_code_id").references(() => taxCode.taxCodeId),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_journal_line_account").on(table.glAccountId),
    index("idx_journal_line_entry").on(table.journalEntryId),
    index("idx_journal_line_tenant").on(table.tenantId),
    check(
      "chk_debit_or_credit",
      sql`(debit_amount > 0 AND credit_amount = 0) OR (credit_amount > 0 AND debit_amount = 0)`,
    ),
  ],
);

export const numberSequence = pgTable(
  "number_sequence",
  {
    numberSequenceId: uuid("number_sequence_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    companyId: uuid("company_id")
      .notNull()
      .references(() => company.companyId),
    prefix: varchar("prefix", { length: 10 }).notNull(),
    nextValue: integer("next_value").notNull().default(1),
    padding: integer("padding").notNull().default(5),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    unique("number_sequence_tenant_id_company_id_prefix_unique").on(
      table.tenantId,
      table.companyId,
      table.prefix,
    ),
    unique("number_sequence_tenant_id_number_sequence_id_unique").on(
      table.tenantId,
      table.numberSequenceId,
    ),
    index("idx_number_sequence_tenant").on(table.tenantId),
    index("idx_number_sequence_tenant_company").on(table.tenantId, table.companyId),
  ],
);

export const paymentTerm = pgTable(
  "payment_term",
  {
    paymentTermId: uuid("payment_term_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    name: jsonb("name").notNull(),
    netDays: integer("net_days").notNull(),
    discountDays: integer("discount_days"),
    discountPercentage: numeric("discount_percentage"),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    customAttributes: jsonb("custom_attributes"),
  },
  (table) => [
    unique("payment_term_tenant_id_name_unique").on(table.tenantId, table.name),
    unique("payment_term_tenant_id_payment_term_id_key").on(table.tenantId, table.paymentTermId),
    index("idx_payment_term_tenant").on(table.tenantId),
  ],
);

export const postalCode = pgTable(
  "postal_code",
  {
    postalCodeId: uuid("postal_code_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    countryCode: varchar("country_code", { length: 2 }).notNull(),
    plz: text("plz").notNull(),
    city: text("city").notNull(),
    state: text("state"),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("postal_code_country_code_plz_city_state_unique").on(
      table.countryCode,
      table.plz,
      table.city,
      table.state,
    ),
    index("idx_postal_code_lookup").on(table.countryCode, table.plz),
  ],
);

export const priceList = pgTable(
  "price_list",
  {
    priceListId: uuid("price_list_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    name: text("name").notNull(),
    currencyId: char("currency_id", { length: 3 }).notNull(),
    isNet: boolean("is_net").notNull().default(true),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("price_list_tenant_id_name_unique").on(table.tenantId, table.name),
    unique("price_list_tenant_id_price_list_id_key").on(table.tenantId, table.priceListId),
    index("idx_price_list_tenant").on(table.tenantId),
  ],
);

export const priceListItem = pgTable(
  "price_list_item",
  {
    priceListItemId: uuid("price_list_item_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    priceListId: uuid("price_list_id")
      .notNull()
      .references(() => priceList.priceListId),
    articleId: uuid("article_id")
      .notNull()
      .references(() => article.articleId),
    price: numeric("price").notNull(),
    validFrom: date("valid_from"),
    validTo: date("valid_to"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("price_list_item_tenant_id_price_list_id_article_id_valid_from_u").on(
      table.tenantId,
      table.priceListId,
      table.articleId,
      table.validFrom,
    ),
    index("idx_price_list_item_lookup").on(table.priceListId, table.articleId, table.validFrom),
    index("idx_price_list_item_tenant").on(table.tenantId),
  ],
);

export const productionOrder = pgTable(
  "production_order",
  {
    productionOrderId: uuid("production_order_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    companyId: uuid("company_id").references(() => company.companyId),
    orderNo: varchar("order_no", { length: 50 }).notNull(),
    articleId: uuid("article_id").references(() => article.articleId),
    quantity: integer("quantity").notNull().default(0),
    status: varchar("status", { length: 20 }).notNull().default("planned"),
    plannedStartDate: date("planned_start_date"),
    plannedEndDate: date("planned_end_date"),
    actualStartDate: date("actual_start_date"),
    actualEndDate: date("actual_end_date"),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    unique("production_order_tenant_id_order_no_unique").on(table.tenantId, table.orderNo),
    index("idx_production_order_article").on(table.articleId),
    index("idx_production_order_status").on(table.status),
    index("idx_production_order_tenant").on(table.tenantId),
  ],
);

export const schemaAnnotations = pgTable(
  "schema_annotations",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tableName: text("table_name").notNull(),
    columnName: text("column_name").notNull().default(""),
    businessName: text("business_name").notNull(),
    description: text("description").notNull(),
    dataClass: text("data_class").notNull(),
    moduleId: uuid("module_id"),
    mandatoryFor: jsonb("mandatory_for").notNull().default([]),
    lockedFor: jsonb("locked_for").notNull().default([]),
    aiGeneratedAt: timestamp("ai_generated_at", { withTimezone: true }),
    humanOverride: boolean("human_override").notNull().default(false),
  },
  (table) => [
    unique("schema_annotations_table_name_column_name_unique").on(
      table.tableName,
      table.columnName,
    ),
  ],
);

export const serialNumber = pgTable(
  "serial_number",
  {
    serialNumberId: uuid("serial_number_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    articleId: uuid("article_id")
      .notNull()
      .references(() => article.articleId),
    serialNo: text("serial_no").notNull(),
    status: text("status").notNull().default("in_stock"),
    createdMovementId: uuid("created_movement_id").references(
      () => inventoryMovement.inventoryMovementId,
    ),
    consumedMovementId: uuid("consumed_movement_id").references(
      () => inventoryMovement.inventoryMovementId,
    ),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("serial_number_tenant_id_article_id_serial_no_unique").on(
      table.tenantId,
      table.articleId,
      table.serialNo,
    ),
    unique("serial_number_tenant_id_serial_number_id_key").on(table.tenantId, table.serialNumberId),
    check("serial_number_status_check", sql`status IN ('in_stock', 'reserved', 'sold')`),
  ],
);

export const shippingMethod = pgTable(
  "shipping_method",
  {
    shippingMethodId: uuid("shipping_method_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    name: jsonb("name").notNull(),
    trackingUrlTemplate: text("tracking_url_template"),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    customAttributes: jsonb("custom_attributes"),
  },
  (table) => [
    unique("shipping_method_tenant_id_name_unique").on(table.tenantId, table.name),
    unique("shipping_method_tenant_id_shipping_method_id_key").on(
      table.tenantId,
      table.shippingMethodId,
    ),
    index("idx_shipping_method_tenant").on(table.tenantId),
  ],
);

export const taxClass = pgTable(
  "tax_class",
  {
    taxClassId: uuid("tax_class_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    code: text("code").notNull(),
    name: jsonb("name").notNull(),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    customAttributes: jsonb("custom_attributes"),
  },
  (table) => [
    unique("tax_class_tenant_id_code_unique").on(table.tenantId, table.code),
    index("idx_tax_class_tenant").on(table.tenantId),
  ],
);

export const taxCode = pgTable(
  "tax_code",
  {
    taxCodeId: uuid("tax_code_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    code: text("code").notNull(),
    description: text("description"),
    taxRate: numeric("tax_rate").notNull(),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("tax_code_tenant_id_code_unique").on(table.tenantId, table.code),
    unique("tax_code_tenant_id_tax_code_id_key").on(table.tenantId, table.taxCodeId),
    index("idx_tax_code_tenant").on(table.tenantId),
  ],
);

export const taxRule = pgTable(
  "tax_rule",
  {
    taxRuleId: uuid("tax_rule_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    customerTaxClassId: uuid("customer_tax_class_id").references(() => taxClass.taxClassId),
    articleTaxClassId: uuid("article_tax_class_id").references(() => taxClass.taxClassId),
    countryCode: char("country_code", { length: 2 }),
    taxCodeId: uuid("tax_code_id")
      .notNull()
      .references(() => taxCode.taxCodeId),
    validFrom: date("valid_from").notNull(),
    validTo: date("valid_to"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_tax_rule_lookup").on(
      table.tenantId,
      table.customerTaxClassId,
      table.articleTaxClassId,
      table.countryCode,
      table.validFrom,
    ),
    index("idx_tax_rule_tenant").on(table.tenantId),
  ],
);

export const tenantConnector = pgTable(
  "tenant_connector",
  {
    tenantConnectorId: uuid("tenant_connector_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    connectorId: uuid("connector_id")
      .notNull()
      .references(() => connectorDefinition.connectorId),
    credentials: jsonb("credentials").notNull().default({}),
    isActive: boolean("is_active").notNull().default(true),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("tenant_connector_tenant_id_tenant_connector_id_key").on(
      table.tenantId,
      table.tenantConnectorId,
    ),
  ],
);

export const tenantConnectorMapping = pgTable(
  "tenant_connector_mapping",
  {
    mappingId: uuid("mapping_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    tenantConnectorId: uuid("tenant_connector_id")
      .notNull()
      .references(() => tenantConnector.tenantConnectorId),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => importProfile.profileId),
    sourceField: text("source_field").notNull(),
    targetTable: text("target_table").notNull(),
    targetColumn: text("target_column").notNull(),
    transform: jsonb("transform").notNull().default({ type: "direct" }),
    defaultValue: jsonb("default_value"),
  },
  (table) => [
    unique("uq_tenant_connector_mapping_connector_profile_field").on(
      table.tenantConnectorId,
      table.profileId,
      table.sourceField,
    ),
  ],
);

export const tenantFields = pgTable(
  "tenant_fields",
  {
    fieldId: uuid("field_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    scope: text("scope").notNull().default("tenant"),
    organizationId: uuid("organization_id").references(() => organization.organizationId),
    tenantId: uuid("tenant_id").references(() => tenant.tenantId),
    entityName: text("entity_name").notNull(),
    fieldName: text("field_name").notNull(),
    fieldType: text("field_type").notNull(),
    isRequired: boolean("is_required").notNull().default(false),
    customAttributes: jsonb("custom_attributes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    label: jsonb("label"),
    helpText: jsonb("help_text"),
    isVisible: boolean("is_visible").notNull().default(true),
    displayOrder: integer("display_order"),
    importColumn: text("import_column"),
    importType: text("import_type"),
    importRequired: boolean("import_required").notNull().default(false),
    importTransform: text("import_transform"),
    groupId: text("group_id"),
    lookupTable: text("lookup_table"),
    lookupFilter: jsonb("lookup_filter"),
  },
  (table) => [
    unique("uq_fields_global").on(table.entityName, table.fieldName),
    unique("uq_fields_org").on(table.organizationId, table.entityName, table.fieldName),
    unique("uq_fields_tenant").on(table.tenantId, table.entityName, table.fieldName),
  ],
);

export const tenantGroups = pgTable(
  "tenant_groups",
  {
    groupId: uuid("group_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    scope: text("scope").notNull().default("tenant"),
    organizationId: uuid("organization_id").references(() => organization.organizationId),
    tenantId: uuid("tenant_id").references(() => tenant.tenantId),
    entityName: text("entity_name").notNull(),
    groupKey: text("group_key").notNull(),
    label: jsonb("label").notNull(),
    displayOrder: integer("display_order").notNull().default(0),
    isVisible: boolean("is_visible").notNull().default(true),
    customAttributes: jsonb("custom_attributes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("uq_groups_global").on(table.entityName, table.groupKey),
    unique("uq_groups_org").on(table.organizationId, table.entityName, table.groupKey),
    unique("uq_groups_tenant").on(table.tenantId, table.entityName, table.groupKey),
  ],
);

export const tenantLayouts = pgTable(
  "tenant_layouts",
  {
    layoutId: uuid("layout_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    scope: text("scope").notNull().default("tenant"),
    organizationId: uuid("organization_id").references(() => organization.organizationId),
    tenantId: uuid("tenant_id").references(() => tenant.tenantId),
    entityName: text("entity_name").notNull(),
    layoutKey: text("layout_key").notNull(),
    layoutDefinition: jsonb("layout_definition").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("uq_layouts_global").on(table.entityName, table.layoutKey),
    unique("uq_layouts_org").on(table.organizationId, table.entityName, table.layoutKey),
    unique("uq_layouts_tenant").on(table.tenantId, table.entityName, table.layoutKey),
  ],
);

export const tenantRules = pgTable(
  "tenant_rules",
  {
    ruleId: uuid("rule_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    scope: text("scope").notNull().default("tenant"),
    organizationId: uuid("organization_id").references(() => organization.organizationId),
    tenantId: uuid("tenant_id").references(() => tenant.tenantId),
    entityName: text("entity_name").notNull(),
    hookName: text("hook_name").notNull(),
    ruleState: text("rule_state").notNull().default("draft"),
    ruleDefinition: jsonb("rule_definition").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    ruleSource: text("rule_source"),
  },
  (table) => [
    unique("uq_rules_global").on(table.entityName, table.hookName),
    unique("uq_rules_org").on(table.organizationId, table.entityName, table.hookName),
    unique("uq_rules_tenant").on(table.tenantId, table.entityName, table.hookName),
  ],
);

export const unit = pgTable(
  "unit",
  {
    unitId: uuid("unit_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    code: varchar("code", { length: 10 }).notNull(),
    name: jsonb("name").notNull(),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    customAttributes: jsonb("custom_attributes"),
  },
  (table) => [
    unique("unit_tenant_id_code_unique").on(table.tenantId, table.code),
    index("idx_unit_tenant").on(table.tenantId),
  ],
);

export const fiscalPeriod = pgTable(
  "fiscal_period",
  {
    fiscalPeriodId: uuid("fiscal_period_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    companyId: uuid("company_id")
      .notNull()
      .references(() => company.companyId),
    fiscalYear: integer("fiscal_year").notNull(),
    periodNo: integer("period_no").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    isClosed: boolean("is_closed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("fiscal_period_company_year_period").on(
      table.companyId,
      table.fiscalYear,
      table.periodNo,
    ),
    index("idx_fiscal_period_tenant_date").on(
      table.tenantId,
      table.companyId,
      table.startDate,
      table.endDate,
    ),
  ],
);

export const factPurchaseEvent = pgTable(
  "fact_purchase_event",
  {
    factPurchaseEventId: uuid("fact_purchase_event_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id").notNull(),
    companyId: uuid("company_id").notNull(),
    sourceDocumentId: uuid("source_document_id"),
    sourceDocumentLineId: uuid("source_document_line_id"),
    supplierId: uuid("supplier_id"),
    articleId: uuid("article_id"),
    eventType: text("event_type").notNull().default("purchase"),
    quantityDelta: numeric("quantity_delta").notNull(),
    amountNetDelta: numeric("amount_net_delta").notNull(),
    avgCostBefore: numeric("avg_cost_before"),
    avgCostAfter: numeric("avg_cost_after"),
    fiscalPeriodId: uuid("fiscal_period_id"),
    bookingPeriod: date("booking_period"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_fact_purchase_tenant_company").on(table.tenantId, table.companyId),
    index("idx_fact_purchase_supplier").on(table.tenantId, table.supplierId),
    index("idx_fact_purchase_article").on(table.tenantId, table.articleId),
    index("idx_fact_purchase_period").on(table.tenantId, table.fiscalPeriodId),
  ],
);

export const accountingExportBatch = pgTable(
  "accounting_export_batch",
  {
    batchId: uuid("batch_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    companyId: uuid("company_id")
      .notNull()
      .references(() => company.companyId),
    fiscalPeriodId: uuid("fiscal_period_id")
      .notNull()
      .references(() => fiscalPeriod.fiscalPeriodId),
    status: text("status").notNull().default("pending"),
    rowCount: integer("row_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    exportedAt: timestamp("exported_at", { withTimezone: true }),
    createdBy: uuid("created_by"),
  },
  (table) => [
    unique("accounting_export_batch_period_company").on(
      table.tenantId,
      table.fiscalPeriodId,
      table.companyId,
    ),
    index("idx_accounting_export_batch_tenant").on(table.tenantId),
    index("idx_accounting_export_batch_period").on(table.tenantId, table.fiscalPeriodId),
    check("chk_accounting_export_batch_status", sql`status IN ('pending', 'exported', 'failed')`),
  ],
);

export const accountingExportRow = pgTable(
  "accounting_export_row",
  {
    rowId: uuid("row_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => accountingExportBatch.batchId),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    companyId: uuid("company_id")
      .notNull()
      .references(() => company.companyId),
    postingDate: date("posting_date").notNull(),
    glAccountId: uuid("gl_account_id")
      .notNull()
      .references(() => glAccount.glAccountId),
    costCenterId: uuid("cost_center_id").references(() => costCenter.costCenterId),
    taxCodeId: uuid("tax_code_id").references(() => taxCode.taxCodeId),
    debitAmount: numeric("debit_amount").notNull().default("0"),
    creditAmount: numeric("credit_amount").notNull().default("0"),
    currencyId: char("currency_id", { length: 3 }),
    sourceDocumentId: uuid("source_document_id").references(() => document.documentId),
    sourceDocumentNo: text("source_document_no"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_accounting_export_row_batch").on(table.batchId),
    index("idx_accounting_export_row_tenant").on(table.tenantId),
  ],
);

export const devCycles = pgTable("dev_cycles", {
  cycleId: uuid("cycle_id")
    .primaryKey()
    .default(sql`uuidv7()`),
  cycleNumber: integer("cycle_number").notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  sliceFitScore: integer("slice_fit_score").notNull(),
  sliceFitMax: integer("slice_fit_max").notNull(),
  storyCoverage: integer("story_coverage").notNull(),
  storyCoverageMax: integer("story_coverage_max").notNull(),
  testsAdded: integer("tests_added").notNull().default(0),
  vpTestPass: boolean("vp_test_pass"),
  blocker: text("blocker"),
  processAdjustment: text("process_adjustment"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
