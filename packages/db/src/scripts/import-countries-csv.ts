import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { sql } from "drizzle-orm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from apps/web/.env
dotenv.config({ path: path.resolve(__dirname, "../../../../apps/web/.env") });

import { db } from "../index";
import * as schema from "../schema/app.schema";
// @ts-ignore
import existingCountries from "./countries.json" assert { type: "json" };

const EU_COUNTRIES = new Set([
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
]);

function parseCsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export async function importCountriesCsv() {
  const url =
    "https://raw.githubusercontent.com/lukes/ISO-3166-Countries-with-Regional-Codes/master/all/all.csv";
  console.log(`Fetching countries CSV from ${url}...`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch countries CSV: ${response.statusText}`);
  }

  const csvText = await response.text();
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    throw new Error("CSV file is empty");
  }

  const header = parseCsvLine(lines[0]);
  const nameIdx = header.indexOf("name");
  const alpha2Idx = header.indexOf("alpha-2");
  const alpha3Idx = header.indexOf("alpha-3");

  if (nameIdx === -1 || alpha2Idx === -1 || alpha3Idx === -1) {
    throw new Error(`Missing required CSV columns. Found headers: ${header.join(", ")}`);
  }

  // Create a map of existing German translations from countries.json
  const germanNames = new Map<string, string>();
  for (const c of existingCountries) {
    if (c.iso2Code && c.name?.de) {
      germanNames.set(c.iso2Code.toUpperCase(), c.name.de);
    }
  }

  console.log(
    `Loaded ${germanNames.size} existing German country translations from countries.json.`,
  );

  const recordsToInsert = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    if (fields.length <= Math.max(nameIdx, alpha2Idx, alpha3Idx)) {
      continue;
    }

    const enName = fields[nameIdx];
    const iso2 = fields[alpha2Idx].toUpperCase();
    const iso3 = fields[alpha3Idx].toUpperCase();

    if (!iso2 || !iso3 || iso2.length !== 2 || iso3.length !== 3) {
      // Skip headers or invalid rows
      continue;
    }

    const deName = germanNames.get(iso2) || enName;
    const isEu = EU_COUNTRIES.has(iso2);

    recordsToInsert.push({
      iso2Code: iso2,
      iso3Code: iso3,
      name: {
        en: enName,
        de: deName,
      },
      isEu,
      archived: false,
    });
  }

  console.log(`Parsed ${recordsToInsert.length} countries. Starting database upsert...`);

  const chunkSize = 50;
  let upsertedCount = 0;

  for (let i = 0; i < recordsToInsert.length; i += chunkSize) {
    const chunk = recordsToInsert.slice(i, i + chunkSize);

    await db
      .insert(schema.country)
      .values(chunk)
      .onConflictDoUpdate({
        target: schema.country.iso2Code,
        set: {
          iso3Code: sql`excluded.iso3_code`,
          name: sql`excluded.name`,
          isEu: sql`excluded.is_eu`,
          archived: sql`excluded.archived`,
        },
      });

    upsertedCount += chunk.length;
    console.log(`Upserted ${upsertedCount}/${recordsToInsert.length} countries...`);
  }

  console.log("Countries CSV import completed successfully!");
}

if (
  process.argv[1] &&
  (process.argv[1].endsWith("import-countries-csv.ts") ||
    process.argv[1].endsWith("import-countries-csv"))
) {
  importCountriesCsv().catch((error: unknown) => {
    const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
    console.error("Import failed:", message);
    process.exit(1);
  });
}
