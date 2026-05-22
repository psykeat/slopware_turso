import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { eq, sql, and } from "drizzle-orm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from apps/web/.env
dotenv.config({ path: path.resolve(__dirname, "../../../../apps/web/.env") });

import { db } from "../index";
import * as schema from "../schema/app.schema";

const TAX_CLASSES = [
  // Article Tax Classes
  { code: "AT_STANDARD", name: { en: "Standard Tax Rate (20%)", de: "Normalsteuersatz (20%)" } },
  {
    code: "AT_REDUCED_10",
    name: { en: "Reduced Tax Rate (10%)", de: "Ermäßigter Steuersatz (10%)" },
  },
  {
    code: "AT_REDUCED_13",
    name: { en: "Reduced Tax Rate (13%)", de: "Ermäßigter Steuersatz (13%)" },
  },
  { code: "AT_EXEMPT", name: { en: "Tax Exempt (0%)", de: "Steuerfrei (0%)" } },
  // Customer/Vendor Tax Classes
  { code: "AT_DOMESTIC", name: { en: "Domestic (Austria)", de: "Inland (Österreich)" } },
  {
    code: "AT_EU_B2B",
    name: {
      en: "EU B2B (Reverse Charge / Intra-Community)",
      de: "EU B2B (Innergemeinschaftlich / Übergang der Steuerschuld)",
    },
  },
  { code: "AT_EU_B2C", name: { en: "EU B2C (OSS / Local VAT)", de: "EU B2C (OSS / Lokale USt)" } },
  { code: "AT_EXPORT", name: { en: "Export (Non-EU / Third Country)", de: "Drittland / Export" } },
];

const TAX_CODES = [
  // Sales Tax Codes
  { code: "AT-U20", description: "Umsatzsteuer 20% (Normalsteuersatz)", taxRate: "20.00" },
  { code: "AT-U10", description: "Umsatzsteuer 10% (Ermäßigter Steuersatz)", taxRate: "10.00" },
  { code: "AT-U13", description: "Umsatzsteuer 13% (Ermäßigter Steuersatz)", taxRate: "13.00" },
  { code: "AT-U0", description: "Steuerfreie Umsätze (Inland)", taxRate: "0.00" },
  { code: "AT-IGL", description: "Innergemeinschaftliche Lieferung (steuerfrei)", taxRate: "0.00" },
  { code: "AT-EXP", description: "Ausfuhrlieferung in Drittländer (steuerfrei)", taxRate: "0.00" },
  // Purchase Tax Codes
  { code: "AT-V20", description: "Vorsteuer 20% (Normalsteuersatz)", taxRate: "20.00" },
  { code: "AT-V10", description: "Vorsteuer 10% (Ermäßigter Steuersatz)", taxRate: "10.00" },
  { code: "AT-V13", description: "Vorsteuer 13% (Ermäßigter Steuersatz)", taxRate: "13.00" },
  {
    code: "AT-RC-20",
    description: "Reverse Charge 20% (Empfänger schuldet USt)",
    taxRate: "20.00",
  },
  {
    code: "AT-IGU-20",
    description: "Innergemeinschaftlicher Erwerb 20% (Vorsteuer abzugsfähig)",
    taxRate: "20.00",
  },
  {
    code: "AT-IGU-10",
    description: "Innergemeinschaftlicher Erwerb 10% (Vorsteuer abzugsfähig)",
    taxRate: "10.00",
  },
];

const RULES_CONFIG = [
  // 1. Domestic standard sales (to AT country code or null as fallback)
  { cust: "AT_DOMESTIC", art: "AT_STANDARD", country: "AT", code: "AT-U20" },
  { cust: "AT_DOMESTIC", art: "AT_REDUCED_10", country: "AT", code: "AT-U10" },
  { cust: "AT_DOMESTIC", art: "AT_REDUCED_13", country: "AT", code: "AT-U13" },
  { cust: "AT_DOMESTIC", art: "AT_EXEMPT", country: "AT", code: "AT-U0" },

  // General fallbacks for domestic (with null country code)
  { cust: "AT_DOMESTIC", art: "AT_STANDARD", country: null, code: "AT-U20" },
  { cust: "AT_DOMESTIC", art: "AT_REDUCED_10", country: null, code: "AT-U10" },
  { cust: "AT_DOMESTIC", art: "AT_REDUCED_13", country: null, code: "AT-U13" },
  { cust: "AT_DOMESTIC", art: "AT_EXEMPT", country: null, code: "AT-U0" },

  // 2. EU B2B intra-community sales (tax exempt)
  { cust: "AT_EU_B2B", art: "AT_STANDARD", country: null, code: "AT-IGL" },
  { cust: "AT_EU_B2B", art: "AT_REDUCED_10", country: null, code: "AT-IGL" },
  { cust: "AT_EU_B2B", art: "AT_REDUCED_13", country: null, code: "AT-IGL" },
  { cust: "AT_EU_B2B", art: "AT_EXEMPT", country: null, code: "AT-IGL" },

  // 3. EU B2C sales (OSS fallback - standard Austrian rate unless local registration)
  { cust: "AT_EU_B2C", art: "AT_STANDARD", country: null, code: "AT-U20" },
  { cust: "AT_EU_B2C", art: "AT_REDUCED_10", country: null, code: "AT-U10" },
  { cust: "AT_EU_B2C", art: "AT_REDUCED_13", country: null, code: "AT-U13" },
  { cust: "AT_EU_B2C", art: "AT_EXEMPT", country: null, code: "AT-U0" },

  // 4. Third country export sales (tax exempt)
  { cust: "AT_EXPORT", art: "AT_STANDARD", country: null, code: "AT-EXP" },
  { cust: "AT_EXPORT", art: "AT_REDUCED_10", country: null, code: "AT-EXP" },
  { cust: "AT_EXPORT", art: "AT_REDUCED_13", country: null, code: "AT-EXP" },
  { cust: "AT_EXPORT", art: "AT_EXEMPT", country: null, code: "AT-EXP" },
];

async function main() {
  console.log("Resolving tenants in database...");
  const tenants = await db.select().from(schema.tenant);

  if (tenants.length === 0) {
    throw new Error("No tenants found in the database. Run seed first.");
  }

  console.log(`Found ${tenants.length} tenants. Seeding Austrian taxes...`);

  for (const tenant of tenants) {
    const tenantId = tenant.tenantId;
    console.log(`Processing tenant: "${tenant.name}" (${tenantId})`);

    // 1. Seed Tax Classes
    const taxClassIdMap = new Map<string, string>();
    for (const tc of TAX_CLASSES) {
      const [inserted] = await db
        .insert(schema.taxClass)
        .values({
          tenantId,
          code: tc.code,
          name: tc.name,
          archived: false,
        })
        .onConflictDoUpdate({
          target: [schema.taxClass.tenantId, schema.taxClass.code],
          set: {
            name: sql`excluded.name`,
            archived: false,
          },
        })
        .returning();

      if (inserted) {
        taxClassIdMap.set(inserted.code, inserted.taxClassId);
      }
    }
    console.log(`  Upserted ${TAX_CLASSES.length} tax classes.`);

    // 2. Seed Tax Codes
    const taxCodeIdMap = new Map<string, string>();
    for (const code of TAX_CODES) {
      const [inserted] = await db
        .insert(schema.taxCode)
        .values({
          tenantId,
          code: code.code,
          description: code.description,
          taxRate: code.taxRate,
          archived: false,
        })
        .onConflictDoUpdate({
          target: [schema.taxCode.tenantId, schema.taxCode.code],
          set: {
            description: sql`excluded.description`,
            taxRate: sql`excluded.tax_rate`,
            archived: false,
          },
        })
        .returning();

      if (inserted) {
        taxCodeIdMap.set(inserted.code, inserted.taxCodeId);
      }
    }
    console.log(`  Upserted ${TAX_CODES.length} tax codes.`);

    // 3. Clear existing rules for seeded classes to keep seeding idempotent
    const classIds = Array.from(taxClassIdMap.values());
    if (classIds.length > 0) {
      await db
        .delete(schema.taxRule)
        .where(
          and(
            eq(schema.taxRule.tenantId, tenantId),
            sql`${schema.taxRule.customerTaxClassId} IN ${classIds} OR ${schema.taxRule.articleTaxClassId} IN ${classIds}`,
          ),
        );
    }

    // 4. Seed Tax Rules
    const rulesToInsert = RULES_CONFIG.map((rule) => {
      const customerTaxClassId = rule.cust ? taxClassIdMap.get(rule.cust) : null;
      const articleTaxClassId = rule.art ? taxClassIdMap.get(rule.art) : null;
      const taxCodeId = taxCodeIdMap.get(rule.code);

      if (!taxCodeId) {
        throw new Error(`Tax Code ID not found for code: ${rule.code}`);
      }

      return {
        tenantId,
        customerTaxClassId: customerTaxClassId ?? null,
        articleTaxClassId: articleTaxClassId ?? null,
        countryCode: rule.country ?? null,
        taxCodeId,
        validFrom: "2020-01-01",
      };
    });

    await db.insert(schema.taxRule).values(rulesToInsert);
    console.log(`  Seeded ${rulesToInsert.length} tax rules.`);
  }

  console.log("Austrian taxes successfully configured!");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  console.error("Austrian tax seeding failed:", message);
  process.exit(1);
});
