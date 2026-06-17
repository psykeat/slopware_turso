import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { eq, sql } from "drizzle-orm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from apps/web/.env
dotenv.config({ path: path.resolve(__dirname, "../../../../apps/web/.env") });

import { db } from "../index";
import * as schema from "../schema/app.schema";
import { isScriptEntry } from "./script-main";

const DOCUMENT_TYPES_CONFIG = [
  { code: "N", name: "Angebot", movementType: "N", sortOrder: 10 },
  { code: "A", name: "Auftrag", movementType: "A", sortOrder: 20 },
  { code: "L", name: "Lieferschein", movementType: "L", sortOrder: 30 },
  { code: "R", name: "Rechnung", movementType: "R", sortOrder: 40 },
  { code: "G", name: "Gutschrift", movementType: "G", sortOrder: 50 },
  { code: "b", name: "Bestellung", movementType: "b", sortOrder: 60 },
  { code: "l", name: "WE-Lieferschein", movementType: "l", sortOrder: 70 },
  { code: "r", name: "WE-Rechnung", movementType: "r", sortOrder: 80 },
  { code: "g", name: "WE-Gutschrift", movementType: "g", sortOrder: 90 },
  { code: "V", name: "Inventurbuchung", movementType: "V", sortOrder: 100 },
  { code: "Z", name: "Zubuchung", movementType: "Z", sortOrder: 110 },
  { code: "E", name: "Entnahme", movementType: "E", sortOrder: 120 },
  { code: "U", name: "Umlagerung", movementType: "U", sortOrder: 130 },
  { code: "p", name: "Produktionsausgang", movementType: "p", sortOrder: 140 },
  { code: "q", name: "Produktionseingang", movementType: "q", sortOrder: 150 },
];

/**
 * Seed document types, year-2026 number sequences and canonical document groups
 * (incl. production movement types p + q) into one tenant. Idempotent. Reused by
 * the base seed (main below) and the test tenant reseed (seed-test-tenant.ts).
 */
export async function seedDocumentSequencesForTenant(
  tenantId: string,
  companyId: string,
): Promise<void> {
  for (const dt of DOCUMENT_TYPES_CONFIG) {
    // 1. Ensure Document Type exists
    await db
      .insert(schema.documentType)
      .values({
        tenantId,
        code: dt.code,
        name: dt.name,
        movementType: dt.movementType,
        sortOrder: dt.sortOrder,
        requiresWarehouse: true,
        requiresCostCenter: false,
      })
      .onConflictDoUpdate({
        target: [schema.documentType.tenantId, schema.documentType.code],
        set: {
          name: sql`excluded.name`,
          movementType: sql`excluded.movement_type`,
          sortOrder: sql`excluded.sort_order`,
        },
      });

    // 2. Ensure year-2026 Number Sequence exists (Prefix = single character, e.g. "N")
    const currentYear = new Date().getFullYear();
    const [seqRow] = await db
      .insert(schema.numberSequence)
      .values({
        tenantId,
        companyId,
        prefix: dt.movementType,
        fiscalYear: currentYear,
        nextValue: 26000000,
        padding: 8,
      })
      .onConflictDoUpdate({
        target: [
          schema.numberSequence.tenantId,
          schema.numberSequence.companyId,
          schema.numberSequence.prefix,
          schema.numberSequence.fiscalYear,
        ],
        set: {
          padding: sql`excluded.padding`,
          archived: false,
        },
      })
      .returning();

    // 3. Ensure canonical Document Group exists and is linked to the year-2026 Number Sequence
    await db
      .insert(schema.documentGroup)
      .values({
        tenantId,
        companyId,
        name: dt.name,
        documentType: dt.movementType,
        groupNumber: 0,
        numberSequenceId: seqRow.numberSequenceId,
        requireSerialTracking: false,
        requireBatchTracking: false,
      })
      .onConflictDoUpdate({
        target: [
          schema.documentGroup.tenantId,
          schema.documentGroup.documentType,
          schema.documentGroup.groupNumber,
        ],
        set: {
          name: sql`excluded.name`,
          numberSequenceId: sql`excluded.number_sequence_id`,
          companyId: sql`excluded.company_id`,
          archived: false,
        },
      });
  }
}

async function main() {
  console.log("Resolving tenants in database...");
  const tenants = await db.select().from(schema.tenant).where(eq(schema.tenant.isBase, true));

  if (tenants.length === 0) {
    throw new Error("No tenants found in the database. Run seed first.");
  }

  console.log(
    `Found ${tenants.length} tenants. Seeding year-2026 number sequences & document groups...`,
  );

  for (const tenant of tenants) {
    const [comp] = await db
      .select()
      .from(schema.company)
      .where(eq(schema.company.tenantId, tenant.tenantId))
      .limit(1);

    if (!comp) {
      console.warn(
        `  Warning: No company found for tenant: "${tenant.name}". Skipping sequence configuration.`,
      );
      continue;
    }

    await seedDocumentSequencesForTenant(tenant.tenantId, comp.companyId);
    console.log(
      `  Seeded/updated ${DOCUMENT_TYPES_CONFIG.length} document types, year-2026 number sequences, and canonical document groups for "${tenant.name}".`,
    );
  }

  console.log("Document sequences & groups configured successfully!");
  process.exit(0);
}

if (isScriptEntry(import.meta.url)) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
    console.error("Document sequence seeding failed:", message);
    process.exit(1);
  });
}
