import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

import * as schema from "../schema/config.schema";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "../../../..");
const defaultConfigDbPath = join(repoRoot, ".local-data", "config.db");
const migrationsFolder = join(repoRoot, "packages/db/config-migrations");

const dbUrl = process.env.TURSO_CONFIG_DATABASE_URL ?? `file:${defaultConfigDbPath}`;
const authToken = process.env.TURSO_CONFIG_AUTH_TOKEN ?? process.env.TURSO_AUTH_TOKEN;

if (dbUrl.startsWith("file:")) {
  mkdirSync(dirname(dbUrl.slice("file:".length)), { recursive: true });
}

const client = createClient({ url: dbUrl, authToken });
const db = drizzle({ client, schema, relations: schema.relations });

await client.execute("PRAGMA busy_timeout = 5000");
await client.execute("PRAGMA foreign_keys = ON");
await migrate(db, {
  migrationsFolder,
  migrationsTable: "__config_migrations",
});

client.close();
console.log(`Config database migrated: ${dbUrl}`);
