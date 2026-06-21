import { loadEnvFile } from "node:process";

import type { Config } from "drizzle-kit";

// Load .env from /apps/web
loadEnvFile("../../apps/web/.env");

export default {
  out: "./migrations-sqlite",
  schema: "./src/schema/sqlite.schema.ts",
  breakpoints: true,
  verbose: true,
  strict: true,

  dialect: "sqlite",
  dbCredentials: {
    url: "local.db",
  },
} satisfies Config;
