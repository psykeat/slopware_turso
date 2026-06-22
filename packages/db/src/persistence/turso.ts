import { AsyncLocalStorage } from "node:async_hooks";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import "@tanstack/react-start/server-only";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

import * as sqliteSchema from "../schema/sqlite.schema";
import type { PersistenceRuntime } from "./types";

const connections = new Map<string, any>();
const clients = new Map<string, any>();
const initPromises = new Map<string, Promise<any>>();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "../../../..");

const txStore = new AsyncLocalStorage<any>();

function localTenantDbUrl(tenantId: string): string {
  const dbPath = join(repoRoot, ".local-data", "tenants", `${tenantId}.db`);
  mkdirSync(dirname(dbPath), { recursive: true });
  return `file:${dbPath}`;
}

function runWithDbTx<T>(tx: unknown, fn: () => Promise<T>): Promise<T> {
  return txStore.run(tx, fn);
}

function currentDbTx(): any {
  return txStore.getStore();
}

const db = new Proxy({} as any, {
  get(target, prop, receiver) {
    const active = txStore.getStore();
    if (!active) {
      throw new Error(
        "No active tenant scope. Queries on tenant database tables must run within runInTenantScope.",
      );
    }
    const value = Reflect.get(active, prop, receiver === db ? active : receiver);
    return typeof value === "function" ? value.bind(active) : value;
  },
}) as any;

const transaction = async (callback: any, config?: any) => {
  const active = txStore.getStore();
  if (!active) {
    throw new Error("No active tenant scope. Transactions must run within runInTenantScope.");
  }
  return active.transaction(callback, config);
};

async function runInTenantScope<T>(ctx: { tenantId: string }, fn: () => Promise<T>): Promise<T> {
  const dbUrl = process.env.TURSO_DATABASE_URL || localTenantDbUrl(ctx.tenantId);
  const authToken = process.env.TURSO_AUTH_TOKEN;

  let dbInstance = connections.get(ctx.tenantId);
  if (!dbInstance) {
    let initPromise = initPromises.get(ctx.tenantId);
    if (!initPromise) {
      initPromise = (async () => {
        const client = createClient({
          url: dbUrl,
          authToken,
        });
        // Configure busy_timeout to at least 5000ms
        await client.execute("PRAGMA busy_timeout = 5000;");

        const instance = drizzle({ client, schema: sqliteSchema });

        // Auto-migrate tenant DB if config/env allows
        const autoMigrateTenantDb =
          process.env.TURSO_TENANT_AUTO_MIGRATE === "1" ||
          (process.env.TURSO_TENANT_AUTO_MIGRATE !== "0" && dbUrl.startsWith("file:"));

        if (autoMigrateTenantDb) {
          const tenantMigrationsFolder = join(repoRoot, "packages/db/migrations-sqlite");
          await migrate(instance, {
            migrationsFolder: tenantMigrationsFolder,
          });
        }

        try {
          await client.execute(
            "CREATE TRIGGER IF NOT EXISTS lock_posting_entry_update BEFORE UPDATE ON posting_entry BEGIN SELECT RAISE(ABORT, 'Ledger entries are immutable'); END;",
          );
          await client.execute(
            "CREATE TRIGGER IF NOT EXISTS lock_posting_entry_delete BEFORE DELETE ON posting_entry BEGIN SELECT RAISE(ABORT, 'Ledger entries are immutable'); END;",
          );
        } catch (e) {
          console.error("TRIGGER CREATION ERROR:", e);
        }

        connections.set(ctx.tenantId, instance);
        clients.set(ctx.tenantId, client);
        return instance;
      })().catch((err) => {
        initPromises.delete(ctx.tenantId);
        throw err;
      });
      initPromises.set(ctx.tenantId, initPromise);
    }
    dbInstance = await initPromise;
  }

  return txStore.run(dbInstance, fn);
}

async function close() {
  for (const client of clients.values()) {
    try {
      client.close();
    } catch {
      // Ignored during shutdown
    }
  }
  connections.clear();
  clients.clear();
  initPromises.clear();
}

export const tursoPersistence: PersistenceRuntime<any> = {
  provider: "turso",
  db,
  transaction: transaction as any,
  runWithDbTx,
  currentDbTx,
  runInTenantScope,
  close,
};
