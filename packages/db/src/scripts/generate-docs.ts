import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getTableConfig } from "drizzle-orm/pg-core";

import * as schema from "../schema/index";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "../../../../");
const SCHEMA_MD_PATH_GEMINI = path.join(PROJECT_ROOT, ".gemini/schema.md");
const SCHEMA_MD_PATH_AGENTS = path.join(PROJECT_ROOT, ".agents/schema.md");
const SCHEMAS_DIR_AGENTS = path.join(PROJECT_ROOT, ".agents/schema");

interface Annotation {
  businessName: string;
  description: string;
}

const annotations: Record<string, Record<string, Annotation>> = {};

function parseExistingSchema() {
  // 1. Try to parse from individual modular schema files if they exist
  if (fs.existsSync(SCHEMAS_DIR_AGENTS)) {
    const files = fs.readdirSync(SCHEMAS_DIR_AGENTS);
    let loadedFromModules = false;
    for (const file of files) {
      if (!file.endsWith(".md")) continue;
      const tableName = file.slice(0, -3); // remove ".md"
      const content = fs.readFileSync(path.join(SCHEMAS_DIR_AGENTS, file), "utf-8");
      annotations[tableName] = {};
      loadedFromModules = true;

      const rows = content.split("\n");
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
    if (loadedFromModules) {
      console.log("Loaded existing annotations from modular schema files.");
      return;
    }
  }

  // 2. Fallback: parse from the single giant schema.md file (Gemini or Agents path)
  const fallbackPath = fs.existsSync(SCHEMA_MD_PATH_GEMINI)
    ? SCHEMA_MD_PATH_GEMINI
    : fs.existsSync(SCHEMA_MD_PATH_AGENTS)
      ? SCHEMA_MD_PATH_AGENTS
      : null;

  if (!fallbackPath) return;

  console.log(`Migrating annotations from single schema file: ${fallbackPath}`);
  const content = fs.readFileSync(fallbackPath, "utf-8");
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
  // Ensure the target directory for individual schemas exists
  if (!fs.existsSync(SCHEMAS_DIR_AGENTS)) {
    fs.mkdirSync(SCHEMAS_DIR_AGENTS, { recursive: true });
  }

  // Filter for Drizzle table objects.
  const tables = Object.entries(schema)
    .filter(([_, value]) => {
      if (!value || typeof value !== "object") return false;
      const symbols = Object.getOwnPropertySymbols(value).map((s) => s.toString());
      return symbols.includes("Symbol(drizzle:IsDrizzleTable)");
    })
    .map(([_, table]) => table as any);

  console.log("Found tables:", tables.length);

  // Generate individual table markdown files
  for (const table of tables) {
    const config = getTableConfig(table);
    const tableName = config.name;
    const tableFile = path.join(SCHEMAS_DIR_AGENTS, `${tableName}.md`);

    let tableMd = `# Table: \`${tableName}\`\n\n`;
    tableMd += `> _⚠ pending annotation_\n\n`;
    tableMd += `| Column | Business Name | Type | Class | Constraints | Description |\n`;
    tableMd += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;

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

      tableMd += `| ${colName} | ${annotation.businessName} | ${colType} | ${isPK ? "PK" : "—"} | ${constraints.join(", ")} | ${annotation.description} |\n`;
    }

    tableMd += `\n`;

    if (config.indexes.length > 0) {
      for (const index of config.indexes) {
        const idxConfig = (index as any).config;
        const columns = idxConfig.columns.map((c: any) => c.name).join(", ");
        tableMd += `> INDEX \`${idxConfig.name}\` (${columns}) [${idxConfig.method || "btree"}]\n`;
      }
      tableMd += `\n`;
    }

    if (config.checks && config.checks.length > 0) {
      for (const check of config.checks) {
        tableMd += `> CHECK \`${check.name}\`: ${check.value.toString().replace("sql`", "").replace("`", "")}\n`;
      }
      tableMd += `\n`;
    }

    fs.writeFileSync(tableFile, tableMd);
  }

  // Sort tables by name
  tables.sort((a, b) => getTableConfig(a).name.localeCompare(getTableConfig(b).name));

  // Generate the main index markdown file (schema.md)
  let md = `# Slopware — Live Schema Index\n\n`;
  md += `> Generated: ${new Date().toISOString().replace("T", " ").split(".")[0]} UTC\n`;
  md += `> Tables: ${tables.length}\n\n`;
  md += `Here is the index of all database tables. Click on a table name to view its detailed columns, types, and business annotations.\n\n`;
  md += `## Tables\n\n`;

  for (const table of tables) {
    const config = getTableConfig(table);
    const tableName = config.name;
    const pkCol = config.columns.find((c) => c.primary)?.name || "id";
    const recordAnnotation = annotations[tableName]?.[pkCol] || { businessName: tableName };
    const label =
      recordAnnotation.businessName !== tableName ? ` (_${recordAnnotation.businessName}_)` : "";

    md += `- [${tableName}](file:///home/ubuntu/slopware/.agents/schema/${tableName}.md)${label}\n`;
  }

  // Write index to both .gemini/schema.md and .agents/schema.md for perfect parity
  fs.writeFileSync(SCHEMA_MD_PATH_GEMINI, md);
  fs.writeFileSync(SCHEMA_MD_PATH_AGENTS, md);
  console.log(`Generated schema index at ${SCHEMA_MD_PATH_GEMINI} and ${SCHEMA_MD_PATH_AGENTS}`);
  console.log(`Generated ${tables.length} individual table schemas in ${SCHEMAS_DIR_AGENTS}`);
}

parseExistingSchema();
generateMarkdown();
