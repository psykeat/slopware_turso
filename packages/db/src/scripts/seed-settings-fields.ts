import "dotenv/config";
import { db } from "../index";
import { tenantFields } from "../schema/app.schema";

/**
 * Seeds tenant_fields rows for all 20 settings entities (global scope).
 * Idempotent — uses onConflictDoNothing().
 *
 * Run with: npx tsx packages/db/src/scripts/seed-settings-fields.ts
 */

type FieldSpec = {
  fieldName: string;
  fieldType: "text" | "integer" | "numeric" | "boolean" | "timestamp";
  labelEn: string;
  labelDe: string;
  isRequired?: boolean;
  lookupTable?: string;
};

type EntitySpec = {
  entityName: string;
  fields: FieldSpec[];
};

const entities: EntitySpec[] = [
  {
    entityName: "company",
    fields: [
      { fieldName: "name", fieldType: "text", labelEn: "Name", labelDe: "Name", isRequired: true },
      { fieldName: "legalName", fieldType: "text", labelEn: "Legal Name", labelDe: "Juristischer Name" },
      { fieldName: "companyNo", fieldType: "text", labelEn: "Company No", labelDe: "Firmennummer", isRequired: true },
      { fieldName: "email", fieldType: "text", labelEn: "Email", labelDe: "E-Mail" },
      { fieldName: "phoneLandline", fieldType: "text", labelEn: "Phone", labelDe: "Telefon" },
      { fieldName: "vatId", fieldType: "text", labelEn: "VAT ID", labelDe: "USt-ID" },
      { fieldName: "addressLine1", fieldType: "text", labelEn: "Address 1", labelDe: "Adresszeile 1" },
      { fieldName: "postalCode", fieldType: "text", labelEn: "Postal Code", labelDe: "PLZ" },
      { fieldName: "city", fieldType: "text", labelEn: "City", labelDe: "Ort" },
      { fieldName: "countryCode", fieldType: "text", labelEn: "Country", labelDe: "Land", isRequired: true, lookupTable: "country" },
    ],
  },
  {
    entityName: "bankAccount",
    fields: [
      { fieldName: "iban", fieldType: "text", labelEn: "IBAN", labelDe: "IBAN", isRequired: true },
      { fieldName: "bic", fieldType: "text", labelEn: "BIC", labelDe: "BIC" },
      { fieldName: "bankName", fieldType: "text", labelEn: "Bank Name", labelDe: "Bankname" },
      { fieldName: "isDefault", fieldType: "boolean", labelEn: "Default", labelDe: "Standard" },
    ],
  },
  {
    entityName: "numberSequence",
    fields: [
      { fieldName: "prefix", fieldType: "text", labelEn: "Prefix", labelDe: "Präfix", isRequired: true },
      { fieldName: "nextValue", fieldType: "integer", labelEn: "Next Value", labelDe: "Nächster Wert", isRequired: true },
      { fieldName: "padding", fieldType: "integer", labelEn: "Padding", labelDe: "Auffüllung", isRequired: true },
    ],
  },
  {
    entityName: "paymentTerm",
    fields: [
      { fieldName: "name", fieldType: "text", labelEn: "Name", labelDe: "Name", isRequired: true },
      { fieldName: "netDays", fieldType: "integer", labelEn: "Net Days", labelDe: "Tage netto", isRequired: true },
      { fieldName: "discountDays", fieldType: "integer", labelEn: "Discount Days", labelDe: "Skontotage" },
      { fieldName: "discountPercentage", fieldType: "numeric", labelEn: "Discount %", labelDe: "Skonto %" },
    ],
  },
  {
    entityName: "shippingMethod",
    fields: [
      { fieldName: "name", fieldType: "text", labelEn: "Name", labelDe: "Name", isRequired: true },
    ],
  },
  {
    entityName: "priceList",
    fields: [
      { fieldName: "name", fieldType: "text", labelEn: "Name", labelDe: "Name", isRequired: true },
      { fieldName: "isNet", fieldType: "boolean", labelEn: "Net Prices", labelDe: "Nettopreise", isRequired: true },
    ],
  },
  {
    entityName: "discountGroup",
    fields: [
      { fieldName: "name", fieldType: "text", labelEn: "Name", labelDe: "Name", isRequired: true },
      { fieldName: "percentage", fieldType: "numeric", labelEn: "Percentage", labelDe: "Prozent", isRequired: true },
    ],
  },
  {
    entityName: "addressCategory",
    fields: [
      { fieldName: "name", fieldType: "text", labelEn: "Name", labelDe: "Name", isRequired: true },
    ],
  },
  {
    entityName: "documentGroup",
    fields: [
      { fieldName: "name", fieldType: "text", labelEn: "Name", labelDe: "Name", isRequired: true },
      { fieldName: "documentType", fieldType: "text", labelEn: "Document Type", labelDe: "Belegart", isRequired: true },
      { fieldName: "groupNumber", fieldType: "integer", labelEn: "Group Number", labelDe: "Gruppenummer", isRequired: true },
      { fieldName: "direction", fieldType: "text", labelEn: "Direction", labelDe: "Richtung" },
    ],
  },
  {
    entityName: "industry",
    fields: [
      { fieldName: "name", fieldType: "text", labelEn: "Name", labelDe: "Name", isRequired: true },
    ],
  },
  {
    entityName: "unit",
    fields: [
      { fieldName: "code", fieldType: "text", labelEn: "Code", labelDe: "Code", isRequired: true },
      { fieldName: "name", fieldType: "text", labelEn: "Name", labelDe: "Name", isRequired: true },
    ],
  },
  {
    entityName: "articleGroup",
    fields: [
      { fieldName: "code", fieldType: "text", labelEn: "Code", labelDe: "Code", isRequired: true },
      { fieldName: "name", fieldType: "text", labelEn: "Name", labelDe: "Name", isRequired: true },
    ],
  },
  {
    entityName: "warehouse",
    fields: [
      { fieldName: "code", fieldType: "text", labelEn: "Code", labelDe: "Code", isRequired: true },
      { fieldName: "name", fieldType: "text", labelEn: "Name", labelDe: "Name", isRequired: true },
    ],
  },
  {
    entityName: "taxClass",
    fields: [
      { fieldName: "code", fieldType: "text", labelEn: "Code", labelDe: "Code", isRequired: true },
      { fieldName: "name", fieldType: "text", labelEn: "Name", labelDe: "Name", isRequired: true },
    ],
  },
  {
    entityName: "taxCode",
    fields: [
      { fieldName: "code", fieldType: "text", labelEn: "Code", labelDe: "Code", isRequired: true },
      { fieldName: "description", fieldType: "text", labelEn: "Description", labelDe: "Beschreibung" },
      { fieldName: "taxRate", fieldType: "numeric", labelEn: "Tax Rate %", labelDe: "Steuersatz %", isRequired: true },
    ],
  },
  {
    entityName: "costCenter",
    fields: [
      { fieldName: "code", fieldType: "text", labelEn: "Code", labelDe: "Code", isRequired: true },
      { fieldName: "name", fieldType: "text", labelEn: "Name", labelDe: "Name", isRequired: true },
    ],
  },
  {
    entityName: "glAccount",
    fields: [
      { fieldName: "accountNo", fieldType: "text", labelEn: "Account No", labelDe: "Kontonummer", isRequired: true },
      { fieldName: "name", fieldType: "text", labelEn: "Name", labelDe: "Name", isRequired: true },
      { fieldName: "accountType", fieldType: "text", labelEn: "Account Type", labelDe: "Kontoart", isRequired: true },
    ],
  },
  {
    entityName: "currency",
    fields: [
      { fieldName: "code", fieldType: "text", labelEn: "Code", labelDe: "Code", isRequired: true },
      { fieldName: "name", fieldType: "text", labelEn: "Name", labelDe: "Name", isRequired: true },
      { fieldName: "symbol", fieldType: "text", labelEn: "Symbol", labelDe: "Symbol" },
      { fieldName: "decimals", fieldType: "integer", labelEn: "Decimals", labelDe: "Dezimalstellen", isRequired: true },
    ],
  },
  {
    entityName: "country",
    fields: [
      { fieldName: "iso2Code", fieldType: "text", labelEn: "ISO 2", labelDe: "ISO 2", isRequired: true },
      { fieldName: "name", fieldType: "text", labelEn: "Name", labelDe: "Name", isRequired: true },
      { fieldName: "isEu", fieldType: "boolean", labelEn: "EU Member", labelDe: "EU-Mitglied", isRequired: true },
    ],
  },
  {
    entityName: "postalCode",
    fields: [
      { fieldName: "countryCode", fieldType: "text", labelEn: "Country Code", labelDe: "Länderkürzel", isRequired: true },
      { fieldName: "plz", fieldType: "text", labelEn: "Postal Code", labelDe: "PLZ", isRequired: true },
      { fieldName: "city", fieldType: "text", labelEn: "City", labelDe: "Ort", isRequired: true },
    ],
  },
];

async function main() {
  console.log("Seeding tenant_fields for settings entities...");

  let insertedCount = 0;

  for (const entity of entities) {
    for (const field of entity.fields) {
      const result = await db
        .insert(tenantFields)
        .values({
          entityName: entity.entityName,
          fieldName: field.fieldName,
          fieldType: field.fieldType,
          label: { en: field.labelEn, de: field.labelDe },
          scope: "global",
          isVisible: true,
          isRequired: field.isRequired ?? false,
          lookupTable: field.lookupTable,
        })
        .onConflictDoNothing();

      if ((result as { rowCount?: number }).rowCount) {
        insertedCount++;
      }
    }

    console.log(`  ${entity.entityName}: ${entity.fields.length} fields processed`);
  }

  console.log(`Done. Inserted ${insertedCount} new tenant_fields rows (skipped existing).`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Error seeding settings fields:", err);
  process.exit(1);
});
