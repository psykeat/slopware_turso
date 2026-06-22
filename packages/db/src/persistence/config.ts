import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import "@tanstack/react-start/server-only";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

import * as schema from "../schema/config.schema";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "../../../..");
const defaultConfigDbPath = join(repoRoot, ".local-data", "config.db");
const configMigrationsFolder = join(repoRoot, "packages/db/config-migrations");

const configDbUrl = process.env.TURSO_CONFIG_DATABASE_URL ?? `file:${defaultConfigDbPath}`;
const configAuthToken = process.env.TURSO_CONFIG_AUTH_TOKEN ?? process.env.TURSO_AUTH_TOKEN;
const autoMigrateConfigDb =
  process.env.TURSO_CONFIG_AUTO_MIGRATE === "1" ||
  (process.env.TURSO_CONFIG_AUTO_MIGRATE !== "0" && configDbUrl.startsWith("file:"));

function filePathFromLibsqlUrl(url: string): string | null {
  if (!url.startsWith("file:")) return null;
  return url.slice("file:".length);
}

const configDbFilePath = filePathFromLibsqlUrl(configDbUrl);
if (configDbFilePath) {
  mkdirSync(dirname(configDbFilePath), { recursive: true });
}

const client = createClient({
  url: configDbUrl,
  authToken: configAuthToken,
});

const baseConfigDb = drizzle({ client, schema, relations: schema.relations });

let ensurePromise: Promise<void> | null = null;

export function ensureConfigDb(): Promise<void> {
  ensurePromise ??= (async () => {
    await client.execute("PRAGMA busy_timeout = 5000");
    await client.execute("PRAGMA foreign_keys = ON");
    if (autoMigrateConfigDb) {
      await migrate(baseConfigDb, {
        migrationsFolder: configMigrationsFolder,
        migrationsTable: "__config_migrations",
      });
    }
  })().catch((error) => {
    ensurePromise = null;
    throw error;
  });

  return ensurePromise;
}

function wrapQuery<T>(query: T): T {
  if (!query || (typeof query !== "object" && typeof query !== "function")) return query;

  return new Proxy(query as Record<PropertyKey, any>, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);

      if (prop === "then" && typeof value === "function") {
        return (
          onFulfilled?: Parameters<Promise<unknown>["then"]>[0],
          onRejected?: Parameters<Promise<unknown>["then"]>[1],
        ) => ensureConfigDb().then(() => value.call(target, onFulfilled, onRejected), onRejected);
      }

      if (typeof value !== "function") {
        return value && typeof value === "object" ? wrapQuery(value) : value;
      }

      if (prop === "execute" || prop === "all" || prop === "get" || prop === "run") {
        return async (...args: unknown[]) => {
          await ensureConfigDb();
          return value.apply(target, args);
        };
      }

      return (...args: unknown[]) => wrapQuery(value.apply(target, args));
    },
  }) as T;
}

export const configDb = new Proxy(baseConfigDb as Record<PropertyKey, any>, {
  get(target, prop, receiver) {
    const value = Reflect.get(target, prop, receiver);
    if (typeof value !== "function") {
      return value && typeof value === "object" ? wrapQuery(value) : value;
    }

    if (prop === "transaction") {
      return async (...args: unknown[]) => {
        await ensureConfigDb();
        return value.apply(target, args);
      };
    }

    return (...args: unknown[]) => wrapQuery(value.apply(target, args));
  },
}) as typeof baseConfigDb;

export async function closeConfigDb() {
  client.close();
}
