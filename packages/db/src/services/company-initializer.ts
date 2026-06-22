import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { eq, and, or, sql, inArray } from "drizzle-orm";

import { db } from "../index";
import * as schema from "../schema/sqlite.schema";

interface RawAccount {
  id: string;
  name: string;
  type: string;
  code: string | number;
  leaf: boolean;
}

const TYPE_MAPPING: Record<string, string> = {
  Aktiva: "asset",
  Bank: "asset",
  Forderung: "asset",
  Fremdkapital: "liability",
  Verbindlichkeit: "liability",
  Ertrag: "revenue",
  Aufwand: "expense",
  Eigenkapital: "equity",
};

const AT_EKR_ACCOUNTS = [
  { accountNo: "2800", name: "Bank (Guthaben)", accountType: "asset" },
  { accountNo: "1400", name: "Forderungen aus Lieferungen und Leistungen", accountType: "asset" },
  {
    accountNo: "1600",
    name: "Verbindlichkeiten aus Lieferungen und Leistungen",
    accountType: "liability",
  },
  { accountNo: "4000", name: "Umsatzerlöse 20%", accountType: "revenue" },
  { accountNo: "4010", name: "Umsatzerlöse 10%", accountType: "revenue" },
  { accountNo: "4013", name: "Umsatzerlöse 13%", accountType: "revenue" },
  { accountNo: "5000", name: "Wareneinsatz", accountType: "expense" },
  { accountNo: "7000", name: "Mietaufwand", accountType: "expense" },
  { accountNo: "7300", name: "Porto und Telekommunikation", accountType: "expense" },
  { accountNo: "9000", name: "Eigenkapital", accountType: "equity" },
];

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

const DE_TAX_CLASSES = [
  // Article Tax Classes
  { code: "DE_STANDARD", name: { en: "Standard Tax Rate (19%)", de: "Normalsteuersatz (19%)" } },
  { code: "DE_REDUCED_7", name: { en: "Reduced Tax Rate (7%)", de: "Ermäßigter Steuersatz (7%)" } },
  { code: "DE_EXEMPT", name: { en: "Tax Exempt (0%)", de: "Steuerfrei (0%)" } },
  // Customer/Vendor Tax Classes
  { code: "DE_DOMESTIC", name: { en: "Domestic (Germany)", de: "Inland (Deutschland)" } },
  {
    code: "DE_EU_B2B",
    name: {
      en: "EU B2B (Reverse Charge / Intra-Community)",
      de: "EU B2B (Innergemeinschaftlich / Übergang der Steuerschuld)",
    },
  },
  { code: "DE_EU_B2C", name: { en: "EU B2C (OSS / Local VAT)", de: "EU B2C (OSS / Lokale USt)" } },
  { code: "DE_EXPORT", name: { en: "Export (Non-EU / Third Country)", de: "Drittland / Export" } },
];

const DE_TAX_CODES = [
  // Sales Tax Codes
  { code: "DE-U19", description: "Umsatzsteuer 19% (Normalsteuersatz)", taxRate: "19.00" },
  { code: "DE-U7", description: "Umsatzsteuer 7% (Ermäßigter Steuersatz)", taxRate: "7.00" },
  { code: "DE-U0", description: "Steuerfreie Umsätze (Inland)", taxRate: "0.00" },
  { code: "DE-IGL", description: "Innergemeinschaftliche Lieferung (steuerfrei)", taxRate: "0.00" },
  { code: "DE-EXP", description: "Ausfuhrlieferung in Drittländer (steuerfrei)", taxRate: "0.00" },
  // Purchase Tax Codes
  { code: "DE-V19", description: "Vorsteuer 19% (Normalsteuersatz)", taxRate: "19.00" },
  { code: "DE-V7", description: "Vorsteuer 7% (Ermäßigter Steuersatz)", taxRate: "7.00" },
  {
    code: "DE-RC-19",
    description: "Reverse Charge 19% (Empfänger schuldet USt)",
    taxRate: "19.00",
  },
  {
    code: "DE-IGU-19",
    description: "Innergemeinschaftlicher Erwerb 19% (Vorsteuer abzugsfähig)",
    taxRate: "19.00",
  },
  {
    code: "DE-IGU-7",
    description: "Innergemeinschaftlicher Erwerb 7% (Vorsteuer abzugsfähig)",
    taxRate: "7.00",
  },
];

const DE_RULES_CONFIG = [
  // 1. Domestic standard sales (to DE country code or null as fallback)
  { cust: "DE_DOMESTIC", art: "DE_STANDARD", country: "DE", code: "DE-U19" },
  { cust: "DE_DOMESTIC", art: "DE_REDUCED_7", country: "DE", code: "DE-U7" },
  { cust: "DE_DOMESTIC", art: "DE_EXEMPT", country: "DE", code: "DE-U0" },

  // General fallbacks for domestic (with null country code)
  { cust: "DE_DOMESTIC", art: "DE_STANDARD", country: null, code: "DE-U19" },
  { cust: "DE_DOMESTIC", art: "DE_REDUCED_7", country: null, code: "DE-U7" },
  { cust: "DE_DOMESTIC", art: "DE_EXEMPT", country: null, code: "DE-U0" },

  // 2. EU B2B intra-community sales (tax exempt)
  { cust: "DE_EU_B2B", art: "DE_STANDARD", country: null, code: "DE-IGL" },
  { cust: "DE_EU_B2B", art: "DE_REDUCED_7", country: null, code: "DE-IGL" },
  { cust: "DE_EU_B2B", art: "DE_EXEMPT", country: null, code: "DE-IGL" },

  // 3. EU B2C sales (OSS fallback - standard German rate unless local registration)
  { cust: "DE_EU_B2C", art: "DE_STANDARD", country: null, code: "DE-U19" },
  { cust: "DE_EU_B2C", art: "DE_REDUCED_7", country: null, code: "DE-U7" },
  { cust: "DE_EU_B2C", art: "DE_EXEMPT", country: null, code: "DE-U0" },

  // 4. Third country export sales (tax exempt)
  { cust: "DE_EXPORT", art: "DE_STANDARD", country: null, code: "DE-EXP" },
  { cust: "DE_EXPORT", art: "DE_REDUCED_7", country: null, code: "DE-EXP" },
  { cust: "DE_EXPORT", art: "DE_EXEMPT", country: null, code: "DE-EXP" },
];

function getSkr03JsonPath(): string {
  try {
    let dirname = "";
    if (typeof __dirname !== "undefined") {
      dirname = __dirname;
    } else {
      const filename = fileURLToPath(import.meta.url);
      dirname = path.dirname(filename);
    }
    const relativePath = path.resolve(dirname, "../scripts/skr03.json");
    if (fs.existsSync(relativePath)) {
      return relativePath;
    }
  } catch {
    // Ignore and try fallback
  }

  // Try relative to process.cwd()
  const cwdPaths = [
    path.join(process.cwd(), "packages/db/src/scripts/skr03.json"),
    path.join(process.cwd(), "src/scripts/skr03.json"),
    path.join(process.cwd(), "../packages/db/src/scripts/skr03.json"),
  ];

  for (const p of cwdPaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  throw new Error(
    "Could not locate skr03.json. Ensure the script exists in packages/db/src/scripts/skr03.json",
  );
}

/**
 * Initializes tax codes, GL accounts, default number sequences, warehouses,
 * payment terms, and address categories for a specific company inside a transaction.
 */
export async function initializeCompanyData(
  tenantId: string,
  companyId: string,
  countryCode: "DE" | "AT",
): Promise<void> {
  await db.transaction(async (tx) => {
    // ── 1. Seed Tax Classes, Codes, and Rules ────────────────────────────────
    const taxClassesToSeed = countryCode === "AT" ? TAX_CLASSES : DE_TAX_CLASSES;
    const taxCodesToSeed = countryCode === "AT" ? TAX_CODES : DE_TAX_CODES;
    const rulesConfigToSeed = countryCode === "AT" ? RULES_CONFIG : DE_RULES_CONFIG;

    const taxClassIdMap = new Map<string, string>();
    for (const tc of taxClassesToSeed) {
      const [inserted] = await tx
        .insert(schema.taxClass)
        .values({
          tenantId,
          code: tc.code,
          name: tc.name,
          archived: false,
        })
        .onConflictDoUpdate({
          target: [schema.taxClass.code],
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

    const taxCodeIdMap = new Map<string, string>();
    for (const code of taxCodesToSeed) {
      const [inserted] = await tx
        .insert(schema.taxCode)
        .values({
          tenantId,
          code: code.code,
          description: code.description,
          taxRate: code.taxRate,
          archived: false,
        })
        .onConflictDoUpdate({
          target: [schema.taxCode.code],
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

    // Clear existing rules for seeded classes to keep seeding idempotent
    const classIds = Array.from(taxClassIdMap.values());
    if (classIds.length > 0) {
      await tx
        .delete(schema.taxRule)
        .where(
          or(
            inArray(schema.taxRule.customerTaxClassId, classIds),
            inArray(schema.taxRule.articleTaxClassId, classIds),
          ),
        );
    }

    // Seed Tax Rules
    const rulesToInsert = rulesConfigToSeed.map((rule) => {
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

    if (rulesToInsert.length > 0) {
      await tx.insert(schema.taxRule).values(rulesToInsert);
    }

    // ── 2. Seed länderspezifische GL Accounts (Sachkonten) ───────────────────
    if (countryCode === "DE") {
      const jsonPath = getSkr03JsonPath();
      const rawData = fs.readFileSync(jsonPath, "utf8");
      const accounts: RawAccount[] = JSON.parse(rawData);

      // Filter for leaf accounts with a 4-digit code
      const leafAccounts = accounts.filter(
        (acc) => acc.leaf && typeof acc.code === "string" && acc.code.length === 4,
      );

      const glAccountsToInsert = leafAccounts.map((acc) => {
        const mappedType = TYPE_MAPPING[acc.type];
        return {
          tenantId,
          companyId,
          accountNo: acc.code as string,
          name: acc.name,
          accountType: mappedType || "expense",
          archived: false,
        };
      });

      if (glAccountsToInsert.length > 0) {
        await tx
          .insert(schema.glAccount)
          .values(glAccountsToInsert)
          .onConflictDoUpdate({
            target: [schema.glAccount.accountNo],
            set: {
              companyId: sql`excluded.company_id`,
              name: sql`excluded.name`,
              accountType: sql`excluded.account_type`,
              archived: sql`excluded.archived`,
            },
          });
      }
    } else {
      // Seed AT EKR accounts
      const glAccountsToInsert = AT_EKR_ACCOUNTS.map((acc) => ({
        tenantId,
        companyId,
        accountNo: acc.accountNo,
        name: acc.name,
        accountType: acc.accountType,
        archived: false,
      }));

      await tx
        .insert(schema.glAccount)
        .values(glAccountsToInsert)
        .onConflictDoUpdate({
          target: [schema.glAccount.accountNo],
          set: {
            companyId: sql`excluded.company_id`,
            name: sql`excluded.name`,
            accountType: sql`excluded.account_type`,
            archived: sql`excluded.archived`,
          },
        });
    }

    // ── 3. Seed default Number Sequences ─────────────────────────────────────
    const currentYear = new Date().getFullYear();
    const defaultSequences = [
      { prefix: "RE-", nextValue: 1, padding: 6 },
      { prefix: "AN-", nextValue: 1, padding: 6 },
      { prefix: "LI-", nextValue: 1, padding: 6 },
      { prefix: "AU-", nextValue: 1, padding: 6 },
      { prefix: "GU-", nextValue: 1, padding: 6 },
    ];

    for (const seq of defaultSequences) {
      await tx
        .insert(schema.numberSequence)
        .values({
          tenantId,
          companyId,
          prefix: seq.prefix,
          fiscalYear: currentYear,
          nextValue: seq.nextValue,
          padding: seq.padding,
        })
        .onConflictDoUpdate({
          target: [
            schema.numberSequence.companyId,
            schema.numberSequence.prefix,
            schema.numberSequence.fiscalYear,
          ],
          set: {
            padding: seq.padding,
            archived: false,
          },
        });
    }

    // ── 4. Seed default warehouses, payment terms, and address categories ─────
    // A. Warehouse
    const [wh] = await tx
      .insert(schema.warehouse)
      .values({
        tenantId,
        companyId,
        code: "MAIN",
        name: "Hauptlager",
      })
      .onConflictDoUpdate({
        target: [schema.warehouse.code],
        set: {
          companyId,
          archived: false,
        },
      })
      .returning();

    // Link defaultWarehouseId to company if not already set
    if (wh) {
      const [comp] = await tx
        .select({ defaultWarehouseId: schema.company.defaultWarehouseId })
        .from(schema.company)
        .where(eq(schema.company.companyId, companyId))
        .limit(1);

      if (comp && !comp.defaultWarehouseId) {
        await tx
          .update(schema.company)
          .set({ defaultWarehouseId: wh.warehouseId })
          .where(eq(schema.company.companyId, companyId));
      }
    }

    // B. Payment Terms
    const paymentTermsToSeed = [
      { name: { en: "Immediate Payment", de: "Sofort zahlbar" }, netDays: 0 },
      { name: { en: "14 Days Net", de: "14 Tage netto" }, netDays: 14 },
      { name: { en: "30 Days Net", de: "30 Tage netto" }, netDays: 30 },
    ];

    for (const pt of paymentTermsToSeed) {
      await tx
        .insert(schema.paymentTerm)
        .values({
          tenantId,
          name: pt.name,
          netDays: pt.netDays,
        })
        .onConflictDoNothing();
    }

    // C. Address Categories
    const addressCategoriesToSeed = [
      { name: { en: "Customers", de: "Kunden" } },
      { name: { en: "Suppliers", de: "Lieferanten" } },
      { name: { en: "Prospects", de: "Interessenten" } },
      { name: { en: "Partners", de: "Partner" } },
    ];

    for (const ac of addressCategoriesToSeed) {
      await tx
        .insert(schema.addressCategory)
        .values({
          tenantId,
          name: ac.name,
        })
        .onConflictDoNothing();
    }
  });
}
