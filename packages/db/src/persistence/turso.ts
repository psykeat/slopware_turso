import { AsyncLocalStorage } from "node:async_hooks";

import "@tanstack/react-start/server-only";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import * as sqliteSchema from "../schema/sqlite.schema";
import type { PersistenceRuntime } from "./types";

const connections = new Map<string, any>();
const clients = new Map<string, any>();

const txStore = new AsyncLocalStorage<any>();

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
  const dbUrl = process.env.TURSO_DATABASE_URL || `file:local-${ctx.tenantId}.db`;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  let dbInstance = connections.get(ctx.tenantId);
  if (!dbInstance) {
    const client = createClient({
      url: dbUrl,
      authToken,
    });
    // Configure busy_timeout to at least 5000ms
    await client.execute("PRAGMA busy_timeout = 5000;");

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

    dbInstance = drizzle({ client, schema: sqliteSchema });
    connections.set(ctx.tenantId, dbInstance);
    clients.set(ctx.tenantId, client);
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
