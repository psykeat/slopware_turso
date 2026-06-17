import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
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

export const sellerTaxRegistrationType = pgEnum("seller_tax_registration_type", [
  "domestic",
  "oss",
  "foreign_vat",
]);

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
    copyLongTextsOnlyOnChange: boolean("copy_long_texts_only_on_change").notNull().default(true),
    printAddressLongText: boolean("print_address_long_text").notNull().default(false),
    printPreText: boolean("print_pre_text").notNull().default(false),
    printPostText: boolean("print_post_text").notNull().default(false),
    printPositionTexts: boolean("print_position_texts").notNull().default(false),
    showArticleImageInEntry: boolean("show_article_image_in_entry").notNull().default(false),
    showArticleImageOnDocuments: boolean("show_article_image_on_documents")
      .notNull()
      .default(false),
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

export const sellerTaxRegistration = pgTable(
  "seller_tax_registration",
  {
    sellerTaxRegistrationId: uuid("seller_tax_registration_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    companyId: uuid("company_id").references(() => company.companyId),
    countryCode: char("country_code", { length: 2 }).notNull(),
    vatId: text("vat_id"),
    registrationType: sellerTaxRegistrationType("registration_type").notNull(),
    validFrom: date("valid_from").notNull(),
    validTo: date("valid_to"),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_seller_tax_registration_lookup").on(
      table.tenantId,
      table.companyId,
      table.countryCode,
      table.registrationType,
      table.validFrom,
    ),
    index("idx_seller_tax_registration_tenant").on(table.tenantId),
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

export const agent = pgTable(
  "agent",
  {
    agentId: uuid("agent_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    agentNo: text("agent_no").notNull(),
    name: text("name"),
    addressId: uuid("address_id"),
    userId: text("user_id").references(() => user.id),
    commissionRate: numeric("commission_rate", { precision: 5, scale: 2 }),
    active: boolean("active").notNull().default(true),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    customAttributes: jsonb("custom_attributes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    unique("uq_agent_tenant_no").on(table.tenantId, table.agentNo),
    index("idx_agent_tenant").on(table.tenantId),
    index("idx_agent_address").on(table.addressId),
    index("idx_agent_user").on(table.userId),
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
    notiztext: text("notiztext"),
    notiztextSourceEntity: text("notiztext_source_entity"),
    notiztextSourceId: uuid("notiztext_source_id"),
    notiztextSourceField: text("notiztext_source_field"),
    notiztextLinkedAt: timestamp("notiztext_linked_at", { withTimezone: true }),
    notiztextOverriddenAt: timestamp("notiztext_overridden_at", { withTimezone: true }),
    langtext: text("langtext"),
    langtextSourceEntity: text("langtext_source_entity"),
    langtextSourceId: uuid("langtext_source_id"),
    langtextSourceField: text("langtext_source_field"),
    langtextLinkedAt: timestamp("langtext_linked_at", { withTimezone: true }),
    langtextOverriddenAt: timestamp("langtext_overridden_at", { withTimezone: true }),
    warntext: text("warntext"),
    warntextSourceEntity: text("warntext_source_entity"),
    warntextSourceId: uuid("warntext_source_id"),
    warntextSourceField: text("warntext_source_field"),
    warntextLinkedAt: timestamp("warntext_linked_at", { withTimezone: true }),
    warntextOverriddenAt: timestamp("warntext_overridden_at", { withTimezone: true }),
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
    salutation: text("salutation"),
    phoneLandline: text("phone_landline"),
    phoneFax: text("phone_fax"),
    phoneMobile: text("phone_mobile"),
    email: text("email"),
    homepage: text("homepage"),
    leitwegId: text("leitweg_id"),
    peppolId: text("peppol_id"),
    coordinates: jsonb("coordinates").$type<{ lat: number; lng: number }>(),
    agentId: uuid("agent_id").references(() => agent.agentId),
    commissionRate: numeric("commission_rate", { precision: 5, scale: 2 }),
    creditRatingScore: text("credit_rating_score"),
    shopActive: boolean("shop_active").notNull().default(false),
  },
  (table) => [
    unique("address_tenant_id_address_id_key").on(table.tenantId, table.addressId),
    unique("address_tenant_id_address_no_unique").on(table.tenantId, table.addressNo),
    index("idx_address_category").on(table.tenantId, table.addressCategoryId),
    index("idx_address_customer").on(table.tenantId, table.isCustomer),
    index("idx_address_supplier").on(table.tenantId, table.isSupplier),
    index("idx_address_tenant").on(table.tenantId),
    index("idx_address_agent").on(table.tenantId, table.agentId),
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
    addressId: uuid("address_id").references(() => address.addressId),
    firstName: text("first_name"),
    lastName: text("last_name").notNull(),
    displayName: text("display_name"),
    notiztext: text("notiztext"),
    notiztextSourceEntity: text("notiztext_source_entity"),
    notiztextSourceId: uuid("notiztext_source_id"),
    notiztextSourceField: text("notiztext_source_field"),
    notiztextLinkedAt: timestamp("notiztext_linked_at", { withTimezone: true }),
    notiztextOverriddenAt: timestamp("notiztext_overridden_at", { withTimezone: true }),
    email: text("email"),
    phoneMobile: text("phone_mobile"),
    phoneLandline: text("phone_landline"),
    roleFunction: text("role_function"),
    isPrimary: boolean("is_primary").notNull().default(false),
    archived: boolean("archived").notNull().default(false),
    salutation: text("salutation"),
    phoneFax: text("phone_fax"),
    twitterHandle: text("twitter_handle"),
    youtubeUrl: text("youtube_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_address_contact_address").on(table.addressId),
    index("idx_address_contact_tenant").on(table.tenantId),
  ],
);

export const addressContactIdentity = pgTable(
  "address_contact_identity",
  {
    identityId: uuid("identity_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => addressContact.contactId),
    sourceSystem: text("source_system").notNull(),
    sourceAccountId: uuid("source_account_id"),
    sourceObjectId: text("source_object_id"),
    identityType: text("identity_type").notNull(),
    value: text("value").notNull(),
    normalizedValue: text("normalized_value").notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    isVerified: boolean("is_verified").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_address_contact_identity_tenant").on(table.tenantId),
    index("idx_address_contact_identity_contact").on(table.contactId),
    index("idx_address_contact_identity_value").on(table.value),
    index("idx_address_contact_identity_normalized").on(table.normalizedValue),
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
    printPositionTexts: boolean("print_position_texts"),
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
    notiztext: text("notiztext"),
    langtext: text("langtext"),
    kurzbeschreibung: text("kurzbeschreibung"),
    warntext: text("warntext"),
    notiztextSourceEntity: text("notiztext_source_entity"),
    notiztextSourceId: uuid("notiztext_source_id"),
    notiztextSourceField: text("notiztext_source_field"),
    notiztextLinkedAt: timestamp("notiztext_linked_at", { withTimezone: true }),
    notiztextOverriddenAt: timestamp("notiztext_overridden_at", { withTimezone: true }),
    langtextSourceEntity: text("langtext_source_entity"),
    langtextSourceId: uuid("langtext_source_id"),
    langtextSourceField: text("langtext_source_field"),
    langtextLinkedAt: timestamp("langtext_linked_at", { withTimezone: true }),
    langtextOverriddenAt: timestamp("langtext_overridden_at", { withTimezone: true }),
    kurzbeschreibungSourceEntity: text("kurzbeschreibung_source_entity"),
    kurzbeschreibungSourceId: uuid("kurzbeschreibung_source_id"),
    kurzbeschreibungSourceField: text("kurzbeschreibung_source_field"),
    kurzbeschreibungLinkedAt: timestamp("kurzbeschreibung_linked_at", { withTimezone: true }),
    kurzbeschreibungOverriddenAt: timestamp("kurzbeschreibung_overridden_at", {
      withTimezone: true,
    }),
    warntextSourceEntity: text("warntext_source_entity"),
    warntextSourceId: uuid("warntext_source_id"),
    warntextSourceField: text("warntext_source_field"),
    warntextLinkedAt: timestamp("warntext_linked_at", { withTimezone: true }),
    warntextOverriddenAt: timestamp("warntext_overridden_at", { withTimezone: true }),
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
    printPositionTexts: boolean("print_position_texts"),
    primaryImageId: uuid("primary_image_id"),
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

export const articleImage = pgTable(
  "article_image",
  {
    articleImageId: uuid("article_image_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    articleId: uuid("article_id")
      .notNull()
      .references(() => article.articleId),
    storageKey: text("storage_key").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    fileSize: integer("file_size").notNull(),
    width: integer("width"),
    height: integer("height"),
    altText: text("alt_text"),
    sortOrder: integer("sort_order").notNull().default(0),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("article_image_tenant_id_image_id_key").on(table.tenantId, table.articleImageId),
    index("idx_article_image_tenant_article").on(table.tenantId, table.articleId),
    index("idx_article_image_tenant_archived").on(table.tenantId, table.archived),
  ],
);

export const mediaAsset = pgTable(
  "media_asset",
  {
    mediaAssetId: uuid("media_asset_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    storageKey: text("storage_key").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    fileSize: integer("file_size"),
    width: integer("width"),
    height: integer("height"),
    altText: text("alt_text"),
    checksum: text("checksum"),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("media_asset_tenant_id_media_asset_id_key").on(table.tenantId, table.mediaAssetId),
    unique("media_asset_tenant_id_storage_key_unique").on(table.tenantId, table.storageKey),
    index("idx_media_asset_tenant").on(table.tenantId),
    index("idx_media_asset_tenant_archived").on(table.tenantId, table.archived),
  ],
);

export const articleMedia = pgTable(
  "article_media",
  {
    articleMediaId: uuid("article_media_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    articleId: uuid("article_id")
      .notNull()
      .references(() => article.articleId),
    variantId: uuid("variant_id").references(() => articleVariant.variantId),
    mediaAssetId: uuid("media_asset_id")
      .notNull()
      .references(() => mediaAsset.mediaAssetId),
    role: text("role").notNull().default("gallery"),
    sortOrder: integer("sort_order").notNull().default(0),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("article_media_tenant_id_article_media_id_key").on(table.tenantId, table.articleMediaId),
    unique("article_media_tenant_id_article_media_unique").on(
      table.tenantId,
      table.articleId,
      table.variantId,
      table.mediaAssetId,
      table.role,
    ),
    index("idx_article_media_tenant_article").on(table.tenantId, table.articleId),
    index("idx_article_media_tenant_variant").on(table.tenantId, table.variantId),
    index("idx_article_media_tenant_asset").on(table.tenantId, table.mediaAssetId),
  ],
);

export const category = pgTable(
  "category",
  {
    categoryId: uuid("category_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    parentCategoryId: uuid("parent_category_id"),
    code: text("code"),
    name: text("name").notNull(),
    slug: text("slug"),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    unique("category_tenant_id_category_id_key").on(table.tenantId, table.categoryId),
    unique("category_tenant_id_code_unique").on(table.tenantId, table.code),
    unique("category_tenant_id_slug_unique").on(table.tenantId, table.slug),
    index("idx_category_tenant").on(table.tenantId),
    index("idx_category_parent").on(table.tenantId, table.parentCategoryId),
    index("idx_category_tenant_archived").on(table.tenantId, table.archived),
  ],
);

export const articleCategory = pgTable(
  "article_category",
  {
    articleCategoryId: uuid("article_category_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    articleId: uuid("article_id")
      .notNull()
      .references(() => article.articleId),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => category.categoryId),
    sortOrder: integer("sort_order").notNull().default(0),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("article_category_tenant_id_article_category_id_key").on(
      table.tenantId,
      table.articleCategoryId,
    ),
    unique("article_category_tenant_id_article_category_unique").on(
      table.tenantId,
      table.articleId,
      table.categoryId,
    ),
    index("idx_article_category_tenant_article").on(table.tenantId, table.articleId),
    index("idx_article_category_tenant_category").on(table.tenantId, table.categoryId),
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
    printOptions: jsonb("print_options"),
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
    noteText: text("note_text"),
    noteTextSourceEntity: text("note_text_source_entity"),
    noteTextSourceId: uuid("note_text_source_id"),
    noteTextSourceField: text("note_text_source_field"),
    noteTextLinkedAt: timestamp("note_text_linked_at", { withTimezone: true }),
    noteTextOverriddenAt: timestamp("note_text_overridden_at", { withTimezone: true }),
    preText: text("pre_text"),
    preTextSourceEntity: text("pre_text_source_entity"),
    preTextSourceId: uuid("pre_text_source_id"),
    preTextSourceField: text("pre_text_source_field"),
    preTextLinkedAt: timestamp("pre_text_linked_at", { withTimezone: true }),
    preTextOverriddenAt: timestamp("pre_text_overridden_at", { withTimezone: true }),
    postText: text("post_text"),
    postTextSourceEntity: text("post_text_source_entity"),
    postTextSourceId: uuid("post_text_source_id"),
    postTextSourceField: text("post_text_source_field"),
    postTextLinkedAt: timestamp("post_text_linked_at", { withTimezone: true }),
    postTextOverriddenAt: timestamp("post_text_overridden_at", { withTimezone: true }),
    stornoText: text("storno_text"),
    stornoTextSourceEntity: text("storno_text_source_entity"),
    stornoTextSourceId: uuid("storno_text_source_id"),
    stornoTextSourceField: text("storno_text_source_field"),
    stornoTextLinkedAt: timestamp("storno_text_linked_at", { withTimezone: true }),
    stornoTextOverriddenAt: timestamp("storno_text_overridden_at", { withTimezone: true }),
    paymentTermId: uuid("payment_term_id"),
    shippingMethodId: uuid("shipping_method_id"),
    documentTypeId: uuid("document_type_id").references(() => documentType.documentTypeId),
    warehouseId: uuid("warehouse_id"),
    targetWarehouseId: uuid("target_warehouse_id"),
    isPaid: boolean("is_paid").notNull().default(false),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    paidAmount: numeric("paid_amount"),
    totalWeightKg: numeric("total_weight_kg"),
    agentId: uuid("agent_id").references(() => agent.agentId),
    commissionRate: numeric("commission_rate", { precision: 5, scale: 2 }),
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
    index("idx_document_agent").on(table.tenantId, table.agentId),
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
    variantId: uuid("variant_id").references(() => articleVariant.variantId),
    articleTextSnapshot: text("article_text_snapshot"),
    langText: text("lang_text"),
    langTextSourceEntity: text("lang_text_source_entity"),
    langTextSourceId: uuid("lang_text_source_id"),
    langTextSourceField: text("lang_text_source_field"),
    langTextLinkedAt: timestamp("lang_text_linked_at", { withTimezone: true }),
    langTextOverriddenAt: timestamp("lang_text_overridden_at", { withTimezone: true }),
    quantity: numeric("quantity").notNull(),
    unit: text("unit"),
    netPrice: numeric("net_price").notNull(),
    discountPercentage: numeric("discount_percentage"),
    taxCodeId: uuid("tax_code_id"),
    taxReason: text("tax_reason"),
    taxRuleId: uuid("tax_rule_id").references(() => taxRule.taxRuleId),
    taxCountryCodeUsed: varchar("tax_country_code_used", { length: 2 }),
    taxRateSnapshot: numeric("tax_rate_snapshot"),
    taxAmount: numeric("tax_amount"),
    lineTotalNet: numeric("line_total_net"),
    warehouseId: uuid("warehouse_id"),
    costCenterId: uuid("cost_center_id").references(() => costCenter.costCenterId),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    transactionId: uuid("transaction_id"),
    movementType: char("movement_type", { length: 1 }),
    lineType: varchar("line_type", { length: 20 }).notNull().default("article"),
    bomGroupId: uuid("bom_group_id"),
    lineWeightKg: numeric("line_weight_kg"),
  },
  (table) => [
    unique("document_line_tenant_id_document_id_line_no_unique").on(
      table.tenantId,
      table.documentId,
      table.lineNo,
      table.archivedAt,
    ),
    unique("document_line_tenant_id_document_line_id_key").on(table.tenantId, table.documentLineId),
    index("idx_document_line_article").on(table.variantId),
    index("idx_document_line_variant").on(table.variantId),
    index("idx_document_line_document").on(table.documentId),
    index("idx_document_line_tenant_document").on(table.tenantId, table.documentId),
    index("idx_document_line_tenant_archived").on(table.tenantId, table.archivedAt),
    index("idx_document_line_tenant").on(table.tenantId),
    index("idx_document_line_tx").on(table.tenantId, table.transactionId),
    check(
      "chk_article_line_requires_variant_id",
      sql`line_type <> 'article' OR variant_id IS NOT NULL`,
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
    index("idx_document_line_tracking_tenant_line").on(_table.tenantId, _table.documentLineId),
    index("idx_document_line_tracking_tenant_created").on(
      _table.tenantId,
      _table.documentLineId,
      _table.createdAt,
    ),
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
    variantId: uuid("variant_id").references(() => articleVariant.variantId),
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
    index("idx_fact_sales_variant").on(table.tenantId, table.variantId),
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
    isDryRun: boolean("is_dry_run").notNull().default(true),
    isRerun: boolean("is_rerun").notNull().default(false),
    sourceBatchId: uuid("source_batch_id"),
    sourceFileName: text("source_file_name"),
    postedEntityCount: integer("posted_entity_count").notNull().default(0),
    failedEntityCount: integer("failed_entity_count").notNull().default(0),
    pendingReferenceCount: integer("pending_reference_count").notNull().default(0),
    errorSummary: jsonb("error_summary"),
    filePath: text("file_path"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    targetEntity: text("target_entity"),
    targetCommandKey: text("target_command_key"),
    layoutId: uuid("layout_id").references(() => buerowareRecordLayout.layoutId),
  },
  (_table) => [
    check("import_batch_atomicity_mode_check", sql`atomicity_mode IN ('file', 'entity', 'run')`),
    check(
      "import_batch_status_check",
      sql`status IN ('pending', 'queued', 'processing', 'validating', 'validated', 'approved', 'posted', 'failed', 'rejected')`,
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
    missingReferences: jsonb("missing_references"),
    errorDetail: jsonb("error_detail"),
    postedAt: timestamp("posted_at", { withTimezone: true }),
  },
  (table) => [
    check(
      "import_row_status_check",
      sql`status IN ('pending', 'valid', 'posted', 'failed', 'pending_references')`,
    ),
    index("idx_import_row_batch_status").on(table.batchId, table.status),
  ],
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
    tenantId: uuid("tenant_id").references(() => tenant.tenantId),
    tenantConnectorId: uuid("tenant_connector_id").references(
      () => tenantConnector.tenantConnectorId,
    ),
    profileId: uuid("profile_id").references(() => importProfile.profileId),
    sourceSystem: text("source_system"),
    sourceFileName: text("source_file_name"),
    targetEntity: text("target_entity"),
    layoutId: uuid("layout_id").references(() => buerowareRecordLayout.layoutId),
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
    unique("uq_import_mapping_source_version").on(
      table.sourceSystem,
      table.sourceFileName,
      table.layoutId,
      table.versionNo,
    ),
    index("idx_import_mapping_version_lookup").on(
      table.tenantConnectorId,
      table.profileId,
      table.isActive,
    ),
    index("idx_import_mapping_version_source_file").on(
      table.sourceSystem,
      table.sourceFileName,
      table.isActive,
    ),
  ],
);

export const importFieldMapping = pgTable(
  "import_field_mapping",
  {
    mappingId: uuid("mapping_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id").references(() => tenant.tenantId),
    versionId: uuid("version_id")
      .notNull()
      .references(() => importProfileMappingVersion.versionId),
    position: integer("position"),
    length: integer("length"),
    qualifier: text("qualifier"),
    formatting: text("formatting"),
    sourceField: text("source_field"),
    targetField: text("target_field").notNull(),
    targetEntity: text("target_entity"),
    referenceEntity: text("reference_entity"),
    isRequired: boolean("is_required").notNull().default(false),
    defaultValue: text("default_value"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_field_mapping_version").on(table.versionId),
    index("idx_field_mapping_tenant").on(table.tenantId),
  ],
);

// ─── Büroware Satzbeschreibung catalog (global reference data, not tenant-scoped) ───
// One row per data area = (file, Satzkürzel/Datenbereich). A file may expose several
// data areas (e.g. S_RART_R00.SEDB → Artikel `S`, Warengruppe `W`, Lager `l`).
export const buerowareRecordLayout = pgTable(
  "bueroware_record_layout",
  {
    layoutId: uuid("layout_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    fileName: text("file_name").notNull(), // normalized UPPERCASE, e.g. S_RART_R00.SEDB
    dataArea: text("data_area").notNull(), // Datenbereich, e.g. "Artikel"
    qualifier: text("qualifier"), // Satzkürzel ('S','W','l',...); '*' is stored as NULL (unqualified)
    defaultTargetEntity: text("default_target_entity"), // suggested platform entity
    catalogVersion: integer("catalog_version").notNull().default(1),
    isActive: boolean("is_active").notNull().default(true),
    fieldCount: integer("field_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("uq_bueroware_layout_file_qualifier_version").on(
      table.fileName,
      table.qualifier,
      table.catalogVersion,
    ),
    index("idx_bueroware_layout_file_active").on(table.fileName, table.isActive),
  ],
);

// One row per field definition from Satzbeschreibung.csv for a given layout.
export const buerowareRecordField = pgTable(
  "bueroware_record_field",
  {
    fieldId: uuid("field_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    layoutId: uuid("layout_id")
      .notNull()
      .references(() => buerowareRecordLayout.layoutId),
    buerowareFieldId: text("bueroware_field_id").notNull(), // FeldId, e.g. ART_1_25
    label: text("label"), // Bezeichnung
    sampleValue: text("sample_value"), // Feldinhalt (example value for the hybrid UI)
    position: integer("position"),
    length: integer("length"),
    formatting: text("formatting"), // Formatierung (L, R0, R2, AJN, ...)
    refreshTable: text("refresh_table"), // Refreshtabelle (FK reference metadata)
    importMarker: text("import_marker"), // Importkennzeichen
    ordinal: integer("ordinal"), // Laufende Nummer
    defaultTargetField: text("default_target_field"), // central default mapping target
    defaultReferenceEntity: text("default_reference_entity"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_bueroware_field_layout").on(table.layoutId)],
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
    inventoryItemId: uuid("inventory_item_id").references(() => inventoryItem.itemId),
    // articleId is kept nullable for backfill compatibility; canonical reads anchor on inventoryItemId.
    articleId: uuid("article_id").references(() => article.articleId),
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
    unique("inventory_balance_tenant_id_warehouse_id_item_unique").on(
      table.tenantId,
      table.warehouseId,
      table.inventoryItemId,
    ),
    index("idx_inv_balance_lookup").on(table.tenantId, table.warehouseId, table.inventoryItemId),
    index("idx_inv_balance_article").on(table.tenantId, table.warehouseId, table.articleId),
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
    inventoryItemId: uuid("inventory_item_id").notNull().references(() => inventoryItem.itemId),
    variantId: uuid("variant_id").references(() => articleVariant.variantId),
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
    index("idx_inv_movement_inventory_item_anchor").on(
      table.tenantId,
      table.warehouseId,
      table.inventoryItemId,
      table.variantId,
      table.movementDate,
    ),
    index("idx_inv_movement_inventory_item").on(
      table.tenantId,
      table.inventoryItemId,
      table.movementDate,
    ),
    index("idx_inv_movement_variant").on(table.tenantId, table.variantId, table.movementDate),
    index("idx_inv_movement_tenant").on(table.tenantId),
    index("idx_inv_movement_tx").on(table.tenantId, table.transactionId),
    index("idx_inv_movement_warehouse_inventory_item").on(
      table.tenantId,
      table.warehouseId,
      table.inventoryItemId,
    ),
    index("idx_inventory_movement_batch_balance").on(
      table.tenantId,
      table.warehouseId,
      table.variantId,
      table.batchNo,
    ),
    index("idx_inventory_movement_batch_balance_item").on(
      table.tenantId,
      table.warehouseId,
      table.inventoryItemId,
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
    fiscalYear: integer("fiscal_year"),
    nextValue: integer("next_value").notNull().default(1),
    padding: integer("padding").notNull().default(5),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    unique("number_sequence_tenant_id_company_id_prefix_year_unique").on(
      table.tenantId,
      table.companyId,
      table.prefix,
      table.fiscalYear,
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
      .references(() => article.articleId),
    // Pricing is variant-specific; articleId is retained only for compatibility with older imports.
    variantId: uuid("variant_id")
      .notNull()
      .references(() => articleVariant.variantId),
    price: numeric("price").notNull(),
    validFrom: date("valid_from"),
    validTo: date("valid_to"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("price_list_item_tenant_id_price_list_id_article_variant_valid_from_u").on(
      table.tenantId,
      table.priceListId,
      table.variantId,
      table.validFrom,
    ),
    index("idx_price_list_item_variant").on(
      table.priceListId,
      table.variantId,
      table.validFrom,
    ),
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
    archived: boolean("archived").notNull().default(false),
  },
  (table) => [
    uniqueIndex("uq_fields_global")
      .on(table.entityName, table.fieldName)
      .where(sql`scope = 'global'`),
    uniqueIndex("uq_fields_org")
      .on(table.organizationId, table.entityName, table.fieldName)
      .where(sql`scope = 'org'`),
    uniqueIndex("uq_fields_tenant")
      .on(table.tenantId, table.entityName, table.fieldName)
      .where(sql`scope = 'tenant'`),
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
    uniqueIndex("uq_groups_global")
      .on(table.entityName, table.groupKey)
      .where(sql`scope = 'global'`),
    uniqueIndex("uq_groups_org")
      .on(table.organizationId, table.entityName, table.groupKey)
      .where(sql`scope = 'org'`),
    uniqueIndex("uq_groups_tenant")
      .on(table.tenantId, table.entityName, table.groupKey)
      .where(sql`scope = 'tenant'`),
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
    userId: text("user_id").references(() => user.id),
    entityName: text("entity_name").notNull(),
    layoutKey: text("layout_key").notNull(),
    layoutDefinition: jsonb("layout_definition").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_layouts_global")
      .on(table.entityName, table.layoutKey)
      .where(sql`scope = 'global'`),
    uniqueIndex("uq_layouts_org")
      .on(table.organizationId, table.entityName, table.layoutKey)
      .where(sql`scope = 'org'`),
    uniqueIndex("uq_layouts_tenant")
      .on(table.tenantId, table.entityName, table.layoutKey)
      .where(sql`scope = 'tenant'`),
    uniqueIndex("uq_layouts_user")
      .on(table.tenantId, table.userId, table.entityName, table.layoutKey)
      .where(sql`scope = 'user'`),
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

export const metadataHistory = pgTable(
  "metadata_history",
  {
    historyId: uuid("history_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id").references(() => tenant.tenantId),
    userId: text("user_id").references(() => user.id),
    entityName: text("entity_name").notNull(),
    metadataType: text("metadata_type").notNull(), // 'field', 'group', 'layout'
    metadataKey: text("metadata_key").notNull(), // fieldName, groupKey, or layoutKey
    oldValue: jsonb("old_value"),
    newValue: jsonb("new_value"),
    changeType: text("change_type").notNull(), // 'insert', 'update', 'delete'
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_metadata_history_entity").on(table.entityName),
    index("idx_metadata_history_tenant").on(table.tenantId),
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

export const emailAccount = pgTable(
  "email_account",
  {
    emailAccountId: uuid("email_account_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    displayName: text("display_name").notNull(),
    primaryEmail: text("primary_email").notNull(),
    status: text("status").notNull().default("connected"),
    credentialsEncrypted: text("credentials_encrypted").notNull(),
    scopes: jsonb("scopes").notNull().default([]),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    lastSyncStatus: text("last_sync_status").notNull().default("idle"),
    lastSyncError: text("last_sync_error"),
    watchExpiresAt: timestamp("watch_expires_at", { withTimezone: true }),
    activityTier: text("activity_tier").notNull().default("cold"),
    lastUserActivityAt: timestamp("last_user_activity_at", { withTimezone: true }),
    syncPriority: text("sync_priority").notNull().default("normal"),
    archived: boolean("archived").notNull().default(false),
    grantedByUserId: text("granted_by_user_id").references(() => user.id),
    grantedScopes: jsonb("granted_scopes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    unique("email_account_tenant_provider_account_unique").on(
      table.tenantId,
      table.provider,
      table.providerAccountId,
    ),
    index("idx_email_account_tenant").on(table.tenantId),
    index("idx_email_account_status").on(table.tenantId, table.status),
    // Covers the backstop sync query: WHERE archived=false AND activity_tier IN (...) AND last_sync_at < ...
    index("idx_email_account_backstop")
      .on(table.archived, table.activityTier, table.lastSyncAt)
      .where(sql`archived = false`),
    check("chk_email_account_provider", sql`provider IN ('gmail', 'microsoft')`),
    check(
      "chk_email_account_status",
      sql`status IN ('connected', 'reauth_required', 'disabled', 'error')`,
    ),
    check(
      "chk_email_account_sync_status",
      sql`last_sync_status IN ('idle', 'queued', 'syncing', 'ok', 'error', 'recovery_required')`,
    ),
    check(
      "chk_email_account_activity_tier",
      sql`activity_tier IN ('hot', 'warm', 'cold', 'dormant')`,
    ),
    check(
      "chk_email_account_sync_priority",
      sql`sync_priority IN ('high', 'normal', 'low')`,
    ),
  ],
);

export const emailIdentity = pgTable(
  "email_identity",
  {
    emailIdentityId: uuid("email_identity_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    emailAccountId: uuid("email_account_id")
      .notNull()
      .references(() => emailAccount.emailAccountId),
    email: text("email").notNull(),
    displayName: text("display_name"),
    providerIdentityId: text("provider_identity_id"),
    isPrimary: boolean("is_primary").notNull().default(false),
    canSend: boolean("can_send").notNull().default(true),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("email_identity_account_email_unique").on(
      table.tenantId,
      table.emailAccountId,
      table.email,
    ),
    index("idx_email_identity_account").on(table.tenantId, table.emailAccountId),
  ],
);

export const emailAccountUserGrant = pgTable(
  "email_account_user_grant",
  {
    emailAccountUserGrantId: uuid("email_account_user_grant_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    emailAccountId: uuid("email_account_id")
      .notNull()
      .references(() => emailAccount.emailAccountId),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    canRead: boolean("can_read").notNull().default(true),
    canSend: boolean("can_send").notNull().default(false),
    canManage: boolean("can_manage").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("email_account_grant_user_unique").on(
      table.tenantId,
      table.emailAccountId,
      table.userId,
    ),
    index("idx_email_account_grant_user").on(table.tenantId, table.userId),
  ],
);

export const emailThread = pgTable(
  "email_thread",
  {
    emailThreadId: uuid("email_thread_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    emailAccountId: uuid("email_account_id")
      .notNull()
      .references(() => emailAccount.emailAccountId),
    providerThreadId: text("provider_thread_id").notNull(),
    subject: text("subject"),
    snippet: text("snippet"),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    isRead: boolean("is_read").notNull().default(false),
    isStarred: boolean("is_starred").notNull().default(false),
    messageCount: integer("message_count").notNull().default(0),
    relatedAddressId: uuid("related_address_id").references(() => address.addressId),
    relatedDocumentId: uuid("related_document_id").references(() => document.documentId),
    archived: boolean("archived").notNull().default(false),
    inTrash: boolean("in_trash").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    unique("email_thread_account_provider_unique").on(
      table.tenantId,
      table.emailAccountId,
      table.providerThreadId,
    ),
    index("idx_email_thread_mailbox_list").on(
      table.tenantId,
      table.emailAccountId,
      table.archived,
      table.lastMessageAt,
      table.createdAt,
    ),
    index("idx_email_thread_document").on(table.tenantId, table.relatedDocumentId),
    index("idx_email_thread_address").on(table.tenantId, table.relatedAddressId),
  ],
);

export const emailMessage = pgTable(
  "email_message",
  {
    emailMessageId: uuid("email_message_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    emailAccountId: uuid("email_account_id")
      .notNull()
      .references(() => emailAccount.emailAccountId),
    emailThreadId: uuid("email_thread_id")
      .notNull()
      .references(() => emailThread.emailThreadId),
    providerMessageId: text("provider_message_id").notNull(),
    providerDraftId: text("provider_draft_id"),
    internetMessageId: text("internet_message_id"),
    direction: text("direction").notNull(),
    fromJson: jsonb("from_json").notNull().default({}),
    toJson: jsonb("to_json").notNull().default([]),
    ccJson: jsonb("cc_json").notNull().default([]),
    bccJson: jsonb("bcc_json").notNull().default([]),
    subject: text("subject"),
    snippet: text("snippet"),
    bodyHtml: text("body_html"),
    bodyText: text("body_text"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    isRead: boolean("is_read").notNull().default(false),
    hasAttachments: boolean("has_attachments").notNull().default(false),
    rawHeaders: jsonb("raw_headers").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    unique("email_message_account_provider_unique").on(
      table.tenantId,
      table.emailAccountId,
      table.providerMessageId,
    ),
    index("idx_email_message_thread").on(table.tenantId, table.emailThreadId),
    index("idx_email_message_thread_timeline").on(
      table.tenantId,
      table.emailThreadId,
      table.receivedAt,
      table.sentAt,
      table.createdAt,
    ),
    index("idx_email_message_account_date").on(
      table.tenantId,
      table.emailAccountId,
      table.receivedAt,
    ),
    check("chk_email_message_direction", sql`direction IN ('inbound', 'outbound', 'draft')`),
  ],
);

export const emailAttachment = pgTable(
  "email_attachment",
  {
    emailAttachmentId: uuid("email_attachment_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    emailMessageId: uuid("email_message_id")
      .notNull()
      .references(() => emailMessage.emailMessageId),
    providerAttachmentId: text("provider_attachment_id"),
    fileName: text("file_name").notNull(),
    contentType: text("content_type"),
    sizeBytes: integer("size_bytes"),
    storageKey: text("storage_key"),
    inlineContentId: text("inline_content_id"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("email_attachment_message_provider_unique").on(
      table.tenantId,
      table.emailMessageId,
      table.providerAttachmentId,
    ),
    index("idx_email_attachment_message").on(table.tenantId, table.emailMessageId),
    index("idx_email_attachment_storage").on(table.tenantId, table.storageKey),
  ],
);

export const emailLabel = pgTable(
  "email_label",
  {
    emailLabelId: uuid("email_label_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    emailAccountId: uuid("email_account_id")
      .notNull()
      .references(() => emailAccount.emailAccountId),
    providerLabelId: text("provider_label_id").notNull(),
    name: text("name").notNull(),
    kind: text("kind").notNull().default("label"),
    color: text("color"),
    parentProviderLabelId: text("parent_provider_label_id"),
    messageCount: integer("message_count").notNull().default(0),
    unreadCount: integer("unread_count").notNull().default(0),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    unique("email_label_account_provider_unique").on(
      table.tenantId,
      table.emailAccountId,
      table.providerLabelId,
    ),
    index("idx_email_label_account_active").on(
      table.tenantId,
      table.emailAccountId,
      table.archived,
      table.kind,
      table.name,
    ),
    check("chk_email_label_kind", sql`kind IN ('system', 'folder', 'label')`),
  ],
);

export const emailMessageLabel = pgTable(
  "email_message_label",
  {
    emailMessageLabelId: uuid("email_message_label_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    emailMessageId: uuid("email_message_id")
      .notNull()
      .references(() => emailMessage.emailMessageId),
    emailLabelId: uuid("email_label_id")
      .notNull()
      .references(() => emailLabel.emailLabelId),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("email_message_label_unique").on(
      table.tenantId,
      table.emailMessageId,
      table.emailLabelId,
    ),
    index("idx_email_message_label_label").on(table.tenantId, table.emailLabelId),
  ],
);

export const emailSyncState = pgTable(
  "email_sync_state",
  {
    emailSyncStateId: uuid("email_sync_state_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    emailAccountId: uuid("email_account_id")
      .notNull()
      .references(() => emailAccount.emailAccountId),
    scope: text("scope").notNull().default("mailbox"),
    cursor: text("cursor"),
    cursorJson: jsonb("cursor_json"),
    status: text("status").notNull().default("idle"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    lastError: text("last_error"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("email_sync_state_account_scope_unique").on(
      table.tenantId,
      table.emailAccountId,
      table.scope,
    ),
    index("idx_email_sync_state_account").on(table.tenantId, table.emailAccountId),
    check(
      "chk_email_sync_state_status",
      sql`status IN ('idle', 'queued', 'syncing', 'ok', 'error', 'recovery_required')`,
    ),
  ],
);

export const emailJob = pgTable(
  "email_job",
  {
    emailJobId: uuid("email_job_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    emailAccountId: uuid("email_account_id").references(() => emailAccount.emailAccountId),
    jobType: text("job_type").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    payload: jsonb("payload").notNull().default({}),
    status: text("status").notNull().default("queued"),
    priority: integer("priority").notNull().default(2),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    runAfter: timestamp("run_after", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedBy: text("locked_by"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_email_job_queue_claim").on(
      table.tenantId,
      table.status,
      table.priority,
      table.runAfter,
      table.createdAt,
    ),
    index("idx_email_job_account").on(table.tenantId, table.emailAccountId),
    // Partial index for the reaper and stale-reclaim branch — only covers processing rows
    index("idx_email_job_stale")
      .on(table.lockedAt)
      .where(sql`status = 'processing'`),
    unique("email_job_idempotency_unique").on(table.tenantId, table.idempotencyKey),
    check(
      "chk_email_job_type",
      sql`job_type IN ('initial_sync', 'incremental_sync', 'watch_renewal', 'reconcile', 'send', 'fetch_attachment', 'sync_contacts')`,
    ),
    check("chk_email_job_status", sql`status IN ('queued', 'processing', 'done', 'failed')`),
    check("chk_email_job_priority", sql`priority BETWEEN 1 AND 3`),
  ],
);

export const emailSubscription = pgTable(
  "email_subscription",
  {
    emailSubscriptionId: uuid("email_subscription_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    emailAccountId: uuid("email_account_id")
      .notNull()
      .references(() => emailAccount.emailAccountId),
    resource: text("resource").notNull().default("mail"),
    providerSubscriptionId: text("provider_subscription_id"),
    channelToken: text("channel_token"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    renewedAt: timestamp("renewed_at", { withTimezone: true }),
    status: text("status").notNull().default("active"),
    renewalAttempts: integer("renewal_attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    unique("email_subscription_account_resource_unique").on(
      table.tenantId,
      table.emailAccountId,
      table.resource,
    ),
    index("idx_email_subscription_expires").on(table.expiresAt),
    index("idx_email_subscription_account").on(table.tenantId, table.emailAccountId),
    // Partial unique: channel_token is the sole auth boundary for webhook lookup — must be globally unique
    uniqueIndex("idx_email_subscription_channel_token")
      .on(table.channelToken)
      .where(sql`channel_token IS NOT NULL`),
    check(
      "chk_email_subscription_resource",
      sql`resource IN ('mail', 'calendar', 'contacts')`,
    ),
    check(
      "chk_email_subscription_status",
      sql`status IN ('active', 'expired', 'renewal_pending', 'failed')`,
    ),
  ],
);

export const emailTemplate = pgTable(
  "email_template",
  {
    emailTemplateId: uuid("email_template_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    category: text("category").notNull().default("document"),
    code: text("code").notNull(),
    name: text("name").notNull(),
    subjectTemplate: text("subject_template").notNull(),
    bodyHtmlTemplate: text("body_html_template").notNull(),
    bodyTextTemplate: text("body_text_template"),
    language: char("language", { length: 2 }),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    unique("email_template_tenant_category_code_unique").on(
      table.tenantId,
      table.category,
      table.code,
    ),
    index("idx_email_template_tenant").on(table.tenantId, table.category),
  ],
);

export const emailTemplateBinding = pgTable(
  "email_template_binding",
  {
    emailTemplateBindingId: uuid("email_template_binding_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    emailTemplateId: uuid("email_template_id")
      .notNull()
      .references(() => emailTemplate.emailTemplateId),
    documentType: char("document_type", { length: 1 }),
    companyId: uuid("company_id").references(() => company.companyId),
    language: char("language", { length: 2 }),
    emailIdentityId: uuid("email_identity_id").references(() => emailIdentity.emailIdentityId),
    priority: integer("priority").notNull().default(100),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_email_template_binding_lookup").on(
      table.tenantId,
      table.documentType,
      table.companyId,
      table.language,
      table.emailIdentityId,
    ),
  ],
);

export const emailTemplateRenderLog = pgTable(
  "email_template_render_log",
  {
    emailTemplateRenderLogId: uuid("email_template_render_log_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    emailTemplateId: uuid("email_template_id").references(() => emailTemplate.emailTemplateId),
    emailTemplateBindingId: uuid("email_template_binding_id").references(
      () => emailTemplateBinding.emailTemplateBindingId,
    ),
    documentId: uuid("document_id").references(() => document.documentId),
    emailIdentityId: uuid("email_identity_id").references(() => emailIdentity.emailIdentityId),
    language: char("language", { length: 2 }),
    subject: text("subject").notNull(),
    renderedHash: text("rendered_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: text("created_by").references(() => user.id),
  },
  (table) => [
    index("idx_email_template_render_log_document").on(table.tenantId, table.documentId),
    index("idx_email_template_render_log_template").on(table.tenantId, table.emailTemplateId),
  ],
);

export const emailOutbox = pgTable(
  "email_outbox",
  {
    emailOutboxId: uuid("email_outbox_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    emailAccountId: uuid("email_account_id")
      .notNull()
      .references(() => emailAccount.emailAccountId),
    emailIdentityId: uuid("email_identity_id")
      .notNull()
      .references(() => emailIdentity.emailIdentityId),
    emailMessageId: uuid("email_message_id").references(() => emailMessage.emailMessageId),
    providerDraftId: text("provider_draft_id"),
    status: text("status").notNull().default("draft"),
    payload: jsonb("payload").notNull().default({}),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
    createdBy: text("created_by").references(() => user.id),
  },
  (table) => [
    index("idx_email_outbox_queue").on(
      table.tenantId,
      table.emailAccountId,
      table.status,
      table.updatedAt,
      table.createdAt,
    ),
    index("idx_email_outbox_message").on(table.tenantId, table.emailMessageId),
    check(
      "chk_email_outbox_status",
      sql`status IN ('draft', 'queued', 'sending', 'sent', 'failed')`,
    ),
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

export const documentShipment = pgTable(
  "document_shipment",
  {
    documentShipmentId: uuid("document_shipment_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    documentId: uuid("document_id")
      .notNull()
      .references(() => document.documentId),

    // Status and Carrier
    shipmentStatus: text("shipment_status").notNull().default("open"), // open, exported, label_created, shipped, cancelled
    carrierKey: text("carrier_key").notNull().default("dhl"),
    carrierServiceKey: text("carrier_service_key").notNull().default("paket"),
    trackingId: text("tracking_id"),

    // Recipient Snapshot
    recipientName: text("recipient_name").notNull(),
    company: text("company"),
    street: text("street").notNull(),
    houseNumber: text("house_number").notNull(),
    postalCode: text("postal_code").notNull(),
    city: text("city").notNull(),
    countryCode: char("country_code", { length: 2 }).notNull().default("DE"),
    email: text("email"),
    phone: text("phone"),

    // Timestamps
    exportedAt: timestamp("exported_at", { withTimezone: true }),
    labelCreatedAt: timestamp("label_created_at", { withTimezone: true }),
    shippedAt: timestamp("shipped_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    unique("uq_document_shipment").on(table.tenantId, table.documentId),
    index("idx_shipment_document").on(table.documentId),
    index("idx_shipment_status").on(table.shipmentStatus),
  ],
);

export const documentShipmentPackage = pgTable(
  "document_shipment_package",
  {
    documentShipmentPackageId: uuid("document_shipment_package_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    documentShipmentId: uuid("document_shipment_id")
      .notNull()
      .references(() => documentShipment.documentShipmentId),

    seq: integer("seq").notNull().default(1),
    weightKg: numeric("weight_kg").notNull().default("1.0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_shipment_package_shipment").on(table.documentShipmentId)],
);

export const aiRun = pgTable(
  "ai_run",
  {
    runId: uuid("run_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    taskScope: text("task_scope").notNull(),
    status: text("status").notNull(),
    durationMs: integer("duration_ms"),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_ai_run_tenant").on(table.tenantId),
    index("idx_ai_run_user").on(table.userId),
    index("idx_ai_run_status").on(table.status),
  ],
);

export const aiSessionStatus = pgEnum("ai_session_status", [
  "active",
  "awaiting_review",
  "completed",
  "aborted",
]);

export const aiSession = pgTable(
  "ai_session",
  {
    sessionId: uuid("session_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    mode: text("mode").notNull().default("sync"),
    focusType: text("focus_type").notNull(),
    focusId: text("focus_id").notNull(),
    status: aiSessionStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_ai_session_tenant").on(table.tenantId),
    index("idx_ai_session_user").on(table.userId),
    index("idx_ai_session_status").on(table.status),
    index("idx_ai_session_focus").on(table.focusType, table.focusId),
  ],
);

export const aiPromptVersion = pgTable(
  "ai_prompt_version",
  {
    promptVersionId: uuid("prompt_version_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id").references(() => tenant.tenantId),
    systemPrompt: text("system_prompt").notNull(),
    inputSchema: jsonb("input_schema").notNull(),
    modelConfig: jsonb("model_config").notNull(),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [index("idx_ai_prompt_version_tenant").on(table.tenantId)],
);

export const aiPlan = pgTable(
  "ai_plan",
  {
    planId: uuid("plan_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    runId: uuid("run_id")
      .notNull()
      .references(() => aiRun.runId),
    promptVersionId: uuid("prompt_version_id")
      .notNull()
      .references(() => aiPromptVersion.promptVersionId),
    planJson: jsonb("plan_json").notNull(),
    confidenceScore: numeric("confidence_score").notNull(),
    applyReadiness: text("apply_readiness").notNull(),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_ai_plan_tenant").on(table.tenantId),
    index("idx_ai_plan_run").on(table.runId),
    index("idx_ai_plan_prompt_version").on(table.promptVersionId),
    index("idx_ai_plan_readiness").on(table.applyReadiness),
  ],
);

export const aiApplyAttempt = pgTable(
  "ai_apply_attempt",
  {
    attemptId: uuid("attempt_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    planId: uuid("plan_id")
      .notNull()
      .references(() => aiPlan.planId),
    appliedPlanJson: jsonb("applied_plan_json").notNull(),
    status: text("status").notNull(),
    executedByUserId: text("executed_by_user_id")
      .notNull()
      .references(() => user.id),
    errorLogs: text("error_logs"),
    appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_ai_apply_attempt_tenant").on(table.tenantId),
    index("idx_ai_apply_attempt_plan").on(table.planId),
    index("idx_ai_apply_attempt_executor").on(table.executedByUserId),
    index("idx_ai_apply_attempt_status").on(table.status),
  ],
);

export const aiInterpretation = pgTable(
  "ai_interpretation",
  {
    interpretationId: uuid("interpretation_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    sourceThreadId: uuid("source_thread_id").references(() => emailThread.emailThreadId),
    runId: uuid("run_id")
      .notNull()
      .references(() => aiRun.runId),
    promptVersionId: uuid("prompt_version_id")
      .notNull()
      .references(() => aiPromptVersion.promptVersionId),
    businessIntent: text("business_intent").notNull(),
    confidenceScore: numeric("confidence_score").notNull(),
    summary: text("summary").notNull(),
    evidenceJson: jsonb("evidence_json").notNull(),
    extractedReferencesJson: jsonb("extracted_references_json").notNull(),
    requestedResolversJson: jsonb("requested_resolvers_json").notNull(),
    blockingQuestionsJson: jsonb("blocking_questions_json").notNull(),
    rawLlmTrace: jsonb("raw_llm_trace"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_ai_interpretation_tenant").on(table.tenantId),
    index("idx_ai_interpretation_run").on(table.runId),
  ],
);

export const aiReview = pgTable(
  "ai_review",
  {
    reviewId: uuid("review_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    interpretationId: uuid("interpretation_id")
      .notNull()
      .references(() => aiInterpretation.interpretationId),
    runId: uuid("run_id")
      .notNull()
      .references(() => aiRun.runId),
    reviewStatus: text("review_status").notNull(),
    businessCase: text("business_case").notNull(),
    headline: text("headline").notNull(),
    summary: text("summary").notNull(),
    intentBadgeJson: jsonb("intent_badge_json").notNull(),
    sectionsJson: jsonb("sections_json").notNull(),
    warningsJson: jsonb("warnings_json").notNull(),
    blockingIssuesJson: jsonb("blocking_issues_json").notNull(),
    proposedApplyPayloadJson: jsonb("proposed_apply_payload_json").notNull(),
    appliedOverridesJson: jsonb("applied_overrides_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_ai_review_tenant").on(table.tenantId),
    index("idx_ai_review_interpretation").on(table.interpretationId),
  ],
);

export const aiEvidence = pgTable(
  "ai_evidence",
  {
    evidenceId: uuid("evidence_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    planId: uuid("plan_id")
      .notNull()
      .references(() => aiPlan.planId),
    fieldName: text("field_name").notNull(),
    sourceText: text("source_text").notNull(),
    matchConfidence: numeric("match_confidence").notNull(),
    ambiguityNote: text("ambiguity_note"),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_ai_evidence_tenant").on(table.tenantId),
    index("idx_ai_evidence_plan").on(table.planId),
    index("idx_ai_evidence_field").on(table.fieldName),
  ],
);

export const tenantLlmConfig = pgTable(
  "tenant_llm_config",
  {
    tenantLlmConfigId: uuid("tenant_llm_config_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    companyId: uuid("company_id")
      .notNull()
      .references(() => company.companyId),
    provider: text("provider"),
    endpointUrl: text("endpoint_url"),
    model: text("model"),
    apiKey: text("api_key"),
    githubToken: text("github_token"),
    githubRepo: text("github_repo"),
    vertexCredentials: text("vertex_credentials"),
    vertexProject: text("vertex_project"),
    vertexLocation: text("vertex_location"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    unique("uq_tenant_llm_config_company").on(table.tenantId, table.companyId),
    index("idx_tenant_llm_config_tenant").on(table.tenantId),
  ],
);

// ─── Issue #35: ai_turn + ai_tool_call ───────────────────────────────────────

export const aiToolCallStatus = pgEnum("ai_tool_call_status", [
  "pending",
  "running",
  "done",
  "error",
]);

export const aiTurn = pgTable(
  "ai_turn",
  {
    turnId: uuid("turn_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => aiSession.sessionId),
    role: text("role").notNull(),
    message: text("message").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_ai_turn_session").on(table.sessionId)],
);

export const aiToolCall = pgTable(
  "ai_tool_call",
  {
    toolCallId: uuid("tool_call_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    turnId: uuid("turn_id")
      .notNull()
      .references(() => aiTurn.turnId),
    toolName: text("tool_name").notNull(),
    input: jsonb("input").notNull(),
    output: jsonb("output"),
    status: aiToolCallStatus("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("idx_ai_tool_call_turn").on(table.turnId),
    index("idx_ai_tool_call_status").on(table.status),
  ],
);

// ─── Issue #47: ai_tool_review + ai_context_projection ───────────────────────

export const aiToolReviewStatus = pgEnum("ai_tool_review_status", [
  "pending",
  "validated",
  "applied",
  "rejected",
]);

export const aiToolReview = pgTable(
  "ai_tool_review",
  {
    reviewId: uuid("review_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => aiSession.sessionId),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    toolName: text("tool_name").notNull(),
    proposal: jsonb("proposal").notNull(),
    status: aiToolReviewStatus("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_ai_tool_review_session").on(table.sessionId),
    index("idx_ai_tool_review_tenant").on(table.tenantId),
  ],
);

export const aiContextProjection = pgTable(
  "ai_context_projection",
  {
    projectionId: uuid("projection_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => aiSession.sessionId),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    focusType: text("focus_type").notNull(),
    focusId: text("focus_id").notNull(),
    snapshot: jsonb("snapshot").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("idx_ai_context_projection_session").on(table.sessionId)],
);

// ─── Issue #57: ai_memory ─────────────────────────────────────────────────────

export const aiMemoryKind = pgEnum("ai_memory_kind", [
  "business_fact",
  "classification_pattern",
  "explicit_rule",
  "writing_style",
  "personal_shorthand",
]);

export const aiMemory = pgTable(
  "ai_memory",
  {
    memoryId: uuid("memory_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    userId: text("user_id").references(() => user.id),
    kind: aiMemoryKind("kind").notNull(),
    text: text("text").notNull(),
    confidence: numeric("confidence").notNull(),
    sourceReviewId: uuid("source_review_id").references(() => aiToolReview.reviewId),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_ai_memory_tenant").on(table.tenantId),
    index("idx_ai_memory_user").on(table.userId),
    index("idx_ai_memory_kind").on(table.kind),
    index("idx_ai_memory_confirmed").on(table.confirmedAt),
  ],
);

// E-Commerce Integrations

export const externalSyncEntityType = pgEnum("external_sync_entity_type", [
  "address",
  "article",
  "article_group",
  "article_variant",
  "document",
  "document_line",
  "inventory_item",
  "inventory_level",
  "media_asset",
  "customer",
  "customer_address",
  "category",
  "price_list",
  "shipment",
]);

export const externalSyncDirection = pgEnum("external_sync_direction", [
  "push",
  "pull",
  "bidirectional",
]);

export const externalSyncStatus = pgEnum("external_sync_status", ["pending", "success", "error"]);

export const ecommercePlatform = pgEnum("ecommerce_platform", [
  "shopify",
  "shopware6",
  "woocommerce",
  "prestashop",
]);

export const commerceSyncRunDirection = pgEnum("commerce_sync_run_direction", [
  "push",
  "pull",
  "bidirectional",
]);

export const commerceSyncRunMode = pgEnum("commerce_sync_run_mode", ["single", "full"]);

export const commerceSyncRunStatus = pgEnum("commerce_sync_run_status", [
  "queued",
  "running",
  "success",
  "partial_error",
  "error",
  "cancel_requested",
  "cancelled",
]);

export const commerceSyncStepPhase = pgEnum("commerce_sync_step_phase", [
  "plan",
  "map",
  "push",
  "pull",
  "finalize",
]);

export const commerceSyncStepStatus = pgEnum("commerce_sync_step_status", [
  "pending",
  "running",
  "success",
  "error",
  "skipped",
]);

export const salesChannel = pgTable(
  "sales_channel",
  {
    salesChannelId: uuid("sales_channel_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    name: text("name").notNull(),
    platform: ecommercePlatform("platform").notNull(),
    apiUrl: text("api_url").notNull(),
    credentials: jsonb("credentials"),
    masterDataPolicy: text("master_data_policy"), // Defines behavior like "b2b", "b2c", etc.
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_sales_channel_tenant").on(table.tenantId)],
);

export const externalSyncMapping = pgTable(
  "external_sync_mapping",
  {
    mappingId: uuid("mapping_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    salesChannelId: uuid("sales_channel_id")
      .references(() => salesChannel.salesChannelId),
    sourceSystem: text("source_system").notNull().default("sales_channel"),
    entityType: externalSyncEntityType("entity_type").notNull(),
    internalId: uuid("internal_id").notNull(),
    externalId: text("external_id").notNull(),
    externalParentId: text("external_parent_id"),
    externalVersion: text("external_version"),
    syncDirection: externalSyncDirection("sync_direction").notNull(),
    payloadSnapshot: jsonb("payload_snapshot"),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    syncStatus: externalSyncStatus("sync_status").notNull().default("pending"),
    errorLog: text("error_log"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    externalDeletedAt: timestamp("external_deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_ext_sync_tenant").on(table.tenantId),
    index("idx_ext_sync_tenant_lookup").on(table.tenantId, table.sourceSystem, table.entityType),
    unique("uq_ext_sync_internal").on(
      table.tenantId,
      table.salesChannelId,
      table.entityType,
      table.internalId,
    ),
    unique("uq_ext_sync_external").on(
      table.tenantId,
      table.salesChannelId,
      table.entityType,
      table.externalId,
    ),
    unique("uq_ext_sync_external_key").on(
      table.tenantId,
      table.sourceSystem,
      table.entityType,
      table.externalId,
    ),
  ],
);

export const commerceSyncRun = pgTable(
  "commerce_sync_run",
  {
    runId: uuid("run_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    salesChannelId: uuid("sales_channel_id")
      .notNull()
      .references(() => salesChannel.salesChannelId),
    direction: commerceSyncRunDirection("direction").notNull(),
    mode: commerceSyncRunMode("mode").notNull(),
    status: commerceSyncRunStatus("status").notNull().default("queued"),
    requestedEntities: jsonb("requested_entities").notNull(),
    dryRun: boolean("dry_run").notNull().default(false),
    totalItems: integer("total_items").notNull().default(0),
    succeededItems: integer("succeeded_items").notNull().default(0),
    failedItems: integer("failed_items").notNull().default(0),
    errorSummary: text("error_summary"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelRequestedAt: timestamp("cancel_requested_at", { withTimezone: true }),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_commerce_sync_run_tenant").on(table.tenantId),
    index("idx_commerce_sync_run_sales_channel").on(table.tenantId, table.salesChannelId),
    index("idx_commerce_sync_run_status").on(table.tenantId, table.status),
  ],
);

export const commerceSyncRunStep = pgTable(
  "commerce_sync_run_step",
  {
    stepId: uuid("step_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    runId: uuid("run_id")
      .notNull()
      .references(() => commerceSyncRun.runId),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    salesChannelId: uuid("sales_channel_id")
      .notNull()
      .references(() => salesChannel.salesChannelId),
    entityType: externalSyncEntityType("entity_type").notNull(),
    phase: commerceSyncStepPhase("phase").notNull(),
    status: commerceSyncStepStatus("status").notNull().default("pending"),
    sequence: integer("sequence").notNull(),
    batchNo: integer("batch_no").notNull().default(0),
    cursor: text("cursor"),
    plannedItems: integer("planned_items").notNull().default(0),
    succeededItems: integer("succeeded_items").notNull().default(0),
    failedItems: integer("failed_items").notNull().default(0),
    payloadSummary: jsonb("payload_summary"),
    errorSummary: text("error_summary"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_commerce_sync_step_run").on(table.runId),
    index("idx_commerce_sync_step_tenant").on(table.tenantId),
    unique("uq_commerce_sync_step_sequence").on(table.runId, table.sequence, table.batchNo),
  ],
);

export const commerceSyncDlqStatus = pgEnum("commerce_sync_dlq_status", [
  "pending",
  "resolved",
  "abandoned",
]);

export const commerceSyncDeadLetter = pgTable(
  "commerce_sync_dead_letter",
  {
    itemId: uuid("item_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    runId: uuid("run_id")
      .notNull()
      .references(() => commerceSyncRun.runId),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    salesChannelId: uuid("sales_channel_id")
      .notNull()
      .references(() => salesChannel.salesChannelId),
    entityType: externalSyncEntityType("entity_type").notNull(),
    internalId: uuid("internal_id").notNull(),
    errorMessage: text("error_message").notNull(),
    attemptCount: integer("attempt_count").notNull().default(1),
    lastAttemptedAt: timestamp("last_attempted_at", { withTimezone: true }).notNull(),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    status: commerceSyncDlqStatus("status").notNull().default("pending"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_commerce_sync_dlq_tenant").on(table.tenantId),
    index("idx_commerce_sync_dlq_pending").on(table.tenantId, table.status, table.nextRetryAt),
    index("idx_commerce_sync_dlq_item").on(
      table.tenantId,
      table.salesChannelId,
      table.entityType,
      table.internalId,
    ),
  ],
);

export const commerceWebhookEventStatus = pgEnum("commerce_webhook_event_status", [
  "pending",
  "processing",
  "processed",
  "ignored",
  "failed",
]);

// Inbound shop webhook events (e.g. Shopware App-System): the durable, idempotent
// landing zone for signed event deliveries. Ingestion only persists; a processor
// drains pending rows (order.placed -> order import, etc.). Redeliveries are
// deduplicated on the request signature.
export const commerceWebhookEvent = pgTable(
  "commerce_webhook_event",
  {
    eventId: uuid("event_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    salesChannelId: uuid("sales_channel_id")
      .notNull()
      .references(() => salesChannel.salesChannelId),
    eventName: text("event_name").notNull(),
    // Shopware signs each delivery (shopware-shop-signature); reused as the dedup key.
    dedupeKey: text("dedupe_key").notNull(),
    payload: jsonb("payload").notNull(),
    status: commerceWebhookEventStatus("status").notNull().default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    errorMessage: text("error_message"),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_commerce_webhook_event_tenant").on(table.tenantId),
    index("idx_commerce_webhook_event_pending").on(
      table.tenantId,
      table.salesChannelId,
      table.status,
      table.nextRetryAt,
    ),
    unique("uq_commerce_webhook_event_dedupe").on(
      table.tenantId,
      table.salesChannelId,
      table.dedupeKey,
    ),
  ],
);

export const articleVariant = pgTable(
  "article_variant",
  {
    variantId: uuid("variant_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    articleId: uuid("article_id")
      .notNull()
      .references(() => article.articleId),
    sku: text("sku").notNull(),
    ean: text("ean"),
    optionValueHash: text("option_value_hash").notNull(),
    price: numeric("price"),
    weight: numeric("weight"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_article_variant_tenant").on(table.tenantId),
    index("idx_article_variant_article").on(table.articleId),
    unique("uq_article_variant_sku").on(table.tenantId, table.sku),
    unique("uq_article_variant_option_hash").on(
      table.tenantId,
      table.articleId,
      table.optionValueHash,
    ),
  ],
);

// Introspection note: variant lookups are rendered through the helper registry as a
// composed label (SKU + option summary + available quantity) rather than a raw UUID.
export const articleOption = pgTable(
  "article_option",
  {
    optionId: uuid("option_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    articleId: uuid("article_id")
      .notNull()
      .references(() => article.articleId),
    name: text("name").notNull(), // e.g. "Color", "Size"
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    index("idx_article_option_tenant").on(table.tenantId),
    index("idx_article_option_article").on(table.articleId),
    unique("uq_article_option_name").on(table.tenantId, table.articleId, table.name),
  ],
);

export const articleOptionValue = pgTable(
  "article_option_value",
  {
    valueId: uuid("value_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    optionId: uuid("option_id")
      .notNull()
      .references(() => articleOption.optionId),
    value: text("value").notNull(), // e.g. "Red", "XL"
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    index("idx_article_optval_tenant").on(table.tenantId),
    index("idx_article_optval_option").on(table.optionId),
    unique("uq_article_option_value").on(table.tenantId, table.optionId, table.value),
  ],
);

export const articleVariantOptionValue = pgTable(
  "article_variant_option_value",
  {
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => articleVariant.variantId),
    valueId: uuid("value_id")
      .notNull()
      .references(() => articleOptionValue.valueId),
  },
  (table) => [
    index("idx_variant_optval_tenant").on(table.tenantId),
    index("idx_variant_optval_variant").on(table.variantId),
    unique("uq_variant_optval").on(table.variantId, table.valueId),
  ],
);

export const inventoryItem = pgTable(
  "inventory_item",
  {
    itemId: uuid("item_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => articleVariant.variantId),
    sku: text("sku").notNull(),
    tracked: boolean("tracked").notNull().default(true),
  },
  (table) => [
    index("idx_inv_item_tenant").on(table.tenantId),
    index("idx_inv_item_variant").on(table.variantId),
    unique("uq_inv_item_variant").on(table.tenantId, table.variantId),
    unique("uq_inv_item_sku").on(table.tenantId, table.sku),
  ],
);

export const articleVariantTemplate = pgTable(
  "article_variant_template",
  {
    templateId: uuid("template_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    slug: text("slug").notNull(),
    label: text("label").notNull(),
    articleGroupId: uuid("article_group_id").references(() => articleGroup.articleGroupId),
    definition: jsonb("definition").notNull(),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    unique("uq_article_variant_template_slug").on(table.tenantId, table.slug),
    index("idx_article_variant_template_tenant").on(table.tenantId),
  ],
);

export const inventoryLevel = pgTable(
  "inventory_level",
  {
    levelId: uuid("level_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    itemId: uuid("item_id")
      .notNull()
      .references(() => inventoryItem.itemId),
    locationId: uuid("location_id")
      .notNull()
      .references(() => warehouse.warehouseId),
    quantity: numeric("quantity").notNull().default("0"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_inv_level_tenant").on(table.tenantId),
    index("idx_inv_level_item").on(table.itemId),
    unique("uq_inv_level_loc").on(table.itemId, table.locationId),
  ],
);

// Idempotency log for the capability runtime. A successful non-read execution
// is recorded under (tenant_id, idempotency_key); a later call with the same
// key replays the stored result instead of re-running the handler. The unique
// index is the concurrency guard: the first caller inserts a "pending" row and
// owns execution, a concurrent caller sees the conflict.
export const capabilityExecutionLog = pgTable(
  "capability_execution_log",
  {
    capabilityExecutionLogId: uuid("capability_execution_log_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    idempotencyKey: text("idempotency_key").notNull(),
    capabilityKey: text("capability_key").notNull(),
    // sha256 hex of the canonicalized input — guards against reusing a key with
    // a different request.
    inputHash: char("input_hash", { length: 64 }).notNull(),
    status: text("status").notNull(), // "pending" | "completed"
    // Stored success envelope ({ data, meta }); null while pending.
    result: jsonb("result"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("uq_capability_execution_log_key").on(table.tenantId, table.idempotencyKey),
    index("idx_capability_execution_log_tenant").on(table.tenantId),
  ],
);
