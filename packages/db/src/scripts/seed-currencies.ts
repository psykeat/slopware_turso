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

const CURRENCIES = [
  {
    code: "EUR",
    name: { de: "Euro", en: "Euro" },
    symbol: "€",
    decimals: 2,
    archived: false,
  },
  {
    code: "USD",
    name: { de: "US-Dollar", en: "US Dollar" },
    symbol: "$",
    decimals: 2,
    archived: false,
  },
  {
    code: "CHF",
    name: { de: "Schweizer Franken", en: "Swiss Franc" },
    symbol: "CHF",
    decimals: 2,
    archived: false,
  },
  {
    code: "GBP",
    name: { de: "Britisches Pfund", en: "British Pound" },
    symbol: "£",
    decimals: 2,
    archived: false,
  },
  {
    code: "JPY",
    name: { de: "Japanischer Yen", en: "Japanese Yen" },
    symbol: "¥",
    decimals: 0,
    archived: false,
  },
  {
    code: "CAD",
    name: { de: "Kanadischer Dollar", en: "Canadian Dollar" },
    symbol: "CA$",
    decimals: 2,
    archived: false,
  },
  {
    code: "AUD",
    name: { de: "Australischer Dollar", en: "Australian Dollar" },
    symbol: "A$",
    decimals: 2,
    archived: false,
  },
  {
    code: "CNY",
    name: { de: "Chinesischer Renminbi", en: "Chinese Renminbi" },
    symbol: "¥",
    decimals: 2,
    archived: false,
  },
  {
    code: "SEK",
    name: { de: "Schwedische Krone", en: "Swedish Krona" },
    symbol: "kr",
    decimals: 2,
    archived: false,
  },
  {
    code: "PLN",
    name: { de: "Polnischer Złoty", en: "Polish Złoty" },
    symbol: "zł",
    decimals: 2,
    archived: false,
  },
];

export async function seedCurrencies() {
  console.log(`Starting seeding of ${CURRENCIES.length} currencies...`);

  await db
    .insert(schema.currency)
    .values(CURRENCIES)
    .onConflictDoUpdate({
      target: schema.currency.code,
      set: {
        name: sql`excluded.name`,
        symbol: sql`excluded.symbol`,
        decimals: sql`excluded.decimals`,
        archived: sql`excluded.archived`,
      },
    });

  console.log("Currencies seeded successfully!");
}

if (
  process.argv[1] &&
  (process.argv[1].endsWith("seed-currencies.ts") || process.argv[1].endsWith("seed-currencies"))
) {
  seedCurrencies().catch((error: unknown) => {
    const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
    console.error("Seeding failed:", message);
    process.exit(1);
  });
}
