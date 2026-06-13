import { AsyncLocalStorage } from "node:async_hooks";

import "@tanstack/react-start/server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { relations as authRelations } from "./schema/auth.schema";
import { relations } from "./schema/relations";

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

type DbLike = typeof baseDb;

// When a tenant-scoped transaction is active (see runWithDbTx), every query
// issued through the exported `db` is transparently routed to that transaction.
// This is what lets capability handlers keep importing the global `db` while
// their queries run on a connection that has the transaction-local tenant GUC
// set — the precondition for PostgreSQL RLS under connection pooling. When no
// store is active the Proxy is a no-op and behaves exactly like baseDb.
const txStore = new AsyncLocalStorage<DbLike>();

/**
 * Run `fn` with every `db` query routed to `tx` (used by the capability
 * runtime). `tx` is a drizzle transaction whose query surface matches `db`;
 * it is accepted as `unknown` to avoid coupling callers to the verbose
 * PgTransaction generics.
 */
export function runWithDbTx<T>(tx: unknown, fn: () => Promise<T>): Promise<T> {
  return txStore.run(tx as DbLike, fn);
}

/** The transaction bound to the current async context, if any. */
export function currentDbTx(): DbLike | undefined {
  return txStore.getStore();
}

export const db = new Proxy(baseDb, {
  get(target, prop, receiver) {
    const active = (txStore.getStore() ?? target) as DbLike;
    const value = Reflect.get(active, prop, receiver === db ? active : receiver);
    return typeof value === "function" ? value.bind(active) : value;
  },
}) as DbLike;

/** Open a transaction on the base connection, bypassing any active tenant scope. */
export const dbTransaction: DbLike["transaction"] = baseDb.transaction.bind(baseDb);

export async function closeDb() {
  await client.end({ timeout: 5 });
}

export { eq, sql, and, or } from "drizzle-orm";
