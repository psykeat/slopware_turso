import "./load-env";
import { and, eq, getColumns as getColumnsBase, not, inArray } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";

import { db } from "../index";
import { tenantFields, helperTableRegistry } from "../schema/app.schema";
import * as schema from "../schema/index";

type FieldLabel = { en: string; de: string };
type EntityLabelMap = Record<string, FieldLabel>;
type DiscoveredTenantField = {
  entityName: string;
  fieldName: string;
  fieldType: string;
  label: FieldLabel;
  isVisible: boolean;
  isRequired: boolean;
  lookupTable?: string;
};

type ExistingTenantField = {
  entityName: string;
  fieldName: string;
  fieldType: string;
};

type HelperTableRegistration = {
  payload: ReturnType<typeof getHelperTablePayload>["payload"];
  conflictSet: ReturnType<typeof getHelperTablePayload>["conflictSet"];
};

const entityLabelMap: EntityLabelMap = {
  company: { en: "Company Master", de: "Firmenstamm" },
  bankAccount: { en: "Bank Accounts", de: "Bankverbindungen" },
  numberSequence: { en: "Number Sequences", de: "Nummernkreise" },
  paymentTerm: { en: "Payment Terms", de: "Zahlungsbedingungen" },
  shippingMethod: { en: "Shipping Methods", de: "Versandarten" },
  priceList: { en: "Price Lists", de: "Preislisten" },
  discountGroup: { en: "Discount Groups", de: "Rabattgruppen" },
  addressCategory: { en: "Address Categories", de: "Adresskategorien" },
  documentGroup: { en: "Document Groups", de: "Beleggruppen" },
  industry: { en: "Industries", de: "Branchen" },
  unit: { en: "Units", de: "Einheiten" },
  articleGroup: { en: "Article Groups", de: "Artikelgruppen" },
  warehouse: { en: "Warehouses", de: "Lagerorte" },
  taxClass: { en: "Tax Classes", de: "Steuerklassen" },
  taxCode: { en: "Tax Codes", de: "Steuerschlüssel" },
  costCenter: { en: "Cost Centers", de: "Kostenstellen" },
  glAccount: { en: "GL Accounts", de: "Sachkonten" },
  currency: { en: "Currencies", de: "Währungen" },
  country: { en: "Countries", de: "Länder" },
  postalCode: { en: "Postal Codes", de: "PLZ-Verzeichnis" },
  address: { en: "Addresses", de: "Adressen" },
  article: { en: "Articles", de: "Artikel" },
  articleVariant: { en: "Article Variants", de: "Artikelvarianten" },
  articleOption: { en: "Article Options", de: "Artikeloptionen" },
  articleOptionValue: { en: "Article Option Values", de: "Artikeloptionswerte" },
  inventoryItem: { en: "Inventory Items", de: "Lagerartikel" },
  document: { en: "Documents", de: "Belege" },
  tenantLlmConfig: { en: "Tenant LLM Config", de: "Mandanten-KI-Konfiguration" },
  tenantEmailSettings: { en: "Email Settings", de: "E-Mail Einstellungen" },
};

const fieldLabelMap: EntityLabelMap = {
  name: { en: "Name", de: "Name" },
  code: { en: "Code", de: "Code" },
  isActive: { en: "Active", de: "Aktiv" },
  description: { en: "Description", de: "Beschreibung" },
  addressLine1: { en: "Address 1", de: "Adresszeile 1" },
  addressLine2: { en: "Address 2", de: "Adresszeile 2" },
  city: { en: "City", de: "Ort" },
  postalCode: { en: "Postal Code", de: "PLZ" },
  countryCode: { en: "Country", de: "Land" },
  phoneLandline: { en: "Phone", de: "Telefon" },
  phoneMobile: { en: "Mobile", de: "Mobil" },
  email: { en: "Email", de: "E-Mail" },
  homepage: { en: "Homepage", de: "Homepage" },
  vatId: { en: "VAT ID", de: "USt-ID" },
  taxNumber: { en: "Tax No", de: "Steuernummer" },
  iban: { en: "IBAN", de: "IBAN" },
  bic: { en: "BIC", de: "BIC" },
  bankName: { en: "Bank", de: "Bankname" },
  prefix: { en: "Prefix", de: "Präfix" },
  nextValue: { en: "Next Value", de: "Nächster Wert" },
  netDays: { en: "Net Days", de: "Tage netto" },
  percentage: { en: "Percentage", de: "Prozent" },
  accountNo: { en: "Account No", de: "Kontonummer" },
  iso2Code: { en: "ISO 2", de: "ISO 2" },
  taxRate: { en: "Tax Rate %", de: "Steuersatz %" },
  legalName: { en: "Legal Name", de: "Juristischer Name" },
  companyNo: { en: "Company No", de: "Firmennummer" },
  fiscalYearStartMonth: { en: "FY Start Month", de: "Geschäftsjahr Beginn (Monat)" },
  nextGroupId: { en: "Next Group", de: "Nächste Gruppe" },
  requireSerialTracking: { en: "Require Serial Tracking", de: "Seriennummernpflicht" },
  requireBatchTracking: { en: "Require Batch Tracking", de: "Chargenpflicht" },
  endpointUrl: { en: "Endpoint URL", de: "Endpoint-URL" },
  model: { en: "LLM Model", de: "KI-Modell" },
  apiKey: { en: "API Key", de: "API-Key" },
};

const technicalFieldNames = new Set([
  "tenantId",
  "createdAt",
  "updatedAt",
  "archived",
  "archivedAt",
  "isActive",
]);

const groupedEntitySets = {
  organisation: new Set([
    "bankAccount",
    "numberSequence",
    "tenantLlmConfig",
    "tenantEmailSettings",
  ]),
  vertrieb: new Set([
    "paymentTerm",
    "shippingMethod",
    "priceList",
    "discountGroup",
    "addressCategory",
    "documentGroup",
    "industry",
  ]),
  lager_artikel: new Set(["unit", "articleGroup", "warehouse"]),
  finanzen: new Set(["taxClass", "taxCode", "costCenter", "glAccount", "currency"]),
  geodaten: new Set(["country", "postalCode"]),
} as const;

const lookupSuffix = "Id";

function discoverTables() {
  return Object.entries(schema)
    .filter(([_, value]) => {
      try {
        if (value && typeof value === "object") {
          getTableConfig(value as any);
          return true;
        }
      } catch {
        return false;
      }
      return false;
    })
    .map(([key, table]) => ({ key, table: table as any }));
}

function getEntityLabel(key: string): FieldLabel {
  return entityLabelMap[key] || { en: key, de: key };
}

function getFieldLabel(fieldName: string): FieldLabel {
  return fieldLabelMap[fieldName] || { en: fieldName, de: fieldName };
}

function getEntityGroup(key: string): string | undefined {
  if (key === "company") return "master";
  if (groupedEntitySets.organisation.has(key)) return "organisation";
  if (groupedEntitySets.vertrieb.has(key)) return "vertrieb";
  if (groupedEntitySets.lager_artikel.has(key)) return "lager_artikel";
  if (groupedEntitySets.finanzen.has(key)) return "finanzen";
  if (groupedEntitySets.geodaten.has(key)) return "geodaten";
  return undefined;
}

function getColumnTypeLabel(columnType: string | undefined): string {
  if (columnType === "PgNumeric") return "numeric";
  if (columnType === "PgInteger") return "integer";
  if (columnType === "PgBoolean") return "boolean";
  if (columnType === "PgTimestamp" || columnType === "PgDate") return "timestamp";
  return "text";
}

function getLookupTableName(
  colName: string,
  key: string,
  schemaRef: typeof schema,
): string | undefined {
  if (colName === "variantId") {
    return "articleVariant";
  }

  if (colName === "optionId") {
    return "articleOption";
  }

  if (colName === "valueId") {
    return "articleOptionValue";
  }

  if (colName.endsWith(lookupSuffix)) {
    const potentialEntity = colName.slice(0, -lookupSuffix.length);
    if ((schemaRef as any)[potentialEntity] && potentialEntity !== key) {
      return potentialEntity;
    }

    // This is a handwritten exception to the generic suffix rule above.
    if (colName === "addressCategoryId") {
      return "addressCategory";
    }
  }

  if (colName === "countryCode") {
    return "country";
  }

  if (colName === "currencyId") {
    return "currency";
  }

  return undefined;
}

function getHelperTablePayload(key: string, columns: Record<string, unknown>) {
  const columnNames = Object.keys(columns);
  let pkColumn = "";
  let displayColumn = "";
  let codeColumn = "";
  let valueColumn = "";
  let sortColumn = "created_at";
  let isTenantScoped = false;
  let hasName = false;
  let hasCode = false;

  for (const [colName] of Object.entries(columns)) {
    const col = columns[colName] as any;
    if (col.primary) pkColumn = colName;
    if (colName === "tenantId") isTenantScoped = true;
    if (colName === "name") {
      displayColumn = "name";
      hasName = true;
    }
    if (colName === "code" && !displayColumn) {
      displayColumn = "code";
      hasCode = true;
    }
    if (colName === "createdAt") sortColumn = "createdAt";
  }

  if (key === "currency") pkColumn = "code";
  if (key === "country") pkColumn = "iso2Code";
  if (columnNames.includes("code")) codeColumn = "code";
  if (columnNames.includes("iso2Code")) codeColumn = "iso2Code";
  if (columnNames.includes("iso3Code") && !codeColumn) codeColumn = "iso3Code";
  valueColumn = pkColumn || codeColumn;

  if (!displayColumn && pkColumn) displayColumn = pkColumn;
  if (key === "postalCode") displayColumn = "plz";
  if (!displayColumn) displayColumn = columnNames[0];

  const group = getEntityGroup(key);
  const shouldRegister =
    Boolean(group) || hasName || hasCode || ["country", "currency", "postalCode"].includes(key);

  return {
    shouldRegister,
    payload: {
      tableName: key,
      label: getEntityLabel(key),
      pkColumn: pkColumn || "id",
      displayColumn: displayColumn || "name",
      codeColumn: codeColumn || undefined,
      valueColumn: valueColumn || undefined,
      sortColumn: sortColumn || "createdAt",
      isTenantScoped,
      displayIsI18n: Boolean(columns.name && (columns.name as any).columnType === "PgJsonb"),
      group,
      category: group ? "settings" : undefined,
    },
    conflictSet: {
      pkColumn: pkColumn || "id",
      displayColumn: displayColumn || "name",
      codeColumn: codeColumn || undefined,
      valueColumn: valueColumn || undefined,
      sortColumn: sortColumn || "createdAt",
      isTenantScoped,
      group,
      category: group ? "settings" : undefined,
      label: getEntityLabel(key),
    },
  };
}

function buildExplicitHelperTableRegistrations(key: string): HelperTableRegistration[] {
  const registrations: HelperTableRegistration[] = [];

  if (key === "articleVariant") {
    registrations.push({
      payload: {
        tableName: key,
        label: getEntityLabel(key),
        pkColumn: "variantId",
        displayColumn: "lookupLabel",
        codeColumn: "sku",
        valueColumn: "variantId",
        sortColumn: "sku",
        isTenantScoped: true,
        displayIsI18n: false,
        group: "lager_artikel",
        category: "commerce",
      },
      conflictSet: {
        pkColumn: "variantId",
        displayColumn: "lookupLabel",
        codeColumn: "sku",
        valueColumn: "variantId",
        sortColumn: "sku",
        isTenantScoped: true,
        group: "lager_artikel",
        category: "commerce",
        label: getEntityLabel(key),
      },
    });
  }

  if (key === "articleOption") {
    registrations.push({
      payload: {
        tableName: key,
        label: getEntityLabel(key),
        pkColumn: "optionId",
        displayColumn: "name",
        codeColumn: "name",
        valueColumn: "optionId",
        sortColumn: "sortOrder",
        isTenantScoped: true,
        displayIsI18n: false,
        group: "lager_artikel",
        category: "commerce",
      },
      conflictSet: {
        pkColumn: "optionId",
        displayColumn: "name",
        codeColumn: "name",
        valueColumn: "optionId",
        sortColumn: "sortOrder",
        isTenantScoped: true,
        group: "lager_artikel",
        category: "commerce",
        label: getEntityLabel(key),
      },
    });
  }

  if (key === "articleOptionValue") {
    registrations.push({
      payload: {
        tableName: key,
        label: getEntityLabel(key),
        pkColumn: "valueId",
        displayColumn: "value",
        codeColumn: "value",
        valueColumn: "valueId",
        sortColumn: "sortOrder",
        isTenantScoped: true,
        displayIsI18n: false,
        group: "lager_artikel",
        category: "commerce",
      },
      conflictSet: {
        pkColumn: "valueId",
        displayColumn: "value",
        codeColumn: "value",
        valueColumn: "valueId",
        sortColumn: "sortOrder",
        isTenantScoped: true,
        group: "lager_artikel",
        category: "commerce",
        label: getEntityLabel(key),
      },
    });
  }

  if (key === "inventoryItem") {
    registrations.push({
      payload: {
        tableName: key,
        label: getEntityLabel(key),
        pkColumn: "itemId",
        displayColumn: "sku",
        codeColumn: "sku",
        valueColumn: "itemId",
        sortColumn: "sku",
        isTenantScoped: true,
        displayIsI18n: false,
        group: "lager_artikel",
        category: "commerce",
      },
      conflictSet: {
        pkColumn: "itemId",
        displayColumn: "sku",
        codeColumn: "sku",
        valueColumn: "itemId",
        sortColumn: "sku",
        isTenantScoped: true,
        group: "lager_artikel",
        category: "commerce",
        label: getEntityLabel(key),
      },
    });
  }

  return registrations;
}

function getTenantFieldPayload(key: string, colName: string, col: any, schemaRef: typeof schema) {
  const columnType = col.columnType;
  const lookupTable = getLookupTableName(colName, key, schemaRef);
  const isPk = col.primary || false;
  const isUuid = columnType === "PgUUID" || col.dataType === "uuid";
  const isVisible =
    lookupTable !== undefined ||
    (!isPk && !isUuid && !colName.endsWith(lookupSuffix) && !technicalFieldNames.has(colName));

  return {
    fieldType: getColumnTypeLabel(columnType),
    label: getFieldLabel(colName),
    isVisible,
    isRequired: col.notNull || false,
    lookupTable,
  };
}

function discoverSchemaMetadata(): {
  fields: DiscoveredTenantField[];
  helperTables: HelperTableRegistration[];
} {
  const discoveredFields: DiscoveredTenantField[] = [];
  const helperTables: HelperTableRegistration[] = [];

  for (const { key, table } of discoverTables()) {
    try {
      getTableConfig(table);
    } catch {
      continue;
    }

    const columns = getColumnsBase(table);
    const helperTable = getHelperTablePayload(key, columns as Record<string, unknown>);
    console.log(`Processing table: ${key}`);

    if (helperTable.shouldRegister) {
      helperTables.push({
        payload: helperTable.payload,
        conflictSet: helperTable.conflictSet,
      });
    }

    for (const explicitHelperTable of buildExplicitHelperTableRegistrations(key)) {
      helperTables.push(explicitHelperTable);
    }

    for (const [colName, col] of Object.entries(columns)) {
      const field = getTenantFieldPayload(key, colName, col, schema);
      discoveredFields.push({
        entityName: key,
        fieldName: colName,
        fieldType: field.fieldType,
        label: field.label,
        isVisible: field.isVisible,
        isRequired: field.isRequired,
        lookupTable: field.lookupTable,
      });
    }
  }

  helperTables.push({
    payload: {
      tableName: "tenantEmailSettings",
      label: getEntityLabel("tenantEmailSettings"),
      pkColumn: "id",
      displayColumn: "name",
      codeColumn: undefined,
      valueColumn: undefined,
      sortColumn: "createdAt",
      isTenantScoped: true,
      displayIsI18n: false,
      group: "organisation",
      category: "settings",
    },
    conflictSet: {
      pkColumn: "id",
      displayColumn: "name",
      codeColumn: undefined,
      valueColumn: undefined,
      sortColumn: "createdAt",
      isTenantScoped: true,
      group: "organisation",
      category: "settings",
      label: getEntityLabel("tenantEmailSettings"),
    },
  });

  return { fields: discoveredFields, helperTables };
}

export function planTenantFieldReconciliation(
  discoveredFields: DiscoveredTenantField[],
  existingFields: ExistingTenantField[],
) {
  const existingFieldMap = new Map(
    existingFields.map((field) => [`${field.entityName}:${field.fieldName}`, field] as const),
  );

  const inserts: DiscoveredTenantField[] = [];
  const updates: Array<Pick<DiscoveredTenantField, "entityName" | "fieldName" | "fieldType">> = [];

  for (const field of discoveredFields) {
    const fieldKey = `${field.entityName}:${field.fieldName}`;
    // @ts-ignore
    const existingField = existingFieldMap.get(fieldKey);

    if (!existingField) {
      inserts.push(field);
      continue;
    }

    if (existingField.fieldType !== field.fieldType) {
      updates.push({
        entityName: field.entityName,
        fieldName: field.fieldName,
        fieldType: field.fieldType,
      });
    }
  }

  return {
    inserts,
    updates,
    unchanged: discoveredFields.length - inserts.length - updates.length,
    total: discoveredFields.length,
  };
}

/**
 * Automatically discovers metadata from Drizzle schema and reconciles
 * helper_table_registry plus global tenant_fields against the live schema.
 */
export async function seedMetadata() {
  console.log("Starting improved dynamic metadata discovery...");

  const { fields: discoveredFields, helperTables } = discoverSchemaMetadata();

  // Build set of all discovered field keys for archive reconciliation
  const discoveredKeys = new Set(discoveredFields.map((f) => `${f.entityName}.${f.fieldName}`));

  let newCount = 0;
  let changedCount = 0;
  let unchangedCount = 0;
  let archivedCount = 0;

  await db.transaction(async (tx) => {
    const existingFields = (await tx
      .select({
        entityName: tenantFields.entityName,
        fieldName: tenantFields.fieldName,
        fieldType: tenantFields.fieldType,
      })
      .from(tenantFields)
      .where(eq(tenantFields.scope, "global"))) as ExistingTenantField[];

    const { inserts, updates, unchanged } = planTenantFieldReconciliation(
      discoveredFields,
      existingFields,
    );

    newCount = inserts.length;
    changedCount = updates.length;
    unchangedCount = unchanged;

    for (const helperTable of helperTables) {
      await tx
        .insert(helperTableRegistry)
        .values(helperTable.payload)
        .onConflictDoUpdate({
          target: [helperTableRegistry.tableName],
          set: helperTable.conflictSet,
        });
    }

    for (const field of inserts) {
      await tx
        .insert(tenantFields)
        .values({
          entityName: field.entityName,
          fieldName: field.fieldName,
          fieldType: field.fieldType,
          label: field.label,
          scope: "global",
          isVisible: field.isVisible,
          isRequired: field.isRequired,
          lookupTable: field.lookupTable,
        })
        .onConflictDoNothing();
    }

    for (const field of updates) {
      await tx
        .update(tenantFields)
        .set({
          fieldType: field.fieldType,
        })
        .where(
          and(
            eq(tenantFields.scope, "global"),
            eq(tenantFields.entityName, field.entityName),
            eq(tenantFields.fieldName, field.fieldName),
          ),
        );
    }

    // #25: Archive fields that are no longer in the discovered schema
    // Build composite keys of all existing fields to find removed ones
    const existingKeys = existingFields.map((f) => `${f.entityName}.${f.fieldName}`);
    const removedKeys = existingKeys.filter((k) => !discoveredKeys.has(k));

    if (removedKeys.length > 0) {
      // Archive each removed field individually to stay within Drizzle's type system
      for (const key of removedKeys) {
        const dotIdx = key.indexOf(".");
        const entityName = key.slice(0, dotIdx);
        const fieldName = key.slice(dotIdx + 1);
        await tx
          .update(tenantFields)
          .set({ archived: true })
          .where(
            and(
              eq(tenantFields.scope, "global"),
              eq(tenantFields.entityName, entityName),
              eq(tenantFields.fieldName, fieldName),
            ),
          );
      }
      archivedCount = removedKeys.length;
    }
  });

  // #24: Reconciliation report
  const report = {
    new: newCount,
    changed: changedCount,
    unchanged: unchangedCount,
    archived: archivedCount,
    total: newCount + changedCount + unchangedCount,
  };
  console.log("Metadata sync report:", JSON.stringify(report));
  console.log("Improved dynamic metadata discovery complete.");
}

if (
  process.argv[1] &&
  (process.argv[1].endsWith("seed-metadata.ts") || process.argv[1].endsWith("seed-metadata"))
) {
  seedMetadata().catch((err) => {
    console.error("Error in discovery:", err);
    process.exit(1);
  });
}
