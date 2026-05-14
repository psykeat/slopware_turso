import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getTableConfig } from "drizzle-orm/pg-core";

import * as schema from "../schema/index";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "../../../../");
const SCHEMA_MD_PATH = path.join(PROJECT_ROOT, ".gemini/schema.md");

interface Annotation {
  businessName: string;
  description: string;
}

const annotations: Record<string, Record<string, Annotation>> = {};

function parseExistingSchema() {
  if (!fs.existsSync(SCHEMA_MD_PATH)) return;

  const content = fs.readFileSync(SCHEMA_MD_PATH, "utf-8");
  const tableSections = content.split(/### `?([^`\n]+)`?/);

  for (let i = 1; i < tableSections.length; i += 2) {
    const tableName = tableSections[i].trim();
    const tableBody = tableSections[i + 1];

    annotations[tableName] = {};

    const rows = tableBody.split("\n");
    for (const row of rows) {
      if (row.startsWith("|") && !row.includes("Column") && !row.includes("---")) {
        const parts = row.split("|").map((p) => p.trim());
        if (parts.length >= 7) {
          const columnName = parts[1];
          const businessName = parts[2];
          const description = parts[6];
          annotations[tableName][columnName] = { businessName, description };
        }
      }
    }
  }
}

function generateMarkdown() {
  // Filter for Drizzle table objects.
  const tables = Object.entries(schema)
    .filter(([_, value]) => {
      if (!value || typeof value !== "object") return false;
      const symbols = Object.getOwnPropertySymbols(value).map((s) => s.toString());
      return symbols.includes("Symbol(drizzle:IsDrizzleTable)");
    })
    .map(([_, table]) => table as any);

  console.log("Found tables:", tables.length);

  let md = `# Slopware — Live Schema\n\n`;
  md += `> Generated: ${new Date().toISOString().replace("T", " ").split(".")[0]} UTC\n`;
  md += `> Tables: ${tables.length}\n\n`;

  md += `## Module: uncategorized\n\n`;

  // Sort tables by name
  tables.sort((a, b) => getTableConfig(a).name.localeCompare(getTableConfig(b).name));

  for (const table of tables) {
    const config = getTableConfig(table);
    const tableName = config.name;

    md += `### \`${tableName}\`\n\n`;
    md += `> _⚠ pending annotation_\n\n`;
    md += `| Column | Business Name | Type | Class | Constraints | Description |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;

    for (const column of config.columns) {
      const colName = column.name;
      const colType = column.getSQLType();
      const isPK = column.primary;
      const constraints: string[] = [];
      if (column.notNull) constraints.push("NOT NULL");
      if (column.default) {
        const def = (column as any).default;
        let defStr = "";
        if (typeof def === "function") {
          defStr = "runtime";
        } else if (def && typeof def === "object" && "queryChunks" in def) {
          // It's a SQL object
          defStr = (def as any).queryChunks
            .map((c: any) => {
              if (typeof c === "string") return c;
              if (c && typeof c === "object") {
                if ("sql" in c) return c.sql;
                if ("value" in c && Array.isArray(c.value)) return c.value.join("");
              }
              return String(c);
            })
            .join("");
        } else {
          defStr = def.toString();
        }
        constraints.push("DEFAULT " + defStr);
      }

      const annotation = annotations[tableName]?.[colName] || {
        businessName: colName,
        description: "",
      };

      md += `| ${colName} | ${annotation.businessName} | ${colType} | ${isPK ? "PK" : "—"} | ${constraints.join(", ")} | ${annotation.description} |\n`;
    }

    md += `\n`;

    if (config.indexes.length > 0) {
      for (const index of config.indexes) {
        const idxConfig = (index as any).config;
        const columns = idxConfig.columns.map((c: any) => c.name).join(", ");
        md += `> INDEX \`${idxConfig.name}\` (${columns}) [${idxConfig.method || "btree"}]\n`;
      }
      md += `\n`;
    }

    if (config.checks && config.checks.length > 0) {
      for (const check of config.checks) {
        md += `> CHECK \`${check.name}\`: ${check.value.toString().replace("sql`", "").replace("`", "")}\n`;
      }
      md += `\n`;
    }
  }

  fs.writeFileSync(SCHEMA_MD_PATH, md);
  console.log(`Generated schema docs at ${SCHEMA_MD_PATH}`);
}

parseExistingSchema();
generateMarkdown();
