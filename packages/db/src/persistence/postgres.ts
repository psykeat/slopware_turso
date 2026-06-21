import { AsyncLocalStorage } from "node:async_hooks";

import "@tanstack/react-start/server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { relations as authRelations } from "../schema/auth.schema";
import { relations } from "../schema/relations";
import type { PersistenceRuntime } from "./types";

const client = postgres(process.env.DATABASE_URL as string);

// The real drizzle instance. Everything talks to the `db` Proxy below; this is
// only used directly where we deliberately need a connection outside any
// tenant-scoped transaction (e.g. opening the transaction itself).
const baseDb = drizzle({
  client,
  // authRelations must come first, since it's using defineRelations as the main relation
  // https://orm.drizzle.team/docs/relations-v2#relations-parts
  relations: { ...authRelations, ...relations },
});

type PostgresDb = typeof baseDb;

// When a transaction is active (see runWithDbTx), every query issued through
// the exported `db` is transparently routed to that transaction. When no store
// is active the Proxy is a no-op and behaves exactly like baseDb.
const txStore = new AsyncLocalStorage<PostgresDb>();

function runWithDbTx<T>(tx: unknown, fn: () => Promise<T>): Promise<T> {
  return txStore.run(tx as PostgresDb, fn);
}

function currentDbTx(): PostgresDb | undefined {
  return txStore.getStore();
}

const db = new Proxy(baseDb, {
  get(target, prop, receiver) {
    const active = (txStore.getStore() ?? target) as PostgresDb;
    const value = Reflect.get(active, prop, receiver === db ? active : receiver);
    return typeof value === "function" ? value.bind(active) : value;
  },
}) as PostgresDb;

const transaction: PostgresDb["transaction"] = baseDb.transaction.bind(baseDb);

async function runInTenantScope<T>(_ctx: { tenantId: string }, fn: () => Promise<T>): Promise<T> {
  return transaction(async (tx) => {
    return runWithDbTx(tx, fn);
  });
}

async function close() {
  await client.end({ timeout: 5 });
}

export const postgresPersistence: PersistenceRuntime<PostgresDb> = {
  provider: "postgres",
  db,
  transaction,
  runWithDbTx,
  currentDbTx,
  runInTenantScope,
  close,
};

export type { PostgresDb };
