import "dotenv/config";
import { getColumns as getColumnsBase } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";

import { db } from "../index";
import { tenantFields, helperTableRegistry } from "../schema/app.schema";
import * as schema from "../schema/index";

type FieldLabel = { en: string; de: string };
type EntityLabelMap = Record<string, FieldLabel>;

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
  document: { en: "Documents", de: "Belege" },
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
  organisation: new Set(["bankAccount", "numberSequence"]),
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

function getLookupTableName(colName: string, key: string, schemaRef: typeof schema): string | undefined {
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

function getTenantFieldPayload(
  key: string,
  colName: string,
  col: any,
  schemaRef: typeof schema,
) {
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

/**
 * Automatically discovers metadata from Drizzle schema and populates
 * helper_table_registry and global tenant_fields with improved labels.
 */
async function main() {
  console.log("Starting improved dynamic metadata discovery...");

  const tables = discoverTables();

  for (const { key, table } of tables) {
    let config;
    try {
      config = getTableConfig(table);
    } catch (e) {
      continue;
    }
    const columns = getColumnsBase(table);
    const tableName = config.name;

    console.log(`Processing table: ${tableName} (Entity: ${key})`);

    const helperTable = getHelperTablePayload(key, columns as Record<string, unknown>);
    if (helperTable.shouldRegister) {
      await db
        .insert(helperTableRegistry)
        .values(helperTable.payload)
        .onConflictDoUpdate({
          target: [helperTableRegistry.tableName],
          set: helperTable.conflictSet,
        });
    }

    for (const [colName, col] of Object.entries(columns)) {
      const field = getTenantFieldPayload(key, colName, col, schema);

      await db
        .insert(tenantFields)
        .values({
          entityName: key,
          fieldName: colName,
          fieldType: field.fieldType,
          label: field.label,
          scope: "global",
          isVisible: field.isVisible,
          isRequired: field.isRequired,
          lookupTable: field.lookupTable,
        })
        .onConflictDoUpdate({
          target: [tenantFields.entityName, tenantFields.fieldName],
          set: {
            fieldType: field.fieldType,
            isRequired: field.isRequired,
            lookupTable: field.lookupTable || undefined,
            label: field.label,
            isVisible: field.isVisible,
          },
        });
    }
  }

  console.log("Improved dynamic metadata discovery complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Error in discovery:", err);
  process.exit(1);
});
