import "dotenv/config";
import { db } from "../index";
import * as schema from "../schema/index";
import { tenantFields, helperTableRegistry } from "../schema/app.schema";
import { getTableConfig } from "drizzle-orm/pg-core";
import { sql, getColumns as getColumnsBase } from "drizzle-orm";

/**
 * Automatically discovers metadata from Drizzle schema and populates
 * helper_table_registry and global tenant_fields with improved labels.
 */
async function main() {
  console.log("Starting improved dynamic metadata discovery...");

  const tables = Object.entries(schema)
    .filter(([_, value]) => {
      try {
        if (value && typeof value === "object") {
          getTableConfig(value as any);
          return true;
        }
      } catch (e) {
        return false;
      }
      return false;
    })
    .map(([key, value]) => ({ key, table: value as any }));

  const entityLabelMap: Record<string, any> = {
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

  const fieldLabelMap: Record<string, any> = {
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
  };

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

    // 1. Identify PK, Display, and Tenant Scope
    let pkColumn = "";
    let displayColumn = "";
    let sortColumn = "created_at";
    let isTenantScoped = false;
    let hasName = false;
    let hasCode = false;

    for (const [colName, col] of Object.entries(columns)) {
      if ((col as any).primary) pkColumn = colName;
      if (colName === "tenantId") isTenantScoped = true;
      if (colName === "name") { displayColumn = "name"; hasName = true; }
      if (colName === "code" && !displayColumn) { displayColumn = "code"; hasCode = true; }
      if (colName === "createdAt") sortColumn = "createdAt";
    }

    if (!displayColumn && pkColumn) displayColumn = pkColumn;
    if (!displayColumn) displayColumn = Object.keys(columns)[0];

    // 2. Register in Helper Registry
    const label = entityLabelMap[key] || { en: key, de: key };
    
    // Grouping logic based on PRD
    let group: string | undefined = undefined;
    if (["company", "bankAccount", "numberSequence"].includes(key)) group = "organisation";
    else if (["paymentTerm", "shippingMethod", "priceList", "discountGroup", "addressCategory", "documentGroup", "industry"].includes(key)) group = "vertrieb";
    else if (["unit", "articleGroup", "warehouse"].includes(key)) group = "lager_artikel";
    else if (["taxClass", "taxCode", "costCenter", "glAccount", "currency"].includes(key)) group = "finanzen";
    else if (["country", "postalCode"].includes(key)) group = "geodaten";

    if (group || hasName || hasCode || ["country", "currency", "postalCode"].includes(key)) {
        await db.insert(helperTableRegistry).values({
            tableName: key,
            label,
            pkColumn: pkColumn || "id",
            displayColumn: displayColumn || "name",
            sortColumn: sortColumn || "createdAt",
            isTenantScoped,
            displayIsI18n: columns.name && (columns.name as any).columnType === 'PgJsonb',
            group,
            category: group ? "settings" : undefined,
        }).onConflictDoUpdate({
            target: [helperTableRegistry.tableName],
            set: {
                pkColumn: pkColumn || "id",
                displayColumn: displayColumn || "name",
                sortColumn: sortColumn || "createdAt",
                isTenantScoped,
                group,
                category: group ? "settings" : undefined,
                label,
            }
        });
    }

    // 3. Populate Global Tenant Fields
    for (const [colName, col] of Object.entries(columns)) {
        const columnType = (col as any).columnType;
        const fieldLabel = fieldLabelMap[colName] || { en: colName, de: colName };

        // Auto-discover lookup target
        let lookupTable: string | undefined = undefined;
        if (colName !== "tenantId") {
            if (colName.endsWith("Id")) {
                const potentialEntity = colName.slice(0, -2);
                if ((schema as any)[potentialEntity]) {
                    lookupTable = potentialEntity;
                } else if (colName === "addressCategoryId") {
                    lookupTable = "addressCategory";
                }
            } else if (colName === "countryCode") {
                lookupTable = "country";
            } else if (colName === "currencyId") {
                lookupTable = "currency";
            }
        }

        const isVisible = (lookupTable !== undefined) || (!colName.endsWith("Id") && colName !== "tenantId" && colName !== "createdAt" && colName !== "updatedAt");

        await db.insert(tenantFields).values({
            entityName: key,
            fieldName: colName,
            fieldType: 
                columnType === "PgNumeric" ? "numeric" :
                columnType === "PgInteger" ? "integer" :
                columnType === "PgBoolean" ? "boolean" :
                columnType === "PgTimestamp" || columnType === "PgDate" ? "timestamp" : "text",
            label: fieldLabel,
            scope: "global",
            isVisible,
            isRequired: (col as any).notNull || false,
            lookupTable,
        }).onConflictDoUpdate({
            target: [tenantFields.entityName, tenantFields.fieldName],
            set: {
                fieldType: 
                    columnType === "PgNumeric" ? "numeric" :
                    columnType === "PgInteger" ? "integer" :
                    columnType === "PgBoolean" ? "boolean" :
                    columnType === "PgTimestamp" || columnType === "PgDate" ? "timestamp" : "text",
                isRequired: (col as any).notNull || false,
                lookupTable: lookupTable || undefined,
                label: fieldLabel,
            }
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
