import "./load-env";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { eq, sql } from "drizzle-orm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


import { db } from "../index";
import * as schema from "../schema/app.schema";

interface RawAccount {
  id: string;
  name: string;
  type: string;
  code: string | number;
  leaf: boolean;
}

// Mapping of German account types from SKR03 JSON to English financial categories
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

async function main() {
  console.log("Resolving base tenant from database...");
  const [baseTenant] = await db
    .select()
    .from(schema.tenant)
    .where(eq(schema.tenant.isBase, true))
    .limit(1);

  if (!baseTenant) {
    throw new Error("Base tenant (isBase = true) not found in the database.");
  }

  const baseTenantId = baseTenant.tenantId;
  console.log(`Found base tenant: "${baseTenant.name}" (${baseTenantId})`);

  console.log(`Resolving company for base tenant: ${baseTenantId}`);
  const [baseCompany] = await db
    .select()
    .from(schema.company)
    .where(eq(schema.company.tenantId, baseTenantId))
    .limit(1);

  if (!baseCompany) {
    throw new Error(`Base company not found for tenant: ${baseTenantId}`);
  }

  const companyId = baseCompany.companyId;
  console.log(`Found base company: "${baseCompany.name}" (${companyId})`);

  // Read SKR03 accounts from the JSON file
  const jsonPath = path.resolve(__dirname, "skr03.json");
  console.log(`Reading SKR03 accounts from: ${jsonPath}`);
  const rawData = fs.readFileSync(jsonPath, "utf8");
  const accounts: RawAccount[] = JSON.parse(rawData);

  // Filter for leaf accounts with a valid 4-digit code
  const leafAccounts = accounts.filter(
    (acc) => acc.leaf && typeof acc.code === "string" && acc.code.length === 4,
  );

  console.log(`Parsed ${leafAccounts.length} SKR03 leaf accounts. Preparing insert...`);

  const valuesToInsert = leafAccounts.map((acc) => {
    const mappedType = TYPE_MAPPING[acc.type];
    if (!mappedType) {
      console.warn(
        `Warning: unknown account type "${acc.type}" for account ${acc.code} (${acc.name}). Defaulting to "expense".`,
      );
    }

    return {
      tenantId: baseTenantId,
      companyId: companyId,
      accountNo: acc.code as string,
      name: acc.name,
      accountType: mappedType || "expense",
      archived: false,
    };
  });

  // Perform bulk upsert on conflicts (tenantId, accountNo)
  await db
    .insert(schema.glAccount)
    .values(valuesToInsert)
    .onConflictDoUpdate({
      target: [schema.glAccount.tenantId, schema.glAccount.accountNo],
      set: {
        companyId: sql`excluded.company_id`,
        name: sql`excluded.name`,
        accountType: sql`excluded.account_type`,
        archived: sql`excluded.archived`,
      },
    });

  console.log(
    `SKR03 chart of accounts successfully seeded! Upserted ${valuesToInsert.length} accounts.`,
  );
  process.exit(0);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  console.error("SKR03 seeding failed:", message);
  process.exit(1);
});
