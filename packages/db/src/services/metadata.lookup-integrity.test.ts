import assert from "node:assert/strict";
import test, { after } from "node:test";

import { entityActionManifest } from "@repo/registry";
import { eq, getColumns } from "drizzle-orm";

import "../scripts/load-env";
import { closeDb, db, runInTenantScope } from "../index";
import { helperTableRegistry, tenantFields } from "../schema/sqlite.schema";
import {
  discoverTables,
  resolveExplicitLookupTable,
  resolveLookupMetadata,
  resolveLookupTable,
} from "./metadata";

type ColumnFamily = "uuid" | "character" | "other";

function columnFamily(columnType: string | undefined): ColumnFamily {
  if (columnType === "PgUUID") return "uuid";
  if (columnType === "PgVarchar" || columnType === "PgChar" || columnType === "PgText")
    return "character";
  return "other";
}

test("every curated lookup column points at an existing, type-compatible list action", async () => {
  // tenantFields.lookupTable rows are auto-seeded by discoverSchemaMetadata()
  // for EVERY column (explicit and generic-fallback alike — verified against
  // the live DB: `account.userId` has a global override row even though it
  // only matches the generic *Id fallback), so a DB row is not itself a
  // signal of deliberate curation. Only resolveExplicitLookupTable's
  // hand-written branches are — that's what gets the strict check. The
  // generic *Id-suffix fallback also matches plenty of internal FKs that
  // were never meant to back a UI dropdown (e.g. `userId` -> `user`,
  // `sessionId` -> `session`), so it's only checked for type-compatibility
  // when a list capability happens to exist, never asserted to have one. A
  // tenant-level (non-global) override is still honored when present, since
  // that's the one place a human could genuinely have customized this.
  await runInTenantScope({ tenantId: "base" }, async () => {
    const tenantOverrides = await db
      .select()
      .from(tenantFields)
      .where(eq(tenantFields.scope, "tenant"));
    const tenantOverrideMap = new Map<string, string>();
    for (const f of tenantOverrides) {
      if (f.lookupTable) tenantOverrideMap.set(`${f.entityName}.${f.fieldName}`, f.lookupTable);
    }

    const registries = await db.select().from(helperTableRegistry);
    const tables = discoverTables();
    const tableByName = new Map(tables.map((t) => [t.key, t.table]));

    for (const { key: entityName, table } of tables) {
      const columns = getColumns(table) as Record<string, any>;

      for (const [colName, col] of Object.entries(columns)) {
        if (col.primary) continue; // PKs are never lookup-dropdown candidates

        const explicitTarget = resolveExplicitLookupTable(entityName, colName);
        const isCurated = Boolean(explicitTarget);
        const lookupTable =
          tenantOverrideMap.get(`${entityName}.${colName}`) ??
          resolveLookupTable(entityName, colName);
        if (!lookupTable) continue;

        const targetTable = tableByName.get(lookupTable);
        if (!targetTable) continue; // resolveLookupTable already only returns names backed by a real schema export

        const listOp = entityActionManifest[lookupTable]?.ops?.list;
        if (isCurated) {
          assert.ok(
            listOp,
            `${entityName}.${colName} is a curated lookup -> "${lookupTable}", which has no list action`,
          );
        } else if (!listOp) {
          continue; // best-effort generic match with no capability — not asserted
        }

        const meta = resolveLookupMetadata({ lookupTable }, registries);
        const targetColumns = getColumns(targetTable) as Record<string, any>;
        const valueCol = meta.inferredValueColumn
          ? targetColumns[meta.inferredValueColumn]
          : undefined;
        if (!valueCol) continue;

        const sourceFamily = columnFamily(col.columnType);
        const targetFamily = columnFamily(valueCol.columnType);
        assert.equal(
          sourceFamily,
          targetFamily,
          `${entityName}.${colName} (${col.columnType}) -> ${lookupTable}.${meta.inferredValueColumn} (${valueCol.columnType}): incompatible type family`,
        );

        if (sourceFamily === "character" && col.length != null && valueCol.length != null) {
          assert.equal(
            col.length,
            valueCol.length,
            `${entityName}.${colName} (length ${col.length}) -> ${lookupTable}.${meta.inferredValueColumn} (length ${valueCol.length}): length mismatch`,
          );
        }
      }
    }
  });
});

after(async () => {
  await closeDb();
});
