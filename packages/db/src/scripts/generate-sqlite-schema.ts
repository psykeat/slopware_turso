import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SOURCE = join(__dirname, "../schema/app.schema.ts");
const TARGET = join(__dirname, "../schema/sqlite.schema.ts");

const skippedTables = new Set(["tenant", "userTenant"]);

function countChar(line: string, char: string): number {
  return [...line].filter((candidate) => candidate === char).length;
}

function removeTenantIdProperty(lines: string[]): string[] {
  const result: string[] = [];
  let skipping = false;
  let depth = 0;

  for (const line of lines) {
    if (!skipping && /^\s+tenantId:\s/.test(line)) {
      skipping = true;
      depth = 0;
    }

    if (skipping) {
      depth += countChar(line, "(") + countChar(line, "{") + countChar(line, "[");
      depth -= countChar(line, ")") + countChar(line, "}") + countChar(line, "]");

      if (depth <= 0 && line.trimEnd().endsWith(",")) {
        skipping = false;
      }
      continue;
    }

    result.push(line);
  }

  return result;
}

function compactTenantIndexes(source: string): string {
  let output = source;

  output = output.replace(
    /^\s*(?:uniqueIndex|unique|index)\("[^"]+"\)\.on\([A-Za-z_$][\w$]*\.tenantId\),?\n/gm,
    "",
  );
  output = output.replace(/[A-Za-z_$][\w$]*\.tenantId,\s*/g, "");
  output = output.replace(/,\s*[A-Za-z_$][\w$]*\.tenantId/g, "");
  output = output.replace(/\(\s*[A-Za-z_$][\w$]*\.tenantId\s*\)/g, "()");
  output = output.replace(/^\s*(?:uniqueIndex|unique|index)\("[^"]+"\)\.on\(\),?\n/gm, "");
  output = output.replace(/^\s*(?:uniqueIndex|unique|index)\("[^"]+"\)\.on\(\s*\n\s*\),?\n/gm, "");
  output = output.replace(
    /\([A-Za-z_$][\w$]*\)\s*=>\s*\[\s*(?:uniqueIndex|unique|index)\("[^"]+"\)\.on\(\),?\s*\]/g,
    "() => []",
  );
  output = output.replace(/tenant_id/g, "tenant");

  return output;
}

function transformColumns(source: string): string {
  let output = source;

  output = output.replace(/\bpgTable\(/g, "sqliteTable(");
  output = output.replace(/\bpgEnum\(/g, "sqliteEnum(");
  output = output.replace(/\buuid\(/g, "text(");
  output = output.replace(/\bvarchar\(([^,\n]+),\s*\{\s*length:\s*[^}]+\}\)/g, "text($1)");
  output = output.replace(/\bchar\(([^,\n]+),\s*\{\s*length:\s*[^}]+\}\)/g, "text($1)");
  output = output.replace(/\bboolean\(([^)]*)\)/g, 'integer($1, { mode: "boolean" })');
  output = output.replace(
    /\btimestamp\(([^,\n]+),\s*\{\s*withTimezone:\s*true,?\s*\}\)/g,
    'integer($1, { mode: "timestamp_ms" })',
  );
  output = output.replace(/\bdate\(([^)]*)\)/g, "text($1)");
  output = output.replace(/\bjsonb\(([^)]*)\)/g, 'text($1, { mode: "json" })');
  output = output.replace(/\bnumeric\(([^,\n]+),\s*\{[^)]*\}\)/g, "numeric($1)");
  output = output.replace(/\.default\(sql`uuidv7\(\)`\)/g, ".$defaultFn(() => randomUUID())");
  output = output.replace(
    /\.default\(sql`now\(\)`\)/g,
    ".default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`)",
  );
  output = output.replace(
    /\.defaultNow\(\)/g,
    ".default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`)",
  );
  output = output.replace(/tenant_id/g, "tenant");

  return output;
}

function transformTableBlock(tableName: string, lines: string[]): string[] {
  if (skippedTables.has(tableName)) return [];

  const withoutTenantId = removeTenantIdProperty(lines);
  const transformed = compactTenantIndexes(transformColumns(withoutTenantId.join("\n")));
  return transformed.split("\n");
}

function transformSchema(source: string): string {
  const bodyStart = source.indexOf("// Core Infrastructure");
  if (bodyStart === -1) {
    throw new Error("Could not find app.schema.ts body start");
  }

  const bodyLines = source.slice(bodyStart).split("\n");
  const transformedLines: string[] = [];

  for (let i = 0; i < bodyLines.length; i += 1) {
    const line = bodyLines[i];
    const tableMatch = line.match(/^export const (\w+) = pgTable\(/);
    if (!tableMatch) {
      transformedLines.push(transformColumns(line));
      continue;
    }

    const tableName = tableMatch[1]!;
    const tableBlock = [line];
    while (i + 1 < bodyLines.length) {
      i += 1;
      tableBlock.push(bodyLines[i]!);
      if (bodyLines[i]!.trim() === ");") break;
    }

    transformedLines.push(...transformTableBlock(tableName, tableBlock));
  }

  const header = `// This file is auto-generated from app.schema.ts. Do not edit manually.
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
      .default(sql\`(cast((julianday('now') - 2440587.5)*86400000 as integer))\`),
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
    batchId: text("batch_id").notNull().references(() => postingBatch.batchId),
    documentLineId: text("document_line_id"),
    variantId: text("variant_id"),
    qtyDelta: numeric("qty_delta"),
    amountDelta: numeric("amount_delta"),
    accountCode: text("account_code"),
    entryType: text("entry_type").notNull(),
    description: text("description"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql\`(cast((julianday('now') - 2440587.5)*86400000 as integer))\`),
  },
  (table) => [
    index("idx_posting_entry_batch").on(table.batchId),
    index("idx_posting_entry_document_line").on(table.documentLineId),
    index("idx_posting_entry_variant").on(table.variantId),
  ],
);

`;

  return `${header}${transformedLines.join("\n")}\n`;
}

const source = readFileSync(SOURCE, "utf8");
const output = transformSchema(source);
writeFileSync(TARGET, output);
console.log(`Generated ${TARGET}`);
