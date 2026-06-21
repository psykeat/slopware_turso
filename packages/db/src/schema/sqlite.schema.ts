// This file is auto-generated from app.schema.ts. Do not edit manually.
import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  numeric,
  sqliteTable,
  text,
  unique,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

function sqliteEnum<const T extends readonly [string, ...string[]]>(_name: string, values: T) {
  return (columnName: string) => text(columnName, { enum: values });
}

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
});

export const postingBatch = sqliteTable(
  "posting_batch",
  {
    batchId: text("batch_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    documentId: text("document_id"),
    postedAt: integer("posted_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    postedBy: text("posted_by").notNull(),
  },
  (table) => [index("idx_posting_batch_document").on(table.documentId)],
);

export const postingEntry = sqliteTable(
  "posting_entry",
  {
    entryId: text("entry_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    batchId: text("batch_id")
      .notNull()
      .references(() => postingBatch.batchId),
    documentLineId: text("document_line_id"),
    variantId: text("variant_id"),
    qtyDelta: numeric("qty_delta"),
    amountDelta: numeric("amount_delta"),
    accountCode: text("account_code"),
    entryType: text("entry_type").notNull(),
    description: text("description"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  },
  (table) => [
    index("idx_posting_entry_batch").on(table.batchId),
    index("idx_posting_entry_document_line").on(table.documentLineId),
    index("idx_posting_entry_variant").on(table.variantId),
  ],
);

// Core Infrastructure

export const sellerTaxRegistrationType = sqliteEnum("seller_tax_registration_type", [
  "domestic",
  "oss",
  "foreign_vat",
]);

export const organization = sqliteTable(
  "organization",
  {
    organizationId: text("organization_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  },
  (table) => [index("organization_slug_key").on(table.slug)],
);

export const company = sqliteTable(
  "company",
  {
    companyId: text("company_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    companyNo: text("company_no").notNull(),
    name: text("name").notNull(),
    legalName: text("legal_name"),
    countryCode: text("country_code").notNull(),
    currencyId: text("currency_id").notNull(),
    vatId: text("vat_id"),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
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
    customAttributes: text("custom_attributes", { mode: "json" }),
    bankName: text("bank_name"),
    bankBic: text("bank_bic"),
    bankIban: text("bank_iban"),
    fiscalYearStartMonth: integer("fiscal_year_start_month").notNull().default(1),
    defaultWarehouseId: text("default_warehouse_id"),
    copyLongTextsOnlyOnChange: integer("copy_long_texts_only_on_change", { mode: "boolean" })
      .notNull()
      .default(true),
    printAddressLongText: integer("print_address_long_text", { mode: "boolean" })
      .notNull()
      .default(false),
    printPreText: integer("print_pre_text", { mode: "boolean" }).notNull().default(false),
    printPostText: integer("print_post_text", { mode: "boolean" }).notNull().default(false),
    printPositionTexts: integer("print_position_texts", { mode: "boolean" })
      .notNull()
      .default(false),
    showArticleImageInEntry: integer("show_article_image_in_entry", { mode: "boolean" })
      .notNull()
      .default(false),
    showArticleImageOnDocuments: integer("show_article_image_on_documents", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (table) => [
    unique("company_tenant_company_id_key").on(table.companyId),
    unique("company_tenant_company_no_unique").on(table.companyNo),
    index("idx_company_tenant_archived").on(table.archived),
    check(
      "company_fiscal_year_start_month_check",
      sql`fiscal_year_start_month >= 1 AND fiscal_year_start_month <= 12`,
    ),
  ],
);

export const sellerTaxRegistration = sqliteTable(
  "seller_tax_registration",
  {
    sellerTaxRegistrationId: text("seller_tax_registration_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    companyId: text("company_id").references(() => company.companyId),
    countryCode: text("country_code").notNull(),
    vatId: text("vat_id"),
    registrationType: sellerTaxRegistrationType("registration_type").notNull(),
    validFrom: text("valid_from").notNull(),
    validTo: text("valid_to"),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  },
  (table) => [
    index("idx_seller_tax_registration_lookup").on(
      table.companyId,
      table.countryCode,
      table.registrationType,
      table.validFrom,
    ),
  ],
);

export const modules = sqliteTable(
  "modules",
  {
    moduleId: text("module_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    slug: text("slug").notNull().unique(),
    label: text("label", { mode: "json" }).notNull(),
  },
  (table) => [index("modules_slug_key").on(table.slug)],
);

export const connectorDefinition = sqliteTable(
  "connector_definition",
  {
    connectorId: text("connector_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    slug: text("slug").notNull().unique(),
    label: text("label", { mode: "json" }).notNull(),
    defaultMappings: text("default_mappings", { mode: "json" }).notNull().default({}),
    lockedFields: text("locked_fields", { mode: "json" }).notNull().default([]),
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

export const systemSettings = sqliteTable(
  "system_settings",
  {
    settingId: text("setting_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    scope: text("scope").notNull(),
    organizationId: text("organization_id"),
    key: text("key").notNull(),
    value: text("value", { mode: "json" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    unique("uq_settings_global").on(table.key),
    unique("uq_settings_org").on(table.organizationId, table.key),
    unique("uq_settings_tenant").on(table.key),
  ],
);

export const accountDeterminationRule = sqliteTable(
  "account_determination_rule",
  {
    ruleId: text("rule_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    companyId: text("company_id").references(() => company.companyId),
    articleGroupId: text("article_group_id"),
    taxCodeId: text("tax_code_id"),
    postingContext: text("posting_context").notNull(),
    glAccountId: text("gl_account_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  },
  (table) => [
    index("idx_acct_det_lookup").on(table.postingContext, table.articleGroupId, table.taxCodeId),
  ],
);

export const addressCategory = sqliteTable(
  "address_category",
  {
    categoryId: text("category_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    name: text("name", { mode: "json" }).notNull(),
    taxClassId: text("tax_class_id").references(() => taxClass.taxClassId),
    paymentTermId: text("payment_term_id").references(() => paymentTerm.paymentTermId),
    currencyId: text("currency_id"),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    customAttributes: text("custom_attributes", { mode: "json" }),
  },
  (table) => [
    unique("address_category_tenant_category_id_key").on(table.categoryId),
    unique("address_category_tenant_name_unique").on(table.name),
  ],
);

export const agent = sqliteTable(
  "agent",
  {
    agentId: text("agent_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    agentNo: text("agent_no").notNull(),
    name: text("name"),
    addressId: text("address_id"),
    userId: text("user_id").references(() => user.id),
    commissionRate: numeric("commission_rate"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
    customAttributes: text("custom_attributes", { mode: "json" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    unique("uq_agent_tenant_no").on(table.agentNo),
    index("idx_agent_address").on(table.addressId),
    index("idx_agent_user").on(table.userId),
  ],
);

export const address = sqliteTable(
  "address",
  {
    addressId: text("address_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    addressNo: text("address_no").notNull(),
    isCustomer: integer("is_customer", { mode: "boolean" }).notNull().default(false),
    isSupplier: integer("is_supplier", { mode: "boolean" }).notNull().default(false),
    companyName: text("company_name"),
    firstName: text("first_name"),
    lastName: text("last_name"),
    notiztext: text("notiztext"),
    notiztextSourceEntity: text("notiztext_source_entity"),
    notiztextSourceId: text("notiztext_source_id"),
    notiztextSourceField: text("notiztext_source_field"),
    notiztextLinkedAt: integer("notiztext_linked_at", { mode: "timestamp_ms" }),
    notiztextOverriddenAt: integer("notiztext_overridden_at", { mode: "timestamp_ms" }),
    langtext: text("langtext"),
    langtextSourceEntity: text("langtext_source_entity"),
    langtextSourceId: text("langtext_source_id"),
    langtextSourceField: text("langtext_source_field"),
    langtextLinkedAt: integer("langtext_linked_at", { mode: "timestamp_ms" }),
    langtextOverriddenAt: integer("langtext_overridden_at", { mode: "timestamp_ms" }),
    warntext: text("warntext"),
    warntextSourceEntity: text("warntext_source_entity"),
    warntextSourceId: text("warntext_source_id"),
    warntextSourceField: text("warntext_source_field"),
    warntextLinkedAt: integer("warntext_linked_at", { mode: "timestamp_ms" }),
    warntextOverriddenAt: integer("warntext_overridden_at", { mode: "timestamp_ms" }),
    addressLine1: text("address_line_1").notNull(),
    addressLine2: text("address_line_2"),
    postalCode: text("postal_code").notNull(),
    city: text("city").notNull(),
    stateProvince: text("state_province"),
    countryCode: text("country_code").notNull(),
    vatId: text("vat_id"),
    taxClassId: text("tax_class_id"),
    currencyId: text("currency_id"),
    paymentTermId: text("payment_term_id"),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
    customAttributes: text("custom_attributes", { mode: "json" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
    defaultDeliveryAddressId: text("default_delivery_address_id"),
    searchText: text("search_text"),
    addressCategoryId: text("address_category_id").references(() => addressCategory.categoryId),
    salutation: text("salutation"),
    phoneLandline: text("phone_landline"),
    phoneFax: text("phone_fax"),
    phoneMobile: text("phone_mobile"),
    email: text("email"),
    homepage: text("homepage"),
    leitwegId: text("leitweg_id"),
    peppolId: text("peppol_id"),
    coordinates: text("coordinates", { mode: "json" }).$type<{ lat: number; lng: number }>(),
    agentId: text("agent_id").references(() => agent.agentId),
    commissionRate: numeric("commission_rate"),
    creditRatingScore: text("credit_rating_score"),
    shopActive: integer("shop_active", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [
    unique("address_tenant_address_id_key").on(table.addressId),
    unique("address_tenant_address_no_unique").on(table.addressNo),
    index("idx_address_category").on(table.addressCategoryId),
    index("idx_address_customer").on(table.isCustomer),
    index("idx_address_supplier").on(table.isSupplier),
    index("idx_address_agent").on(table.agentId),
  ],
);

export const addressContact = sqliteTable(
  "address_contact",
  {
    contactId: text("contact_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    addressId: text("address_id").references(() => address.addressId),
    firstName: text("first_name"),
    lastName: text("last_name").notNull(),
    displayName: text("display_name"),
    notiztext: text("notiztext"),
    notiztextSourceEntity: text("notiztext_source_entity"),
    notiztextSourceId: text("notiztext_source_id"),
    notiztextSourceField: text("notiztext_source_field"),
    notiztextLinkedAt: integer("notiztext_linked_at", { mode: "timestamp_ms" }),
    notiztextOverriddenAt: integer("notiztext_overridden_at", { mode: "timestamp_ms" }),
    email: text("email"),
    phoneMobile: text("phone_mobile"),
    phoneLandline: text("phone_landline"),
    roleFunction: text("role_function"),
    isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    salutation: text("salutation"),
    phoneFax: text("phone_fax"),
    twitterHandle: text("twitter_handle"),
    youtubeUrl: text("youtube_url"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  },
  (table) => [index("idx_address_contact_address").on(table.addressId)],
);

export const addressContactIdentity = sqliteTable(
  "address_contact_identity",
  {
    identityId: text("identity_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    contactId: text("contact_id")
      .notNull()
      .references(() => addressContact.contactId),
    sourceSystem: text("source_system").notNull(),
    sourceAccountId: text("source_account_id"),
    sourceObjectId: text("source_object_id"),
    identityType: text("identity_type").notNull(),
    value: text("value").notNull(),
    normalizedValue: text("normalized_value").notNull(),
    isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
    isVerified: integer("is_verified", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("idx_address_contact_identity_contact").on(table.contactId),
    index("idx_address_contact_identity_value").on(table.value),
    index("idx_address_contact_identity_normalized").on(table.normalizedValue),
  ],
);

export const addressSeq = sqliteTable(
  "address_seq",
  {
    nextVal: integer("next_val").notNull().default(1),
  },
  () => [],
);

export const articleGroup = sqliteTable(
  "article_group",
  {
    articleGroupId: text("article_group_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    code: text("code").notNull(),
    name: text("name").notNull(),
    taxClassId: text("tax_class_id").references(() => taxClass.taxClassId),
    baseUnitId: text("base_unit_id").references(() => unit.unitId),
    salesUnitId: text("sales_unit_id").references(() => unit.unitId),
    purchaseUnitId: text("purchase_unit_id").references(() => unit.unitId),
    trackingMode: text("tracking_mode"),
    bomType: text("bom_type").notNull().default("none"),
    printPositionTexts: integer("print_position_texts", { mode: "boolean" }),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  },
  (table) => [
    unique("article_group_tenant_article_group_id_key").on(table.articleGroupId),
    unique("article_group_tenant_code_unique").on(table.code),
  ],
);

export const article = sqliteTable(
  "article",
  {
    articleId: text("article_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    articleNo: text("article_no").notNull(),
    name: text("name").notNull(),
    notiztext: text("notiztext"),
    langtext: text("langtext"),
    kurzbeschreibung: text("kurzbeschreibung"),
    warntext: text("warntext"),
    notiztextSourceEntity: text("notiztext_source_entity"),
    notiztextSourceId: text("notiztext_source_id"),
    notiztextSourceField: text("notiztext_source_field"),
    notiztextLinkedAt: integer("notiztext_linked_at", { mode: "timestamp_ms" }),
    notiztextOverriddenAt: integer("notiztext_overridden_at", { mode: "timestamp_ms" }),
    langtextSourceEntity: text("langtext_source_entity"),
    langtextSourceId: text("langtext_source_id"),
    langtextSourceField: text("langtext_source_field"),
    langtextLinkedAt: integer("langtext_linked_at", { mode: "timestamp_ms" }),
    langtextOverriddenAt: integer("langtext_overridden_at", { mode: "timestamp_ms" }),
    kurzbeschreibungSourceEntity: text("kurzbeschreibung_source_entity"),
    kurzbeschreibungSourceId: text("kurzbeschreibung_source_id"),
    kurzbeschreibungSourceField: text("kurzbeschreibung_source_field"),
    kurzbeschreibungLinkedAt: integer("kurzbeschreibung_linked_at", { mode: "timestamp_ms" }),
    kurzbeschreibungOverriddenAt: integer("kurzbeschreibung_overridden_at", {
      mode: "timestamp_ms",
    }),
    warntextSourceEntity: text("warntext_source_entity"),
    warntextSourceId: text("warntext_source_id"),
    warntextSourceField: text("warntext_source_field"),
    warntextLinkedAt: integer("warntext_linked_at", { mode: "timestamp_ms" }),
    warntextOverriddenAt: integer("warntext_overridden_at", { mode: "timestamp_ms" }),
    description: text("description"),
    articleGroupId: text("article_group_id").references(() => articleGroup.articleGroupId),
    taxClassId: text("tax_class_id").references(() => taxClass.taxClassId),
    baseUnitId: text("base_unit_id").references(() => unit.unitId),
    salesUnitId: text("sales_unit_id").references(() => unit.unitId),
    purchaseUnitId: text("purchase_unit_id").references(() => unit.unitId),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
    customAttributes: text("custom_attributes", { mode: "json" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
    defaultWarehouseId: text("default_warehouse_id"),
    trackingMode: text("tracking_mode"),
    bomType: text("bom_type").notNull().default("none"),
    printPositionTexts: integer("print_position_texts", { mode: "boolean" }),
    primaryImageId: text("primary_image_id"),
  },
  (table) => [
    unique("article_tenant_article_id_key").on(table.articleId),
    unique("article_tenant_article_no_unique").on(table.articleNo),
    index("idx_article_default_wh").on(table.defaultWarehouseId),
    index("idx_article_group_fk").on(table.articleGroupId),
    index("idx_article_tenant_archived").on(table.archivedAt),
    check("article_bom_type_check", sql`bom_type IN ('none', 'production', 'sales')`),
    check(
      "article_tracking_mode_check",
      sql`tracking_mode IN ('serial', 'batch') OR tracking_mode IS NULL`,
    ),
  ],
);

export const articleBom = sqliteTable(
  "article_bom",
  {
    bomId: text("bom_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    headerArticleId: text("header_article_id")
      .notNull()
      .references(() => article.articleId),
    componentArticleId: text("component_article_id")
      .notNull()
      .references(() => article.articleId),
    quantity: numeric("quantity").notNull(),
    scrapPercentage: numeric("scrap_percentage").notNull().default("0"),
    sortOrder: integer("sort_order").notNull().default(0),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  },
  (table) => [
    unique("article_bom_tenant_header_article_id_component_article_id_un").on(
      table.headerArticleId,
      table.componentArticleId,
    ),
    check("article_bom_quantity_check", sql`quantity > 0`),
  ],
);

export const articleImage = sqliteTable(
  "article_image",
  {
    articleImageId: text("article_image_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    articleId: text("article_id")
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
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  },
  (table) => [
    unique("article_image_tenant_image_id_key").on(table.articleImageId),
    index("idx_article_image_tenant_article").on(table.articleId),
    index("idx_article_image_tenant_archived").on(table.archived),
  ],
);

export const mediaAsset = sqliteTable(
  "media_asset",
  {
    mediaAssetId: text("media_asset_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    storageKey: text("storage_key").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    fileSize: integer("file_size"),
    width: integer("width"),
    height: integer("height"),
    altText: text("alt_text"),
    checksum: text("checksum"),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  },
  (table) => [
    unique("media_asset_tenant_media_asset_id_key").on(table.mediaAssetId),
    unique("media_asset_tenant_storage_key_unique").on(table.storageKey),
    index("idx_media_asset_tenant_archived").on(table.archived),
  ],
);

export const articleMedia = sqliteTable(
  "article_media",
  {
    articleMediaId: text("article_media_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    articleId: text("article_id")
      .notNull()
      .references(() => article.articleId),
    variantId: text("variant_id").references(() => articleVariant.variantId),
    mediaAssetId: text("media_asset_id")
      .notNull()
      .references(() => mediaAsset.mediaAssetId),
    role: text("role").notNull().default("gallery"),
    sortOrder: integer("sort_order").notNull().default(0),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  },
  (table) => [
    unique("article_media_tenant_article_media_id_key").on(table.articleMediaId),
    unique("article_media_tenant_article_media_unique").on(
      table.articleId,
      table.variantId,
      table.mediaAssetId,
      table.role,
    ),
    index("idx_article_media_tenant_article").on(table.articleId),
    index("idx_article_media_tenant_variant").on(table.variantId),
    index("idx_article_media_tenant_asset").on(table.mediaAssetId),
  ],
);

export const category = sqliteTable(
  "category",
  {
    categoryId: text("category_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    parentCategoryId: text("parent_category_id"),
    code: text("code"),
    name: text("name").notNull(),
    slug: text("slug"),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    unique("category_tenant_category_id_key").on(table.categoryId),
    unique("category_tenant_code_unique").on(table.code),
    unique("category_tenant_slug_unique").on(table.slug),
    index("idx_category_parent").on(table.parentCategoryId),
    index("idx_category_tenant_archived").on(table.archived),
  ],
);

export const articleCategory = sqliteTable(
  "article_category",
  {
    articleCategoryId: text("article_category_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    articleId: text("article_id")
      .notNull()
      .references(() => article.articleId),
    categoryId: text("category_id")
      .notNull()
      .references(() => category.categoryId),
    sortOrder: integer("sort_order").notNull().default(0),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  },
  (table) => [
    unique("article_category_tenant_article_category_id_key").on(table.articleCategoryId),
    unique("article_category_tenant_article_category_unique").on(table.articleId, table.categoryId),
    index("idx_article_category_tenant_article").on(table.articleId),
    index("idx_article_category_tenant_category").on(table.categoryId),
  ],
);

export const bankAccount = sqliteTable(
  "bank_account",
  {
    bankAccountId: text("bank_account_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    addressId: text("address_id").references(() => address.addressId),
    iban: text("iban").notNull(),
    bic: text("bic"),
    bankName: text("bank_name"),
    currencyId: text("currency_id"),
    isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    customAttributes: text("custom_attributes", { mode: "json" }),
  },
  (table) => [
    unique("bank_account_tenant_iban_unique").on(table.iban),
    index("idx_bank_account_address").on(table.addressId),
  ],
);

export const costCenter = sqliteTable(
  "cost_center",
  {
    costCenterId: text("cost_center_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    companyId: text("company_id").references(() => company.companyId),
    code: text("code").notNull(),
    name: text("name").notNull(),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  },
  (table) => [
    unique("cost_center_tenant_code_unique").on(table.code),
    unique("cost_center_tenant_cost_center_id_key").on(table.costCenterId),
  ],
);

export const country = sqliteTable(
  "country",
  {
    countryId: text("country_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    iso2Code: text("iso2_code").notNull().unique(),
    iso3Code: text("iso3_code").notNull().unique(),
    name: text("name", { mode: "json" }).notNull(),
    isEu: integer("is_eu", { mode: "boolean" }).notNull().default(false),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  },
  (table) => [
    index("country_iso2_code_key").on(table.iso2Code),
    index("country_iso3_code_key").on(table.iso3Code),
  ],
);

export const currency = sqliteTable(
  "currency",
  {
    currencyId: text("currency_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    code: text("code").notNull().unique(),
    name: text("name", { mode: "json" }).notNull(),
    symbol: text("symbol"),
    decimals: integer("decimals").notNull().default(2),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  },
  (table) => [index("currency_code_key").on(table.code)],
);

export const deliveryAddress = sqliteTable(
  "delivery_address",
  {
    deliveryAddressId: text("delivery_address_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    addressId: text("address_id")
      .notNull()
      .references(() => address.addressId),
    name: text("name"),
    addressLine1: text("address_line_1").notNull(),
    addressLine2: text("address_line_2"),
    postalCode: text("postal_code").notNull(),
    city: text("city").notNull(),
    countryCode: text("country_code").notNull(),
    defaultForShipping: integer("default_for_shipping", { mode: "boolean" }).default(false),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    customAttributes: text("custom_attributes", { mode: "json" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  },
  (table) => [index("idx_delivery_address_partner").on(table.addressId)],
);

export const discountGroup = sqliteTable(
  "discount_group",
  {
    discountGroupId: text("discount_group_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    name: text("name").notNull(),
    percentage: numeric("percentage").notNull(),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  },
  (table) => [unique("discount_group_tenant_name_unique").on(table.name)],
);

export const documentType = sqliteTable(
  "document_type",
  {
    documentTypeId: text("document_type_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    code: text("code").notNull(),
    name: text("name").notNull(),
    movementType: text("movement_type").notNull(),
    nextDocumentTypeId: text("next_document_type_id"),
    requiresWarehouse: integer("requires_warehouse", { mode: "boolean" }).notNull().default(true),
    requiresCostCenter: integer("requires_cost_center", { mode: "boolean" })
      .notNull()
      .default(false),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  },
  (table) => [
    unique("document_type_tenant_code_unique").on(table.code),
    unique("document_type_tenant_document_type_id_key").on(table.documentTypeId),
    check(
      "document_type_movement_type_check",
      sql`movement_type IN ('N', 'A', 'L', 'R', 'G', 'b', 'l', 'r', 'g', 'Z', 'E', 'V', 'q', 'p', 'U')`,
    ),
  ],
);

export const documentGroup = sqliteTable(
  "document_group",
  {
    documentGroupId: text("document_group_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    name: text("name").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    numberSequenceId: text("number_sequence_id"),
    description: text("description"),
    defaultWarehouseId: text("default_warehouse_id"),
    defaultTaxCodeId: text("default_tax_code_id"),
    defaultSalesAccountId: text("default_sales_account_id"),
    defaultCostAccountId: text("default_cost_account_id"),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    sortOrder: integer("sort_order").default(0),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
    defaultPaymentTermId: text("default_payment_term_id"),
    defaultShippingMethodId: text("default_shipping_method_id"),
    requireSerialTracking: integer("require_serial_tracking", { mode: "boolean" })
      .notNull()
      .default(true),
    requireBatchTracking: integer("require_batch_tracking", { mode: "boolean" })
      .notNull()
      .default(true),
    documentType: text("document_type").notNull(),
    groupNumber: integer("group_number").notNull(),
    direction: text("direction"),
    nextGroupId: text("next_group_id"),
    companyId: text("company_id").references(() => company.companyId),
  },
  (table) => [
    unique("document_group_tenant_document_group_id_key").on(table.documentGroupId),
    unique("document_group_tenant_document_type_group_number_unique").on(
      table.documentType,
      table.groupNumber,
    ),
    index("idx_document_group_company").on(table.companyId),
    check("document_group_group_number_check", sql`group_number >= 0 AND group_number <= 99`),
  ],
);

export const document = sqliteTable(
  "document",
  {
    documentId: text("document_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    companyId: text("company_id")
      .notNull()
      .references(() => company.companyId),
    documentType: text("document_type").notNull(),
    documentDirection: text("document_direction").notNull(),
    documentNo: text("document_no").notNull(),
    status: text("status").notNull(),
    customerId: text("customer_id").references(() => address.addressId),
    currencyId: text("currency_id"),
    printOptions: text("print_options", { mode: "json" }),
    documentDate: text("document_date").notNull(),
    postingDate: text("posting_date"),
    totalNet: numeric("total_net"),
    totalTax: numeric("total_tax"),
    totalGross: numeric("total_gross"),
    versionNo: integer("version_no").notNull().default(1),
    postedAt: integer("posted_at", { mode: "timestamp_ms" }),
    postedBy: text("posted_by"),
    cancelledAt: integer("cancelled_at", { mode: "timestamp_ms" }),
    stornoDocumentId: text("storno_document_id"),
    customAttributes: text("custom_attributes", { mode: "json" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
    transactionId: text("transaction_id").notNull(),
    parentDocumentId: text("parent_document_id"),
    documentGroupId: text("document_group_id").references(() => documentGroup.documentGroupId),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
    billingAddress: text("billing_address", { mode: "json" }),
    deliveryAddress: text("delivery_address", { mode: "json" }),
    deliveryAddressId: text("delivery_address_id").references(
      () => deliveryAddress.deliveryAddressId,
    ),
    noteText: text("note_text"),
    noteTextSourceEntity: text("note_text_source_entity"),
    noteTextSourceId: text("note_text_source_id"),
    noteTextSourceField: text("note_text_source_field"),
    noteTextLinkedAt: integer("note_text_linked_at", { mode: "timestamp_ms" }),
    noteTextOverriddenAt: integer("note_text_overridden_at", { mode: "timestamp_ms" }),
    preText: text("pre_text"),
    preTextSourceEntity: text("pre_text_source_entity"),
    preTextSourceId: text("pre_text_source_id"),
    preTextSourceField: text("pre_text_source_field"),
    preTextLinkedAt: integer("pre_text_linked_at", { mode: "timestamp_ms" }),
    preTextOverriddenAt: integer("pre_text_overridden_at", { mode: "timestamp_ms" }),
    postText: text("post_text"),
    postTextSourceEntity: text("post_text_source_entity"),
    postTextSourceId: text("post_text_source_id"),
    postTextSourceField: text("post_text_source_field"),
    postTextLinkedAt: integer("post_text_linked_at", { mode: "timestamp_ms" }),
    postTextOverriddenAt: integer("post_text_overridden_at", { mode: "timestamp_ms" }),
    stornoText: text("storno_text"),
    stornoTextSourceEntity: text("storno_text_source_entity"),
    stornoTextSourceId: text("storno_text_source_id"),
    stornoTextSourceField: text("storno_text_source_field"),
    stornoTextLinkedAt: integer("storno_text_linked_at", { mode: "timestamp_ms" }),
    stornoTextOverriddenAt: integer("storno_text_overridden_at", { mode: "timestamp_ms" }),
    paymentTermId: text("payment_term_id"),
    shippingMethodId: text("shipping_method_id"),
    documentTypeId: text("document_type_id").references(() => documentType.documentTypeId),
    warehouseId: text("warehouse_id"),
    targetWarehouseId: text("target_warehouse_id"),
    isPaid: integer("is_paid", { mode: "boolean" }).notNull().default(false),
    paidAt: integer("paid_at", { mode: "timestamp_ms" }),
    paidAmount: numeric("paid_amount"),
    totalWeightKg: numeric("total_weight_kg"),
    agentId: text("agent_id").references(() => agent.agentId),
    commissionRate: numeric("commission_rate"),
  },
  (table) => [
    unique("document_tenant_company_id_document_no_unique").on(table.companyId, table.documentNo),
    unique("document_tenant_document_id_key").on(table.documentId),
    index("idx_document_company").on(table.companyId),
    index("idx_document_customer").on(table.customerId),
    index("idx_document_delivery_address").on(table.deliveryAddressId),
    index("idx_document_group").on(table.documentGroupId),
    index("idx_document_group_type").on(table.documentGroupId, table.documentTypeId),
    index("idx_document_parent").on(table.parentDocumentId),
    index("idx_document_payment_term").on(table.paymentTermId),
    index("idx_document_posted_at").on(table.postedAt),
    index("idx_document_shipping_method").on(table.shippingMethodId),
    index("idx_document_transaction").on(table.transactionId),
    index("idx_document_type_status").on(table.documentType, table.status),
    index("idx_document_warehouse").on(table.warehouseId),
    index("idx_document_agent").on(table.agentId),
    check(
      "chk_document_type",
      sql`document_type IN ('N', 'A', 'L', 'R', 'G', 'b', 'l', 'r', 'g', 'Z', 'E', 'V', 'q', 'p', 'U')`,
    ),
  ],
);

export const documentLine = sqliteTable(
  "document_line",
  {
    documentLineId: text("document_line_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    documentId: text("document_id")
      .notNull()
      .references(() => document.documentId),
    lineNo: integer("line_no").notNull(),
    variantId: text("variant_id").references(() => articleVariant.variantId),
    articleTextSnapshot: text("article_text_snapshot"),
    langText: text("lang_text"),
    langTextSourceEntity: text("lang_text_source_entity"),
    langTextSourceId: text("lang_text_source_id"),
    langTextSourceField: text("lang_text_source_field"),
    langTextLinkedAt: integer("lang_text_linked_at", { mode: "timestamp_ms" }),
    langTextOverriddenAt: integer("lang_text_overridden_at", { mode: "timestamp_ms" }),
    quantity: numeric("quantity").notNull(),
    unit: text("unit"),
    netPrice: numeric("net_price").notNull(),
    discountPercentage: numeric("discount_percentage"),
    taxCodeId: text("tax_code_id"),
    taxReason: text("tax_reason"),
    taxRuleId: text("tax_rule_id").references(() => taxRule.taxRuleId),
    taxCountryCodeUsed: text("tax_country_code_used"),
    taxRateSnapshot: numeric("tax_rate_snapshot"),
    taxAmount: numeric("tax_amount"),
    lineTotalNet: numeric("line_total_net"),
    warehouseId: text("warehouse_id"),
    costCenterId: text("cost_center_id").references(() => costCenter.costCenterId),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
    transactionId: text("transaction_id"),
    movementType: text("movement_type"),
    lineType: text("line_type").notNull().default("article"),
    bomGroupId: text("bom_group_id"),
    lineWeightKg: numeric("line_weight_kg"),
  },
  (table) => [
    unique("document_line_tenant_document_id_line_no_unique").on(
      table.documentId,
      table.lineNo,
      table.archivedAt,
    ),
    unique("document_line_tenant_document_line_id_key").on(table.documentLineId),
    index("idx_document_line_article").on(table.variantId),
    index("idx_document_line_variant").on(table.variantId),
    index("idx_document_line_document").on(table.documentId),
    index("idx_document_line_tenant_document").on(table.documentId),
    index("idx_document_line_tenant_archived").on(table.archivedAt),
    index("idx_document_line_tx").on(table.transactionId),
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

export const documentLineAllocation = sqliteTable(
  "document_line_allocation",
  {
    allocationId: text("allocation_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    sourceDocumentLineId: text("source_document_line_id")
      .notNull()
      .references(() => documentLine.documentLineId),
    targetDocumentLineId: text("target_document_line_id")
      .notNull()
      .references(() => documentLine.documentLineId),
    allocatedQty: numeric("allocated_qty").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  },
  (table) => [
    unique("document_line_allocation_source_target_unique").on(
      table.sourceDocumentLineId,
      table.targetDocumentLineId,
    ),
    index("idx_dla_source").on(table.sourceDocumentLineId),
    index("idx_dla_target").on(table.targetDocumentLineId),
  ],
);

export const documentLineTracking = sqliteTable(
  "document_line_tracking",
  {
    trackingId: text("tracking_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    documentLineId: text("document_line_id")
      .notNull()
      .references(() => documentLine.documentLineId),
    serialNumberId: text("serial_number_id"),
    serialNo: text("serial_no"),
    batchNo: text("batch_no"),
    qty: numeric("qty").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  },
  (_table) => [
    index("idx_document_line_tracking_tenant_line").on(_table.documentLineId),
    index("idx_document_line_tracking_tenant_created").on(_table.documentLineId, _table.createdAt),
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

export const entityCommands = sqliteTable(
  "entity_commands",
  {
    commandId: text("command_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    scope: text("scope").notNull().default("global"),
    organizationId: text("organization_id").references(() => organization.organizationId),
    entityName: text("entity_name").notNull(),
    commandKey: text("command_key").notNull(),
    handlerkey: text("handlerkey"),
    label: text("label", { mode: "json" }).notNull(),
    description: text("description", { mode: "json" }),
    httpMethod: text("http_method").notNull().default("POST"),
    routePattern: text("route_pattern").notNull(),
    entityIdParam: text("entity_id_param"),
    parentEntity: text("parent_entity"),
    parentIdSource: text("parent_id_source"),
    inputSchema: text("input_schema", { mode: "json" }).notNull().default({}),
    serverManaged: text("server_managed", { mode: "json" }).notNull().default([]),
    uiPlacement: text("ui_placement"),
    uiIcon: text("ui_icon"),
    uiShortcut: text("ui_shortcut"),
    uiConfirm: text("ui_confirm", { mode: "json" }),
    writesTables: text("writes_tables", { mode: "json" }).notNull().default([]),
    sideEffects: text("side_effects", { mode: "json" }).notNull().default([]),
    minRole: text("min_role").notNull().default("tenant_user"),
    visibility: text("visibility").notNull().default("tenant"),
    commandState: text("command_state").notNull().default("published"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  },
  (table) => [
    unique("entity_commands_scope_organization_id_tenant_entity_name_com").on(
      table.scope,
      table.organizationId,
      table.entityName,
      table.commandKey,
    ),
    index("idx_entity_commands_entity").on(table.entityName, table.commandState),
    index("idx_entity_commands_org").on(table.organizationId),
  ],
);

export const factSalesEvent = sqliteTable(
  "fact_sales_event",
  {
    factSalesEventId: text("fact_sales_event_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    companyId: text("company_id").references(() => company.companyId),
    sourceDocumentId: text("source_document_id").references(() => document.documentId),
    sourceDocumentLineId: text("source_document_line_id").references(
      () => documentLine.documentLineId,
    ),
    customerId: text("customer_id").references(() => address.addressId),
    articleId: text("article_id").references(() => article.articleId),
    variantId: text("variant_id").references(() => articleVariant.variantId),
    eventType: text("event_type"),
    quantityDelta: numeric("quantity_delta").notNull(),
    amountNetDelta: numeric("amount_net_delta").notNull(),
    bookingPeriod: text("booking_period").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    transactionId: text("transaction_id"),
    cogsDelta: numeric("cogs_delta"),
    fiscalPeriodId: text("fiscal_period_id"),
  },
  (table) => [
    index("idx_fact_sales_article").on(table.articleId),
    index("idx_fact_sales_variant").on(table.variantId),
    index("idx_fact_sales_customer").on(table.customerId),
    index("idx_fact_sales_period").on(table.bookingPeriod),
    index("idx_fact_sales_tx").on(table.transactionId),
  ],
);

export const glAccount = sqliteTable(
  "gl_account",
  {
    glAccountId: text("gl_account_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    companyId: text("company_id").references(() => company.companyId),
    accountNo: text("account_no").notNull(),
    name: text("name").notNull(),
    accountType: text("account_type").notNull(),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  },
  (table) => [
    unique("gl_account_tenant_account_no_unique").on(table.accountNo),
    unique("gl_account_tenant_gl_account_id_key").on(table.glAccountId),
  ],
);

export const helperTableRegistry = sqliteTable("helper_table_registry", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  tableName: text("table_name").notNull().unique(),
  label: text("label", { mode: "json" }).notNull(),
  pkColumn: text("pk_column").notNull(),
  displayColumn: text("display_column").notNull(),
  displayIsI18n: integer("display_is_i18n", { mode: "boolean" }).notNull().default(false),
  codeColumn: text("code_column"),
  isTenantScoped: integer("is_tenant_scoped", { mode: "boolean" }).notNull().default(false),
  defaultFilter: text("default_filter", { mode: "json" }),
  sortColumn: text("sort_column").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  valueColumn: text("value_column"),
  group: text("group"),
  category: text("category"),
});

export const importBatch = sqliteTable(
  "import_batch",
  {
    batchId: text("batch_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    connectorId: text("connector_id"),
    profileId: text("profile_id").references(() => importProfile.profileId),
    mappingVersionId: text("mapping_version_id").references(
      () => importProfileMappingVersion.versionId,
    ),
    atomicityMode: text("atomicity_mode").notNull(),
    status: text("status").notNull().default("pending"),
    isDryRun: integer("is_dry_run", { mode: "boolean" }).notNull().default(true),
    isRerun: integer("is_rerun", { mode: "boolean" }).notNull().default(false),
    sourceBatchId: text("source_batch_id"),
    sourceFileName: text("source_file_name"),
    postedEntityCount: integer("posted_entity_count").notNull().default(0),
    failedEntityCount: integer("failed_entity_count").notNull().default(0),
    pendingReferenceCount: integer("pending_reference_count").notNull().default(0),
    errorSummary: text("error_summary", { mode: "json" }),
    filePath: text("file_path"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    processedAt: integer("processed_at", { mode: "timestamp_ms" }),
    targetEntity: text("target_entity"),
    targetCommandKey: text("target_command_key"),
    layoutId: text("layout_id").references(() => buerowareRecordLayout.layoutId),
  },
  (_table) => [
    check("import_batch_atomicity_mode_check", sql`atomicity_mode IN ('file', 'entity', 'run')`),
    check(
      "import_batch_status_check",
      sql`status IN ('pending', 'queued', 'processing', 'validating', 'validated', 'approved', 'posted', 'failed', 'rejected')`,
    ),
  ],
);

export const importRow = sqliteTable(
  "import_row",
  {
    rowId: text("row_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    batchId: text("batch_id")
      .notNull()
      .references(() => importBatch.batchId),
    targetEntity: text("target_entity").notNull(),
    payload: text("payload", { mode: "json" }).notNull(),
    status: text("status").notNull().default("pending"),
    missingReferences: text("missing_references", { mode: "json" }),
    errorDetail: text("error_detail", { mode: "json" }),
    postedAt: integer("posted_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    check(
      "import_row_status_check",
      sql`status IN ('pending', 'valid', 'posted', 'failed', 'pending_references')`,
    ),
    index("idx_import_row_batch_status").on(table.batchId, table.status),
  ],
);

export const importProfile = sqliteTable(
  "import_profile",
  {
    profileId: text("profile_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    slug: text("slug").notNull(),
    label: text("label").notNull(),
    targetEntity: text("target_entity").notNull(),
    targetCommandKey: text("target_command_key").notNull(),
    requiresApproval: integer("requires_approval", { mode: "boolean" }).notNull().default(true),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  },
  (table) => [unique("uq_import_profile_tenant_slug").on(table.slug)],
);

export const importProfileMappingVersion = sqliteTable(
  "import_profile_mapping_version",
  {
    versionId: text("version_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    tenantConnectorId: text("tenant_connector_id").references(
      () => tenantConnector.tenantConnectorId,
    ),
    profileId: text("profile_id").references(() => importProfile.profileId),
    sourceSystem: text("source_system"),
    sourceFileName: text("source_file_name"),
    targetEntity: text("target_entity"),
    layoutId: text("layout_id").references(() => buerowareRecordLayout.layoutId),
    versionNo: integer("version_no").notNull().default(1),
    mappings: text("mappings", { mode: "json" }).notNull(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(false),
    activatedAt: integer("activated_at", { mode: "timestamp_ms" }),
    activatedBy: text("activated_by"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
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

export const importFieldMapping = sqliteTable(
  "import_field_mapping",
  {
    mappingId: text("mapping_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    versionId: text("version_id")
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
    isRequired: integer("is_required", { mode: "boolean" }).notNull().default(false),
    defaultValue: text("default_value"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  },
  (table) => [index("idx_field_mapping_version").on(table.versionId)],
);

// ─── Büroware Satzbeschreibung catalog (global reference data, not tenant-scoped) ───
// One row per data area = (file, Satzkürzel/Datenbereich). A file may expose several
// data areas (e.g. S_RART_R00.SEDB → Artikel `S`, Warengruppe `W`, Lager `l`).
export const buerowareRecordLayout = sqliteTable(
  "bueroware_record_layout",
  {
    layoutId: text("layout_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    fileName: text("file_name").notNull(), // normalized UPPERCASE, e.g. S_RART_R00.SEDB
    dataArea: text("data_area").notNull(), // Datenbereich, e.g. "Artikel"
    qualifier: text("qualifier"), // Satzkürzel ('S','W','l',...); '*' is stored as NULL (unqualified)
    defaultTargetEntity: text("default_target_entity"), // suggested platform entity
    catalogVersion: integer("catalog_version").notNull().default(1),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    fieldCount: integer("field_count").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
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
export const buerowareRecordField = sqliteTable(
  "bueroware_record_field",
  {
    fieldId: text("field_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    layoutId: text("layout_id")
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
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  },
  (table) => [index("idx_bueroware_field_layout").on(table.layoutId)],
);

export const incoterm = sqliteTable(
  "incoterm",
  {
    incotermId: text("incoterm_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  },
  (table) => [index("incoterm_code_key").on(table.code)],
);

export const industry = sqliteTable(
  "industry",
  {
    industryId: text("industry_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    name: text("name", { mode: "json" }).notNull(),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    customAttributes: text("custom_attributes", { mode: "json" }),
  },
  (table) => [unique("industry_tenant_name_unique").on(table.name)],
);

export const warehouse = sqliteTable(
  "warehouse",
  {
    warehouseId: text("warehouse_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    companyId: text("company_id").references(() => company.companyId),
    code: text("code").notNull(),
    name: text("name").notNull(),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  },
  (table) => [
    unique("warehouse_tenant_code_unique").on(table.code),
    unique("warehouse_tenant_warehouse_id_key").on(table.warehouseId),
  ],
);

export const inventoryBalance = sqliteTable(
  "inventory_balance",
  {
    inventoryBalanceId: text("inventory_balance_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    companyId: text("company_id").references(() => company.companyId),
    warehouseId: text("warehouse_id")
      .notNull()
      .references(() => warehouse.warehouseId),
    inventoryItemId: text("inventory_item_id").references(() => inventoryItem.itemId),
    // articleId is kept nullable for backfill compatibility; canonical reads anchor on inventoryItemId.
    articleId: text("article_id").references(() => article.articleId),
    onHandQty: numeric("on_hand_qty").notNull().default("0"),
    reservedQty: numeric("reserved_qty").notNull().default("0"),
    asOfAt: integer("as_of_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    availableQty: numeric("available_qty"),
    expectedPurchaseQty: numeric("expected_purchase_qty").notNull().default("0"),
    gldPurchase: numeric("gld_purchase"),
    gldCost: numeric("gld_cost"),
  },
  (table) => [
    unique("inventory_balance_tenant_warehouse_id_item_unique").on(
      table.warehouseId,
      table.inventoryItemId,
    ),
    index("idx_inv_balance_lookup").on(table.warehouseId, table.inventoryItemId),
    index("idx_inv_balance_article").on(table.warehouseId, table.articleId),
  ],
);

export const inventoryMovement = sqliteTable(
  "inventory_movement",
  {
    inventoryMovementId: text("inventory_movement_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    companyId: text("company_id").references(() => company.companyId),
    warehouseId: text("warehouse_id")
      .notNull()
      .references(() => warehouse.warehouseId),
    inventoryItemId: text("inventory_item_id")
      .notNull()
      .references(() => inventoryItem.itemId),
    variantId: text("variant_id").references(() => articleVariant.variantId),
    movementType: text("movement_type").notNull(),
    qtyDelta: numeric("qty_delta"),
    movementDate: integer("movement_date", { mode: "timestamp_ms" }).notNull(),
    sourceDocumentId: text("source_document_id").references(() => document.documentId),
    sourceDocumentLineId: text("source_document_line_id").references(
      () => documentLine.documentLineId,
    ),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    transactionId: text("transaction_id"),
    absoluteQty: numeric("absolute_qty"),
    referenceText: text("reference_text"),
    serialNumberId: text("serial_number_id"),
    batchNo: text("batch_no"),
  },
  (table) => [
    index("idx_inv_movement_date").on(table.movementDate),
    index("idx_inv_movement_inventory_item_anchor").on(
      table.warehouseId,
      table.inventoryItemId,
      table.variantId,
      table.movementDate,
    ),
    index("idx_inv_movement_inventory_item").on(table.inventoryItemId, table.movementDate),
    index("idx_inv_movement_variant").on(table.variantId, table.movementDate),
    index("idx_inv_movement_tx").on(table.transactionId),
    index("idx_inv_movement_warehouse_inventory_item").on(table.warehouseId, table.inventoryItemId),
    index("idx_inventory_movement_batch_balance").on(
      table.warehouseId,
      table.variantId,
      table.batchNo,
    ),
    index("idx_inventory_movement_batch_balance_item").on(
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

export const journalEntry = sqliteTable(
  "journal_entry",
  {
    journalEntryId: text("journal_entry_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    companyId: text("company_id")
      .notNull()
      .references(() => company.companyId),
    postingDate: text("posting_date").notNull(),
    sourceDocumentId: text("source_document_id").references(() => document.documentId),
    description: text("description"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  },
  (table) => [
    unique("journal_entry_tenant_journal_entry_id_key").on(table.journalEntryId),
    index("idx_journal_entry_company").on(table.companyId),
    index("idx_journal_entry_date").on(table.postingDate),
    index("idx_journal_entry_document").on(table.sourceDocumentId),
  ],
);

export const journalLine = sqliteTable(
  "journal_line",
  {
    journalLineId: text("journal_line_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    companyId: text("company_id")
      .notNull()
      .references(() => company.companyId),
    journalEntryId: text("journal_entry_id")
      .notNull()
      .references(() => journalEntry.journalEntryId),
    glAccountId: text("gl_account_id")
      .notNull()
      .references(() => glAccount.glAccountId),
    debitAmount: numeric("debit_amount").notNull().default("0"),
    creditAmount: numeric("credit_amount").notNull().default("0"),
    costCenterId: text("cost_center_id").references(() => costCenter.costCenterId),
    taxCodeId: text("tax_code_id").references(() => taxCode.taxCodeId),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  },
  (table) => [
    index("idx_journal_line_account").on(table.glAccountId),
    index("idx_journal_line_entry").on(table.journalEntryId),
    check(
      "chk_debit_or_credit",
      sql`(debit_amount > 0 AND credit_amount = 0) OR (credit_amount > 0 AND debit_amount = 0)`,
    ),
  ],
);

export const numberSequence = sqliteTable(
  "number_sequence",
  {
    numberSequenceId: text("number_sequence_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    companyId: text("company_id")
      .notNull()
      .references(() => company.companyId),
    prefix: text("prefix").notNull(),
    fiscalYear: integer("fiscal_year"),
    nextValue: integer("next_value").notNull().default(1),
    padding: integer("padding").notNull().default(5),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    unique("number_sequence_tenant_company_id_prefix_year_unique").on(
      table.companyId,
      table.prefix,
      table.fiscalYear,
    ),
    unique("number_sequence_tenant_number_sequence_id_unique").on(table.numberSequenceId),
    index("idx_number_sequence_tenant_company").on(table.companyId),
  ],
);

export const paymentTerm = sqliteTable(
  "payment_term",
  {
    paymentTermId: text("payment_term_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    name: text("name", { mode: "json" }).notNull(),
    netDays: integer("net_days").notNull(),
    discountDays: integer("discount_days"),
    discountPercentage: numeric("discount_percentage"),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    customAttributes: text("custom_attributes", { mode: "json" }),
  },
  (table) => [
    unique("payment_term_tenant_name_unique").on(table.name),
    unique("payment_term_tenant_payment_term_id_key").on(table.paymentTermId),
  ],
);

export const postalCode = sqliteTable(
  "postal_code",
  {
    postalCodeId: text("postal_code_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    countryCode: text("country_code").notNull(),
    plz: text("plz").notNull(),
    city: text("city").notNull(),
    state: text("state"),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
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

export const priceList = sqliteTable(
  "price_list",
  {
    priceListId: text("price_list_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    name: text("name").notNull(),
    currencyId: text("currency_id").notNull(),
    isNet: integer("is_net", { mode: "boolean" }).notNull().default(true),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  },
  (table) => [
    unique("price_list_tenant_name_unique").on(table.name),
    unique("price_list_tenant_price_list_id_key").on(table.priceListId),
  ],
);

export const priceListItem = sqliteTable(
  "price_list_item",
  {
    priceListItemId: text("price_list_item_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    priceListId: text("price_list_id")
      .notNull()
      .references(() => priceList.priceListId),
    articleId: text("article_id").references(() => article.articleId),
    // Pricing is variant-specific; articleId is retained only for compatibility with older imports.
    variantId: text("variant_id")
      .notNull()
      .references(() => articleVariant.variantId),
    price: numeric("price").notNull(),
    validFrom: text("valid_from"),
    validTo: text("valid_to"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  },
  (table) => [
    unique("price_list_item_tenant_price_list_id_article_variant_valid_from_u").on(
      table.priceListId,
      table.variantId,
      table.validFrom,
    ),
    index("idx_price_list_item_variant").on(table.priceListId, table.variantId, table.validFrom),
  ],
);

export const productionOrder = sqliteTable(
  "production_order",
  {
    productionOrderId: text("production_order_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    companyId: text("company_id").references(() => company.companyId),
    orderNo: text("order_no").notNull(),
    articleId: text("article_id").references(() => article.articleId),
    quantity: integer("quantity").notNull().default(0),
    status: text("status").notNull().default("planned"),
    plannedStartDate: text("planned_start_date"),
    plannedEndDate: text("planned_end_date"),
    actualStartDate: text("actual_start_date"),
    actualEndDate: text("actual_end_date"),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    unique("production_order_tenant_order_no_unique").on(table.orderNo),
    index("idx_production_order_article").on(table.articleId),
    index("idx_production_order_status").on(table.status),
  ],
);

export const schemaAnnotations = sqliteTable(
  "schema_annotations",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    tableName: text("table_name").notNull(),
    columnName: text("column_name").notNull().default(""),
    businessName: text("business_name").notNull(),
    description: text("description").notNull(),
    dataClass: text("data_class").notNull(),
    moduleId: text("module_id"),
    mandatoryFor: text("mandatory_for", { mode: "json" }).notNull().default([]),
    lockedFor: text("locked_for", { mode: "json" }).notNull().default([]),
    aiGeneratedAt: integer("ai_generated_at", { mode: "timestamp_ms" }),
    humanOverride: integer("human_override", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [
    unique("schema_annotations_table_name_column_name_unique").on(
      table.tableName,
      table.columnName,
    ),
  ],
);

export const serialNumber = sqliteTable(
  "serial_number",
  {
    serialNumberId: text("serial_number_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    articleId: text("article_id")
      .notNull()
      .references(() => article.articleId),
    serialNo: text("serial_no").notNull(),
    status: text("status").notNull().default("in_stock"),
    createdMovementId: text("created_movement_id").references(
      () => inventoryMovement.inventoryMovementId,
    ),
    consumedMovementId: text("consumed_movement_id").references(
      () => inventoryMovement.inventoryMovementId,
    ),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  },
  (table) => [
    unique("serial_number_tenant_article_id_serial_no_unique").on(table.articleId, table.serialNo),
    unique("serial_number_tenant_serial_number_id_key").on(table.serialNumberId),
    check("serial_number_status_check", sql`status IN ('in_stock', 'reserved', 'sold')`),
  ],
);

export const shippingMethod = sqliteTable(
  "shipping_method",
  {
    shippingMethodId: text("shipping_method_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    name: text("name", { mode: "json" }).notNull(),
    trackingUrlTemplate: text("tracking_url_template"),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    customAttributes: text("custom_attributes", { mode: "json" }),
  },
  (table) => [
    unique("shipping_method_tenant_name_unique").on(table.name),
    unique("shipping_method_tenant_shipping_method_id_key").on(table.shippingMethodId),
  ],
);

export const taxClass = sqliteTable(
  "tax_class",
  {
    taxClassId: text("tax_class_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    code: text("code").notNull(),
    name: text("name", { mode: "json" }).notNull(),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    customAttributes: text("custom_attributes", { mode: "json" }),
  },
  (table) => [unique("tax_class_tenant_code_unique").on(table.code)],
);

export const taxCode = sqliteTable(
  "tax_code",
  {
    taxCodeId: text("tax_code_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    code: text("code").notNull(),
    description: text("description"),
    taxRate: numeric("tax_rate").notNull(),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  },
  (table) => [
    unique("tax_code_tenant_code_unique").on(table.code),
    unique("tax_code_tenant_tax_code_id_key").on(table.taxCodeId),
  ],
);

export const taxRule = sqliteTable(
  "tax_rule",
  {
    taxRuleId: text("tax_rule_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    customerTaxClassId: text("customer_tax_class_id").references(() => taxClass.taxClassId),
    articleTaxClassId: text("article_tax_class_id").references(() => taxClass.taxClassId),
    countryCode: text("country_code"),
    taxCodeId: text("tax_code_id")
      .notNull()
      .references(() => taxCode.taxCodeId),
    validFrom: text("valid_from").notNull(),
    validTo: text("valid_to"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  },
  (table) => [
    index("idx_tax_rule_lookup").on(
      table.customerTaxClassId,
      table.articleTaxClassId,
      table.countryCode,
      table.validFrom,
    ),
  ],
);

export const tenantConnector = sqliteTable(
  "tenant_connector",
  {
    tenantConnectorId: text("tenant_connector_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    connectorId: text("connector_id")
      .notNull()
      .references(() => connectorDefinition.connectorId),
    credentials: text("credentials", { mode: "json" }).notNull().default({}),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  },
  (table) => [
    unique("tenant_connector_tenant_tenant_connector_id_key").on(table.tenantConnectorId),
  ],
);

export const tenantConnectorMapping = sqliteTable(
  "tenant_connector_mapping",
  {
    mappingId: text("mapping_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    tenantConnectorId: text("tenant_connector_id")
      .notNull()
      .references(() => tenantConnector.tenantConnectorId),
    profileId: text("profile_id")
      .notNull()
      .references(() => importProfile.profileId),
    sourceField: text("source_field").notNull(),
    targetTable: text("target_table").notNull(),
    targetColumn: text("target_column").notNull(),
    transform: text("transform", { mode: "json" }).notNull().default({ type: "direct" }),
    defaultValue: text("default_value", { mode: "json" }),
  },
  (table) => [
    unique("uq_tenant_connector_mapping_connector_profile_field").on(
      table.tenantConnectorId,
      table.profileId,
      table.sourceField,
    ),
  ],
);

export const tenantFields = sqliteTable(
  "tenant_fields",
  {
    fieldId: text("field_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    scope: text("scope").notNull().default("tenant"),
    organizationId: text("organization_id").references(() => organization.organizationId),
    entityName: text("entity_name").notNull(),
    fieldName: text("field_name").notNull(),
    fieldType: text("field_type").notNull(),
    isRequired: integer("is_required", { mode: "boolean" }).notNull().default(false),
    customAttributes: text("custom_attributes", { mode: "json" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    label: text("label", { mode: "json" }),
    helpText: text("help_text", { mode: "json" }),
    isVisible: integer("is_visible", { mode: "boolean" }).notNull().default(true),
    displayOrder: integer("display_order"),
    importColumn: text("import_column"),
    importType: text("import_type"),
    importRequired: integer("import_required", { mode: "boolean" }).notNull().default(false),
    importTransform: text("import_transform"),
    groupId: text("group_id"),
    lookupTable: text("lookup_table"),
    lookupFilter: text("lookup_filter", { mode: "json" }),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [
    uniqueIndex("uq_fields_global")
      .on(table.entityName, table.fieldName)
      .where(sql`scope = 'global'`),
    uniqueIndex("uq_fields_org")
      .on(table.organizationId, table.entityName, table.fieldName)
      .where(sql`scope = 'org'`),
    uniqueIndex("uq_fields_tenant")
      .on(table.entityName, table.fieldName)
      .where(sql`scope = 'tenant'`),
  ],
);

export const tenantGroups = sqliteTable(
  "tenant_groups",
  {
    groupId: text("group_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    scope: text("scope").notNull().default("tenant"),
    organizationId: text("organization_id").references(() => organization.organizationId),
    entityName: text("entity_name").notNull(),
    groupKey: text("group_key").notNull(),
    label: text("label", { mode: "json" }).notNull(),
    displayOrder: integer("display_order").notNull().default(0),
    isVisible: integer("is_visible", { mode: "boolean" }).notNull().default(true),
    customAttributes: text("custom_attributes", { mode: "json" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  },
  (table) => [
    uniqueIndex("uq_groups_global")
      .on(table.entityName, table.groupKey)
      .where(sql`scope = 'global'`),
    uniqueIndex("uq_groups_org")
      .on(table.organizationId, table.entityName, table.groupKey)
      .where(sql`scope = 'org'`),
    uniqueIndex("uq_groups_tenant")
      .on(table.entityName, table.groupKey)
      .where(sql`scope = 'tenant'`),
  ],
);

export const tenantLayouts = sqliteTable(
  "tenant_layouts",
  {
    layoutId: text("layout_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    scope: text("scope").notNull().default("tenant"),
    organizationId: text("organization_id").references(() => organization.organizationId),
    userId: text("user_id").references(() => user.id),
    entityName: text("entity_name").notNull(),
    layoutKey: text("layout_key").notNull(),
    layoutDefinition: text("layout_definition", { mode: "json" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  },
  (table) => [
    uniqueIndex("uq_layouts_global")
      .on(table.entityName, table.layoutKey)
      .where(sql`scope = 'global'`),
    uniqueIndex("uq_layouts_org")
      .on(table.organizationId, table.entityName, table.layoutKey)
      .where(sql`scope = 'org'`),
    uniqueIndex("uq_layouts_tenant")
      .on(table.entityName, table.layoutKey)
      .where(sql`scope = 'tenant'`),
    uniqueIndex("uq_layouts_user")
      .on(table.userId, table.entityName, table.layoutKey)
      .where(sql`scope = 'user'`),
  ],
);

export const tenantRules = sqliteTable(
  "tenant_rules",
  {
    ruleId: text("rule_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    scope: text("scope").notNull().default("tenant"),
    organizationId: text("organization_id").references(() => organization.organizationId),
    entityName: text("entity_name").notNull(),
    hookName: text("hook_name").notNull(),
    ruleState: text("rule_state").notNull().default("draft"),
    ruleDefinition: text("rule_definition", { mode: "json" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    ruleSource: text("rule_source"),
  },
  (table) => [
    unique("uq_rules_global").on(table.entityName, table.hookName),
    unique("uq_rules_org").on(table.organizationId, table.entityName, table.hookName),
    unique("uq_rules_tenant").on(table.entityName, table.hookName),
  ],
);

export const metadataHistory = sqliteTable(
  "metadata_history",
  {
    historyId: text("history_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    userId: text("user_id").references(() => user.id),
    entityName: text("entity_name").notNull(),
    metadataType: text("metadata_type").notNull(), // 'field', 'group', 'layout'
    metadataKey: text("metadata_key").notNull(), // fieldName, groupKey, or layoutKey
    oldValue: text("old_value", { mode: "json" }),
    newValue: text("new_value", { mode: "json" }),
    changeType: text("change_type").notNull(), // 'insert', 'update', 'delete'
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  },
  (table) => [index("idx_metadata_history_entity").on(table.entityName)],
);

export const unit = sqliteTable(
  "unit",
  {
    unitId: text("unit_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    code: text("code").notNull(),
    name: text("name", { mode: "json" }).notNull(),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    customAttributes: text("custom_attributes", { mode: "json" }),
  },
  (table) => [unique("unit_tenant_code_unique").on(table.code)],
);

export const fiscalPeriod = sqliteTable(
  "fiscal_period",
  {
    fiscalPeriodId: text("fiscal_period_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    companyId: text("company_id")
      .notNull()
      .references(() => company.companyId),
    fiscalYear: integer("fiscal_year").notNull(),
    periodNo: integer("period_no").notNull(),
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
    isClosed: integer("is_closed", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  },
  (table) => [
    unique("fiscal_period_company_year_period").on(
      table.companyId,
      table.fiscalYear,
      table.periodNo,
    ),
    index("idx_fiscal_period_tenant_date").on(table.companyId, table.startDate, table.endDate),
  ],
);

export const factPurchaseEvent = sqliteTable(
  "fact_purchase_event",
  {
    factPurchaseEventId: text("fact_purchase_event_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    companyId: text("company_id").notNull(),
    sourceDocumentId: text("source_document_id"),
    sourceDocumentLineId: text("source_document_line_id"),
    supplierId: text("supplier_id"),
    articleId: text("article_id"),
    eventType: text("event_type").notNull().default("purchase"),
    quantityDelta: numeric("quantity_delta").notNull(),
    amountNetDelta: numeric("amount_net_delta").notNull(),
    avgCostBefore: numeric("avg_cost_before"),
    avgCostAfter: numeric("avg_cost_after"),
    fiscalPeriodId: text("fiscal_period_id"),
    bookingPeriod: text("booking_period"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  },
  (table) => [
    index("idx_fact_purchase_tenant_company").on(table.companyId),
    index("idx_fact_purchase_supplier").on(table.supplierId),
    index("idx_fact_purchase_article").on(table.articleId),
    index("idx_fact_purchase_period").on(table.fiscalPeriodId),
  ],
);

export const accountingExportBatch = sqliteTable(
  "accounting_export_batch",
  {
    batchId: text("batch_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    companyId: text("company_id")
      .notNull()
      .references(() => company.companyId),
    fiscalPeriodId: text("fiscal_period_id")
      .notNull()
      .references(() => fiscalPeriod.fiscalPeriodId),
    status: text("status").notNull().default("pending"),
    rowCount: integer("row_count").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    exportedAt: integer("exported_at", { mode: "timestamp_ms" }),
    createdBy: text("created_by"),
  },
  (table) => [
    unique("accounting_export_batch_period_company").on(table.fiscalPeriodId, table.companyId),
    index("idx_accounting_export_batch_period").on(table.fiscalPeriodId),
    check("chk_accounting_export_batch_status", sql`status IN ('pending', 'exported', 'failed')`),
  ],
);

export const accountingExportRow = sqliteTable(
  "accounting_export_row",
  {
    rowId: text("row_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    batchId: text("batch_id")
      .notNull()
      .references(() => accountingExportBatch.batchId),
    companyId: text("company_id")
      .notNull()
      .references(() => company.companyId),
    postingDate: text("posting_date").notNull(),
    glAccountId: text("gl_account_id")
      .notNull()
      .references(() => glAccount.glAccountId),
    costCenterId: text("cost_center_id").references(() => costCenter.costCenterId),
    taxCodeId: text("tax_code_id").references(() => taxCode.taxCodeId),
    debitAmount: numeric("debit_amount").notNull().default("0"),
    creditAmount: numeric("credit_amount").notNull().default("0"),
    currencyId: text("currency_id"),
    sourceDocumentId: text("source_document_id").references(() => document.documentId),
    sourceDocumentNo: text("source_document_no"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  },
  (table) => [index("idx_accounting_export_row_batch").on(table.batchId)],
);

export const emailAccount = sqliteTable(
  "email_account",
  {
    emailAccountId: text("email_account_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    displayName: text("display_name").notNull(),
    primaryEmail: text("primary_email").notNull(),
    status: text("status").notNull().default("connected"),
    credentialsEncrypted: text("credentials_encrypted").notNull(),
    scopes: text("scopes", { mode: "json" }).notNull().default([]),
    lastSyncAt: integer("last_sync_at", { mode: "timestamp_ms" }),
    lastSyncStatus: text("last_sync_status").notNull().default("idle"),
    lastSyncError: text("last_sync_error"),
    watchExpiresAt: integer("watch_expires_at", { mode: "timestamp_ms" }),
    activityTier: text("activity_tier").notNull().default("cold"),
    lastUserActivityAt: integer("last_user_activity_at", { mode: "timestamp_ms" }),
    syncPriority: text("sync_priority").notNull().default("normal"),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    grantedByUserId: text("granted_by_user_id").references(() => user.id),
    grantedScopes: text("granted_scopes", { mode: "json" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    unique("email_account_tenant_provider_account_unique").on(
      table.provider,
      table.providerAccountId,
    ),
    index("idx_email_account_status").on(table.status),
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
    check("chk_email_account_sync_priority", sql`sync_priority IN ('high', 'normal', 'low')`),
  ],
);

export const emailIdentity = sqliteTable(
  "email_identity",
  {
    emailIdentityId: text("email_identity_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    emailAccountId: text("email_account_id")
      .notNull()
      .references(() => emailAccount.emailAccountId),
    email: text("email").notNull(),
    displayName: text("display_name"),
    providerIdentityId: text("provider_identity_id"),
    isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
    canSend: integer("can_send", { mode: "boolean" }).notNull().default(true),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  },
  (table) => [
    unique("email_identity_account_email_unique").on(table.emailAccountId, table.email),
    index("idx_email_identity_account").on(table.emailAccountId),
  ],
);

export const emailAccountUserGrant = sqliteTable(
  "email_account_user_grant",
  {
    emailAccountUserGrantId: text("email_account_user_grant_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    emailAccountId: text("email_account_id")
      .notNull()
      .references(() => emailAccount.emailAccountId),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    canRead: integer("can_read", { mode: "boolean" }).notNull().default(true),
    canSend: integer("can_send", { mode: "boolean" }).notNull().default(false),
    canManage: integer("can_manage", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  },
  (table) => [
    unique("email_account_grant_user_unique").on(table.emailAccountId, table.userId),
    index("idx_email_account_grant_user").on(table.userId),
  ],
);

export const emailThread = sqliteTable(
  "email_thread",
  {
    emailThreadId: text("email_thread_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    emailAccountId: text("email_account_id")
      .notNull()
      .references(() => emailAccount.emailAccountId),
    providerThreadId: text("provider_thread_id").notNull(),
    subject: text("subject"),
    snippet: text("snippet"),
    lastMessageAt: integer("last_message_at", { mode: "timestamp_ms" }),
    isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
    isStarred: integer("is_starred", { mode: "boolean" }).notNull().default(false),
    messageCount: integer("message_count").notNull().default(0),
    relatedAddressId: text("related_address_id").references(() => address.addressId),
    relatedDocumentId: text("related_document_id").references(() => document.documentId),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    inTrash: integer("in_trash", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    unique("email_thread_account_provider_unique").on(table.emailAccountId, table.providerThreadId),
    index("idx_email_thread_mailbox_list").on(
      table.emailAccountId,
      table.archived,
      table.lastMessageAt,
      table.createdAt,
    ),
    index("idx_email_thread_document").on(table.relatedDocumentId),
    index("idx_email_thread_address").on(table.relatedAddressId),
  ],
);

export const emailMessage = sqliteTable(
  "email_message",
  {
    emailMessageId: text("email_message_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    emailAccountId: text("email_account_id")
      .notNull()
      .references(() => emailAccount.emailAccountId),
    emailThreadId: text("email_thread_id")
      .notNull()
      .references(() => emailThread.emailThreadId),
    providerMessageId: text("provider_message_id").notNull(),
    providerDraftId: text("provider_draft_id"),
    internetMessageId: text("internet_message_id"),
    direction: text("direction").notNull(),
    fromJson: text("from_json", { mode: "json" }).notNull().default({}),
    toJson: text("to_json", { mode: "json" }).notNull().default([]),
    ccJson: text("cc_json", { mode: "json" }).notNull().default([]),
    bccJson: text("bcc_json", { mode: "json" }).notNull().default([]),
    subject: text("subject"),
    snippet: text("snippet"),
    bodyHtml: text("body_html"),
    bodyText: text("body_text"),
    sentAt: integer("sent_at", { mode: "timestamp_ms" }),
    receivedAt: integer("received_at", { mode: "timestamp_ms" }),
    isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
    hasAttachments: integer("has_attachments", { mode: "boolean" }).notNull().default(false),
    rawHeaders: text("raw_headers", { mode: "json" }).notNull().default({}),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    unique("email_message_account_provider_unique").on(
      table.emailAccountId,
      table.providerMessageId,
    ),
    index("idx_email_message_thread").on(table.emailThreadId),
    index("idx_email_message_thread_timeline").on(
      table.emailThreadId,
      table.receivedAt,
      table.sentAt,
      table.createdAt,
    ),
    index("idx_email_message_account_date").on(table.emailAccountId, table.receivedAt),
    check("chk_email_message_direction", sql`direction IN ('inbound', 'outbound', 'draft')`),
  ],
);

export const emailAttachment = sqliteTable(
  "email_attachment",
  {
    emailAttachmentId: text("email_attachment_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    emailMessageId: text("email_message_id")
      .notNull()
      .references(() => emailMessage.emailMessageId),
    providerAttachmentId: text("provider_attachment_id"),
    fileName: text("file_name").notNull(),
    contentType: text("content_type"),
    sizeBytes: integer("size_bytes"),
    storageKey: text("storage_key"),
    inlineContentId: text("inline_content_id"),
    fetchedAt: integer("fetched_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  },
  (table) => [
    unique("email_attachment_message_provider_unique").on(
      table.emailMessageId,
      table.providerAttachmentId,
    ),
    index("idx_email_attachment_message").on(table.emailMessageId),
    index("idx_email_attachment_storage").on(table.storageKey),
  ],
);

export const emailLabel = sqliteTable(
  "email_label",
  {
    emailLabelId: text("email_label_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    emailAccountId: text("email_account_id")
      .notNull()
      .references(() => emailAccount.emailAccountId),
    providerLabelId: text("provider_label_id").notNull(),
    name: text("name").notNull(),
    kind: text("kind").notNull().default("label"),
    color: text("color"),
    parentProviderLabelId: text("parent_provider_label_id"),
    messageCount: integer("message_count").notNull().default(0),
    unreadCount: integer("unread_count").notNull().default(0),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    unique("email_label_account_provider_unique").on(table.emailAccountId, table.providerLabelId),
    index("idx_email_label_account_active").on(
      table.emailAccountId,
      table.archived,
      table.kind,
      table.name,
    ),
    check("chk_email_label_kind", sql`kind IN ('system', 'folder', 'label')`),
  ],
);

export const emailMessageLabel = sqliteTable(
  "email_message_label",
  {
    emailMessageLabelId: text("email_message_label_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    emailMessageId: text("email_message_id")
      .notNull()
      .references(() => emailMessage.emailMessageId),
    emailLabelId: text("email_label_id")
      .notNull()
      .references(() => emailLabel.emailLabelId),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  },
  (table) => [
    unique("email_message_label_unique").on(table.emailMessageId, table.emailLabelId),
    index("idx_email_message_label_label").on(table.emailLabelId),
  ],
);

export const emailSyncState = sqliteTable(
  "email_sync_state",
  {
    emailSyncStateId: text("email_sync_state_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    emailAccountId: text("email_account_id")
      .notNull()
      .references(() => emailAccount.emailAccountId),
    scope: text("scope").notNull().default("mailbox"),
    cursor: text("cursor"),
    cursorJson: text("cursor_json", { mode: "json" }),
    status: text("status").notNull().default("idle"),
    lastSyncedAt: integer("last_synced_at", { mode: "timestamp_ms" }),
    lastError: text("last_error"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  },
  (table) => [
    unique("email_sync_state_account_scope_unique").on(table.emailAccountId, table.scope),
    index("idx_email_sync_state_account").on(table.emailAccountId),
    check(
      "chk_email_sync_state_status",
      sql`status IN ('idle', 'queued', 'syncing', 'ok', 'error', 'recovery_required')`,
    ),
  ],
);

export const emailJob = sqliteTable(
  "email_job",
  {
    emailJobId: text("email_job_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    emailAccountId: text("email_account_id").references(() => emailAccount.emailAccountId),
    jobType: text("job_type").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    payload: text("payload", { mode: "json" }).notNull().default({}),
    status: text("status").notNull().default("queued"),
    priority: integer("priority").notNull().default(2),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    runAfter: integer("run_after", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    lockedAt: integer("locked_at", { mode: "timestamp_ms" }),
    lockedBy: text("locked_by"),
    lastError: text("last_error"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("idx_email_job_queue_claim").on(
      table.status,
      table.priority,
      table.runAfter,
      table.createdAt,
    ),
    index("idx_email_job_account").on(table.emailAccountId),
    // Partial index for the reaper and stale-reclaim branch — only covers processing rows
    index("idx_email_job_stale")
      .on(table.lockedAt)
      .where(sql`status = 'processing'`),
    unique("email_job_idempotency_unique").on(table.idempotencyKey),
    check(
      "chk_email_job_type",
      sql`job_type IN ('initial_sync', 'incremental_sync', 'watch_renewal', 'reconcile', 'send', 'fetch_attachment', 'sync_contacts')`,
    ),
    check("chk_email_job_status", sql`status IN ('queued', 'processing', 'done', 'failed')`),
    check("chk_email_job_priority", sql`priority BETWEEN 1 AND 3`),
  ],
);

export const emailSubscription = sqliteTable(
  "email_subscription",
  {
    emailSubscriptionId: text("email_subscription_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    emailAccountId: text("email_account_id")
      .notNull()
      .references(() => emailAccount.emailAccountId),
    resource: text("resource").notNull().default("mail"),
    providerSubscriptionId: text("provider_subscription_id"),
    channelToken: text("channel_token"),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    renewedAt: integer("renewed_at", { mode: "timestamp_ms" }),
    status: text("status").notNull().default("active"),
    renewalAttempts: integer("renewal_attempts").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    unique("email_subscription_account_resource_unique").on(table.emailAccountId, table.resource),
    index("idx_email_subscription_expires").on(table.expiresAt),
    index("idx_email_subscription_account").on(table.emailAccountId),
    // Partial unique: channel_token is the sole auth boundary for webhook lookup — must be globally unique
    uniqueIndex("idx_email_subscription_channel_token")
      .on(table.channelToken)
      .where(sql`channel_token IS NOT NULL`),
    check("chk_email_subscription_resource", sql`resource IN ('mail', 'calendar', 'contacts')`),
    check(
      "chk_email_subscription_status",
      sql`status IN ('active', 'expired', 'renewal_pending', 'failed')`,
    ),
  ],
);

export const emailTemplate = sqliteTable(
  "email_template",
  {
    emailTemplateId: text("email_template_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    category: text("category").notNull().default("document"),
    code: text("code").notNull(),
    name: text("name").notNull(),
    subjectTemplate: text("subject_template").notNull(),
    bodyHtmlTemplate: text("body_html_template").notNull(),
    bodyTextTemplate: text("body_text_template"),
    language: text("language"),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    unique("email_template_tenant_category_code_unique").on(table.category, table.code),
    index("idx_email_template_tenant").on(table.category),
  ],
);

export const emailTemplateBinding = sqliteTable(
  "email_template_binding",
  {
    emailTemplateBindingId: text("email_template_binding_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    emailTemplateId: text("email_template_id")
      .notNull()
      .references(() => emailTemplate.emailTemplateId),
    documentType: text("document_type"),
    companyId: text("company_id").references(() => company.companyId),
    language: text("language"),
    emailIdentityId: text("email_identity_id").references(() => emailIdentity.emailIdentityId),
    priority: integer("priority").notNull().default(100),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  },
  (table) => [
    index("idx_email_template_binding_lookup").on(
      table.documentType,
      table.companyId,
      table.language,
      table.emailIdentityId,
    ),
  ],
);

export const emailTemplateRenderLog = sqliteTable(
  "email_template_render_log",
  {
    emailTemplateRenderLogId: text("email_template_render_log_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    emailTemplateId: text("email_template_id").references(() => emailTemplate.emailTemplateId),
    emailTemplateBindingId: text("email_template_binding_id").references(
      () => emailTemplateBinding.emailTemplateBindingId,
    ),
    documentId: text("document_id").references(() => document.documentId),
    emailIdentityId: text("email_identity_id").references(() => emailIdentity.emailIdentityId),
    language: text("language"),
    subject: text("subject").notNull(),
    renderedHash: text("rendered_hash"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    createdBy: text("created_by").references(() => user.id),
  },
  (table) => [
    index("idx_email_template_render_log_document").on(table.documentId),
    index("idx_email_template_render_log_template").on(table.emailTemplateId),
  ],
);

export const emailOutbox = sqliteTable(
  "email_outbox",
  {
    emailOutboxId: text("email_outbox_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    emailAccountId: text("email_account_id")
      .notNull()
      .references(() => emailAccount.emailAccountId),
    emailIdentityId: text("email_identity_id")
      .notNull()
      .references(() => emailIdentity.emailIdentityId),
    emailMessageId: text("email_message_id").references(() => emailMessage.emailMessageId),
    providerDraftId: text("provider_draft_id"),
    status: text("status").notNull().default("draft"),
    payload: text("payload", { mode: "json" }).notNull().default({}),
    scheduledFor: integer("scheduled_for", { mode: "timestamp_ms" }),
    sentAt: integer("sent_at", { mode: "timestamp_ms" }),
    lastError: text("last_error"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
    createdBy: text("created_by").references(() => user.id),
  },
  (table) => [
    index("idx_email_outbox_queue").on(
      table.emailAccountId,
      table.status,
      table.updatedAt,
      table.createdAt,
    ),
    index("idx_email_outbox_message").on(table.emailMessageId),
    check(
      "chk_email_outbox_status",
      sql`status IN ('draft', 'queued', 'sending', 'sent', 'failed')`,
    ),
  ],
);

export const devCycles = sqliteTable("dev_cycles", {
  cycleId: text("cycle_id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  cycleNumber: integer("cycle_number").notNull(),
  recordedAt: integer("recorded_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  sliceFitScore: integer("slice_fit_score").notNull(),
  sliceFitMax: integer("slice_fit_max").notNull(),
  storyCoverage: integer("story_coverage").notNull(),
  storyCoverageMax: integer("story_coverage_max").notNull(),
  testsAdded: integer("tests_added").notNull().default(0),
  vpTestPass: integer("vp_test_pass", { mode: "boolean" }),
  blocker: text("blocker"),
  processAdjustment: text("process_adjustment"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
});

export const documentShipment = sqliteTable(
  "document_shipment",
  {
    documentShipmentId: text("document_shipment_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    documentId: text("document_id")
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
    countryCode: text("country_code").notNull().default("DE"),
    email: text("email"),
    phone: text("phone"),

    // Timestamps
    exportedAt: integer("exported_at", { mode: "timestamp_ms" }),
    labelCreatedAt: integer("label_created_at", { mode: "timestamp_ms" }),
    shippedAt: integer("shipped_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    unique("uq_document_shipment").on(table.documentId),
    index("idx_shipment_document").on(table.documentId),
    index("idx_shipment_status").on(table.shipmentStatus),
  ],
);

export const documentShipmentPackage = sqliteTable(
  "document_shipment_package",
  {
    documentShipmentPackageId: text("document_shipment_package_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    documentShipmentId: text("document_shipment_id")
      .notNull()
      .references(() => documentShipment.documentShipmentId),

    seq: integer("seq").notNull().default(1),
    weightKg: numeric("weight_kg").notNull().default("1.0"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  },
  (table) => [index("idx_shipment_package_shipment").on(table.documentShipmentId)],
);

export const aiRun = sqliteTable(
  "ai_run",
  {
    runId: text("run_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    taskScope: text("task_scope").notNull(),
    status: text("status").notNull(),
    durationMs: integer("duration_ms"),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("idx_ai_run_user").on(table.userId),
    index("idx_ai_run_status").on(table.status),
  ],
);

export const aiSessionStatus = sqliteEnum("ai_session_status", [
  "active",
  "awaiting_review",
  "completed",
  "aborted",
]);

export const aiSession = sqliteTable(
  "ai_session",
  {
    sessionId: text("session_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    mode: text("mode").notNull().default("sync"),
    focusType: text("focus_type").notNull(),
    focusId: text("focus_id").notNull(),
    status: aiSessionStatus("status").notNull().default("active"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  },
  (table) => [
    index("idx_ai_session_user").on(table.userId),
    index("idx_ai_session_status").on(table.status),
    index("idx_ai_session_focus").on(table.focusType, table.focusId),
  ],
);

export const aiPromptVersion = sqliteTable(
  "ai_prompt_version",
  {
    promptVersionId: text("prompt_version_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    systemPrompt: text("system_prompt").notNull(),
    inputSchema: text("input_schema", { mode: "json" }).notNull(),
    modelConfig: text("model_config", { mode: "json" }).notNull(),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  },
  () => [],
);

export const aiPlan = sqliteTable(
  "ai_plan",
  {
    planId: text("plan_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    runId: text("run_id")
      .notNull()
      .references(() => aiRun.runId),
    promptVersionId: text("prompt_version_id")
      .notNull()
      .references(() => aiPromptVersion.promptVersionId),
    planJson: text("plan_json", { mode: "json" }).notNull(),
    confidenceScore: numeric("confidence_score").notNull(),
    applyReadiness: text("apply_readiness").notNull(),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("idx_ai_plan_run").on(table.runId),
    index("idx_ai_plan_prompt_version").on(table.promptVersionId),
    index("idx_ai_plan_readiness").on(table.applyReadiness),
  ],
);

export const aiApplyAttempt = sqliteTable(
  "ai_apply_attempt",
  {
    attemptId: text("attempt_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    planId: text("plan_id")
      .notNull()
      .references(() => aiPlan.planId),
    appliedPlanJson: text("applied_plan_json", { mode: "json" }).notNull(),
    status: text("status").notNull(),
    executedByUserId: text("executed_by_user_id")
      .notNull()
      .references(() => user.id),
    errorLogs: text("error_logs"),
    appliedAt: integer("applied_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("idx_ai_apply_attempt_plan").on(table.planId),
    index("idx_ai_apply_attempt_executor").on(table.executedByUserId),
    index("idx_ai_apply_attempt_status").on(table.status),
  ],
);

export const aiInterpretation = sqliteTable(
  "ai_interpretation",
  {
    interpretationId: text("interpretation_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    sourceThreadId: text("source_thread_id").references(() => emailThread.emailThreadId),
    runId: text("run_id")
      .notNull()
      .references(() => aiRun.runId),
    promptVersionId: text("prompt_version_id")
      .notNull()
      .references(() => aiPromptVersion.promptVersionId),
    businessIntent: text("business_intent").notNull(),
    confidenceScore: numeric("confidence_score").notNull(),
    summary: text("summary").notNull(),
    evidenceJson: text("evidence_json", { mode: "json" }).notNull(),
    extractedReferencesJson: text("extracted_references_json", { mode: "json" }).notNull(),
    requestedResolversJson: text("requested_resolvers_json", { mode: "json" }).notNull(),
    blockingQuestionsJson: text("blocking_questions_json", { mode: "json" }).notNull(),
    rawLlmTrace: text("raw_llm_trace", { mode: "json" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  },
  (table) => [index("idx_ai_interpretation_run").on(table.runId)],
);

export const aiReview = sqliteTable(
  "ai_review",
  {
    reviewId: text("review_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    interpretationId: text("interpretation_id")
      .notNull()
      .references(() => aiInterpretation.interpretationId),
    runId: text("run_id")
      .notNull()
      .references(() => aiRun.runId),
    reviewStatus: text("review_status").notNull(),
    businessCase: text("business_case").notNull(),
    headline: text("headline").notNull(),
    summary: text("summary").notNull(),
    intentBadgeJson: text("intent_badge_json", { mode: "json" }).notNull(),
    sectionsJson: text("sections_json", { mode: "json" }).notNull(),
    warningsJson: text("warnings_json", { mode: "json" }).notNull(),
    blockingIssuesJson: text("blocking_issues_json", { mode: "json" }).notNull(),
    proposedApplyPayloadJson: text("proposed_apply_payload_json", { mode: "json" }).notNull(),
    appliedOverridesJson: text("applied_overrides_json", { mode: "json" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  },
  (table) => [index("idx_ai_review_interpretation").on(table.interpretationId)],
);

export const aiEvidence = sqliteTable(
  "ai_evidence",
  {
    evidenceId: text("evidence_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    planId: text("plan_id")
      .notNull()
      .references(() => aiPlan.planId),
    fieldName: text("field_name").notNull(),
    sourceText: text("source_text").notNull(),
    matchConfidence: numeric("match_confidence").notNull(),
    ambiguityNote: text("ambiguity_note"),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("idx_ai_evidence_plan").on(table.planId),
    index("idx_ai_evidence_field").on(table.fieldName),
  ],
);

export const tenantLlmConfig = sqliteTable(
  "tenant_llm_config",
  {
    tenantLlmConfigId: text("tenant_llm_config_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    companyId: text("company_id")
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
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  },
  (table) => [unique("uq_tenant_llm_config_company").on(table.companyId)],
);

// ─── Issue #35: ai_turn + ai_tool_call ───────────────────────────────────────

export const aiToolCallStatus = sqliteEnum("ai_tool_call_status", [
  "pending",
  "running",
  "done",
  "error",
]);

export const aiTurn = sqliteTable(
  "ai_turn",
  {
    turnId: text("turn_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    sessionId: text("session_id")
      .notNull()
      .references(() => aiSession.sessionId),
    role: text("role").notNull(),
    message: text("message").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  },
  (table) => [index("idx_ai_turn_session").on(table.sessionId)],
);

export const aiToolCall = sqliteTable(
  "ai_tool_call",
  {
    toolCallId: text("tool_call_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    turnId: text("turn_id")
      .notNull()
      .references(() => aiTurn.turnId),
    toolName: text("tool_name").notNull(),
    input: text("input", { mode: "json" }).notNull(),
    output: text("output", { mode: "json" }),
    status: aiToolCallStatus("status").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("idx_ai_tool_call_turn").on(table.turnId),
    index("idx_ai_tool_call_status").on(table.status),
  ],
);

// ─── Issue #47: ai_tool_review + ai_context_projection ───────────────────────

export const aiToolReviewStatus = sqliteEnum("ai_tool_review_status", [
  "pending",
  "validated",
  "applied",
  "rejected",
]);

export const aiToolReview = sqliteTable(
  "ai_tool_review",
  {
    reviewId: text("review_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    sessionId: text("session_id")
      .notNull()
      .references(() => aiSession.sessionId),
    toolName: text("tool_name").notNull(),
    proposal: text("proposal", { mode: "json" }).notNull(),
    status: aiToolReviewStatus("status").notNull().default("pending"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    appliedAt: integer("applied_at", { mode: "timestamp_ms" }),
  },
  (table) => [index("idx_ai_tool_review_session").on(table.sessionId)],
);

export const aiContextProjection = sqliteTable(
  "ai_context_projection",
  {
    projectionId: text("projection_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    sessionId: text("session_id")
      .notNull()
      .references(() => aiSession.sessionId),
    focusType: text("focus_type").notNull(),
    focusId: text("focus_id").notNull(),
    snapshot: text("snapshot", { mode: "json" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("idx_ai_context_projection_session").on(table.sessionId)],
);

// ─── Issue #57: ai_memory ─────────────────────────────────────────────────────

export const aiMemoryKind = sqliteEnum("ai_memory_kind", [
  "business_fact",
  "classification_pattern",
  "explicit_rule",
  "writing_style",
  "personal_shorthand",
]);

export const aiMemory = sqliteTable(
  "ai_memory",
  {
    memoryId: text("memory_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    userId: text("user_id").references(() => user.id),
    kind: aiMemoryKind("kind").notNull(),
    text: text("text").notNull(),
    confidence: numeric("confidence").notNull(),
    sourceReviewId: text("source_review_id").references(() => aiToolReview.reviewId),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    confirmedAt: integer("confirmed_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("idx_ai_memory_user").on(table.userId),
    index("idx_ai_memory_kind").on(table.kind),
    index("idx_ai_memory_confirmed").on(table.confirmedAt),
  ],
);

// E-Commerce Integrations

export const externalSyncEntityType = sqliteEnum("external_sync_entity_type", [
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

export const externalSyncDirection = sqliteEnum("external_sync_direction", [
  "push",
  "pull",
  "bidirectional",
]);

export const externalSyncStatus = sqliteEnum("external_sync_status", [
  "pending",
  "success",
  "error",
]);

export const ecommercePlatform = sqliteEnum("ecommerce_platform", [
  "shopify",
  "shopware6",
  "woocommerce",
  "prestashop",
]);

export const commerceSyncRunDirection = sqliteEnum("commerce_sync_run_direction", [
  "push",
  "pull",
  "bidirectional",
]);

export const commerceSyncRunMode = sqliteEnum("commerce_sync_run_mode", ["single", "full"]);

export const commerceSyncRunStatus = sqliteEnum("commerce_sync_run_status", [
  "queued",
  "running",
  "success",
  "partial_error",
  "error",
  "cancel_requested",
  "cancelled",
]);

export const commerceSyncStepPhase = sqliteEnum("commerce_sync_step_phase", [
  "plan",
  "map",
  "push",
  "pull",
  "finalize",
]);

export const commerceSyncStepStatus = sqliteEnum("commerce_sync_step_status", [
  "pending",
  "running",
  "success",
  "error",
  "skipped",
]);

export const salesChannel = sqliteTable(
  "sales_channel",
  {
    salesChannelId: text("sales_channel_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    name: text("name").notNull(),
    platform: ecommercePlatform("platform").notNull(),
    apiUrl: text("api_url").notNull(),
    credentials: text("credentials", { mode: "json" }),
    masterDataPolicy: text("master_data_policy"), // Defines behavior like "b2b", "b2c", etc.
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  },
  () => [],
);

export const externalSyncMapping = sqliteTable(
  "external_sync_mapping",
  {
    mappingId: text("mapping_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    salesChannelId: text("sales_channel_id").references(() => salesChannel.salesChannelId),
    sourceSystem: text("source_system").notNull().default("sales_channel"),
    entityType: externalSyncEntityType("entity_type").notNull(),
    internalId: text("internal_id").notNull(),
    externalId: text("external_id").notNull(),
    externalParentId: text("external_parent_id"),
    externalVersion: text("external_version"),
    syncDirection: externalSyncDirection("sync_direction").notNull(),
    payloadSnapshot: text("payload_snapshot", { mode: "json" }),
    lastSyncAt: integer("last_sync_at", { mode: "timestamp_ms" }),
    syncStatus: externalSyncStatus("sync_status").notNull().default("pending"),
    errorLog: text("error_log"),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    externalDeletedAt: integer("external_deleted_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("idx_ext_sync_tenant_lookup").on(table.sourceSystem, table.entityType),
    unique("uq_ext_sync_internal").on(table.salesChannelId, table.entityType, table.internalId),
    unique("uq_ext_sync_external").on(table.salesChannelId, table.entityType, table.externalId),
    unique("uq_ext_sync_external_key").on(table.sourceSystem, table.entityType, table.externalId),
  ],
);

export const commerceSyncRun = sqliteTable(
  "commerce_sync_run",
  {
    runId: text("run_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    salesChannelId: text("sales_channel_id")
      .notNull()
      .references(() => salesChannel.salesChannelId),
    direction: commerceSyncRunDirection("direction").notNull(),
    mode: commerceSyncRunMode("mode").notNull(),
    status: commerceSyncRunStatus("status").notNull().default("queued"),
    requestedEntities: text("requested_entities", { mode: "json" }).notNull(),
    dryRun: integer("dry_run", { mode: "boolean" }).notNull().default(false),
    totalItems: integer("total_items").notNull().default(0),
    succeededItems: integer("succeeded_items").notNull().default(0),
    failedItems: integer("failed_items").notNull().default(0),
    errorSummary: text("error_summary"),
    startedAt: integer("started_at", { mode: "timestamp_ms" }),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    cancelRequestedAt: integer("cancel_requested_at", { mode: "timestamp_ms" }),
    createdByUserId: text("created_by_user_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  },
  (table) => [
    index("idx_commerce_sync_run_sales_channel").on(table.salesChannelId),
    index("idx_commerce_sync_run_status").on(table.status),
  ],
);

export const commerceSyncRunStep = sqliteTable(
  "commerce_sync_run_step",
  {
    stepId: text("step_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    runId: text("run_id")
      .notNull()
      .references(() => commerceSyncRun.runId),
    salesChannelId: text("sales_channel_id")
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
    payloadSummary: text("payload_summary", { mode: "json" }),
    errorSummary: text("error_summary"),
    startedAt: integer("started_at", { mode: "timestamp_ms" }),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  },
  (table) => [
    index("idx_commerce_sync_step_run").on(table.runId),
    unique("uq_commerce_sync_step_sequence").on(table.runId, table.sequence, table.batchNo),
  ],
);

export const commerceSyncDlqStatus = sqliteEnum("commerce_sync_dlq_status", [
  "pending",
  "resolved",
  "abandoned",
]);

export const commerceSyncDeadLetter = sqliteTable(
  "commerce_sync_dead_letter",
  {
    itemId: text("item_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    runId: text("run_id")
      .notNull()
      .references(() => commerceSyncRun.runId),
    salesChannelId: text("sales_channel_id")
      .notNull()
      .references(() => salesChannel.salesChannelId),
    entityType: externalSyncEntityType("entity_type").notNull(),
    internalId: text("internal_id").notNull(),
    errorMessage: text("error_message").notNull(),
    attemptCount: integer("attempt_count").notNull().default(1),
    lastAttemptedAt: integer("last_attempted_at", { mode: "timestamp_ms" }).notNull(),
    nextRetryAt: integer("next_retry_at", { mode: "timestamp_ms" }),
    status: commerceSyncDlqStatus("status").notNull().default("pending"),
    resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  },
  (table) => [
    index("idx_commerce_sync_dlq_pending").on(table.status, table.nextRetryAt),
    index("idx_commerce_sync_dlq_item").on(
      table.salesChannelId,
      table.entityType,
      table.internalId,
    ),
  ],
);

export const commerceWebhookEventStatus = sqliteEnum("commerce_webhook_event_status", [
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
export const commerceWebhookEvent = sqliteTable(
  "commerce_webhook_event",
  {
    eventId: text("event_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    salesChannelId: text("sales_channel_id")
      .notNull()
      .references(() => salesChannel.salesChannelId),
    eventName: text("event_name").notNull(),
    // Shopware signs each delivery (shopware-shop-signature); reused as the dedup key.
    dedupeKey: text("dedupe_key").notNull(),
    payload: text("payload", { mode: "json" }).notNull(),
    status: commerceWebhookEventStatus("status").notNull().default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    errorMessage: text("error_message"),
    nextRetryAt: integer("next_retry_at", { mode: "timestamp_ms" }),
    processedAt: integer("processed_at", { mode: "timestamp_ms" }),
    receivedAt: integer("received_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  },
  (table) => [
    index("idx_commerce_webhook_event_pending").on(
      table.salesChannelId,
      table.status,
      table.nextRetryAt,
    ),
    unique("uq_commerce_webhook_event_dedupe").on(table.salesChannelId, table.dedupeKey),
  ],
);

export const articleVariant = sqliteTable(
  "article_variant",
  {
    variantId: text("variant_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    articleId: text("article_id")
      .notNull()
      .references(() => article.articleId),
    sku: text("sku").notNull(),
    ean: text("ean"),
    optionValueHash: text("option_value_hash").notNull(),
    price: numeric("price"),
    weight: numeric("weight"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  },
  (table) => [
    index("idx_article_variant_article").on(table.articleId),
    unique("uq_article_variant_sku").on(table.sku),
    unique("uq_article_variant_option_hash").on(table.articleId, table.optionValueHash),
  ],
);

// Introspection note: variant lookups are rendered through the helper registry as a
// composed label (SKU + option summary + available quantity) rather than a raw UUID.
export const articleOption = sqliteTable(
  "article_option",
  {
    optionId: text("option_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    articleId: text("article_id")
      .notNull()
      .references(() => article.articleId),
    name: text("name").notNull(), // e.g. "Color", "Size"
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    index("idx_article_option_article").on(table.articleId),
    unique("uq_article_option_name").on(table.articleId, table.name),
  ],
);

export const articleOptionValue = sqliteTable(
  "article_option_value",
  {
    valueId: text("value_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    optionId: text("option_id")
      .notNull()
      .references(() => articleOption.optionId),
    value: text("value").notNull(), // e.g. "Red", "XL"
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    index("idx_article_optval_option").on(table.optionId),
    unique("uq_article_option_value").on(table.optionId, table.value),
  ],
);

export const articleVariantOptionValue = sqliteTable(
  "article_variant_option_value",
  {
    variantId: text("variant_id")
      .notNull()
      .references(() => articleVariant.variantId),
    valueId: text("value_id")
      .notNull()
      .references(() => articleOptionValue.valueId),
  },
  (table) => [
    index("idx_variant_optval_variant").on(table.variantId),
    unique("uq_variant_optval").on(table.variantId, table.valueId),
  ],
);

export const inventoryItem = sqliteTable(
  "inventory_item",
  {
    itemId: text("item_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    variantId: text("variant_id")
      .notNull()
      .references(() => articleVariant.variantId),
    sku: text("sku").notNull(),
    tracked: integer("tracked", { mode: "boolean" }).notNull().default(true),
  },
  (table) => [
    index("idx_inv_item_variant").on(table.variantId),
    unique("uq_inv_item_variant").on(table.variantId),
    unique("uq_inv_item_sku").on(table.sku),
  ],
);

export const articleVariantTemplate = sqliteTable(
  "article_variant_template",
  {
    templateId: text("template_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    slug: text("slug").notNull(),
    label: text("label").notNull(),
    articleGroupId: text("article_group_id").references(() => articleGroup.articleGroupId),
    definition: text("definition", { mode: "json" }).notNull(),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  },
  (table) => [unique("uq_article_variant_template_slug").on(table.slug)],
);

export const inventoryLevel = sqliteTable(
  "inventory_level",
  {
    levelId: text("level_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    itemId: text("item_id")
      .notNull()
      .references(() => inventoryItem.itemId),
    locationId: text("location_id")
      .notNull()
      .references(() => warehouse.warehouseId),
    quantity: numeric("quantity").notNull().default("0"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
  },
  (table) => [
    index("idx_inv_level_item").on(table.itemId),
    unique("uq_inv_level_loc").on(table.itemId, table.locationId),
  ],
);

// Idempotency log for the capability runtime. A successful non-read execution
// is recorded under (tenant, idempotency_key); a later call with the same
// key replays the stored result instead of re-running the handler. The unique
// index is the concurrency guard: the first caller inserts a "pending" row and
// owns execution, a concurrent caller sees the conflict.
export const capabilityExecutionLog = sqliteTable(
  "capability_execution_log",
  {
    capabilityExecutionLogId: text("capability_execution_log_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    idempotencyKey: text("idempotency_key").notNull(),
    capabilityKey: text("capability_key").notNull(),
    // sha256 hex of the canonicalized input — guards against reusing a key with
    // a different request.
    inputHash: text("input_hash").notNull(),
    status: text("status").notNull(), // "pending" | "completed"
    // Stored success envelope ({ data, meta }); null while pending.
    result: text("result", { mode: "json" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  },
  (table) => [uniqueIndex("uq_capability_execution_log_key").on(table.idempotencyKey)],
);
