import { postgresPersistence } from "./persistence/postgres";
import { tursoPersistence } from "./persistence/turso";
import type { PersistenceRuntime } from "./persistence/types";

const provider = (process.env.PERSISTENCE_PROVIDER || "postgres") as "postgres" | "turso";

export const activePersistence: PersistenceRuntime<any> =
  provider === "turso" ? tursoPersistence : postgresPersistence;

type AnyQuery = PromiseLike<any[]> & {
  from(...args: any[]): AnyQuery;
  where(...args: any[]): AnyQuery;
  leftJoin(...args: any[]): AnyQuery;
  innerJoin(...args: any[]): AnyQuery;
  orderBy(...args: any[]): AnyQuery;
  groupBy(...args: any[]): AnyQuery;
  having(...args: any[]): AnyQuery;
  limit(...args: any[]): AnyQuery;
  offset(...args: any[]): AnyQuery;
  values(...args: any[]): AnyQuery;
  set(...args: any[]): AnyQuery;
  returning(...args: any[]): AnyQuery;
  onConflictDoNothing(...args: any[]): AnyQuery;
  onConflictDoUpdate(...args: any[]): AnyQuery;
  execute(...args: any[]): Promise<any>;
  all(...args: any[]): Promise<any[]>;
  get(...args: any[]): Promise<any>;
  [key: string]: any;
};

type DbFacade = {
  select(...args: any[]): AnyQuery;
  selectDistinct(...args: any[]): AnyQuery;
  insert(...args: any[]): AnyQuery;
  update(...args: any[]): AnyQuery;
  delete(...args: any[]): AnyQuery;
  transaction<T>(callback: (tx: DbFacade) => Promise<T>, config?: any): Promise<T>;
  [key: string]: any;
};

/**
 * Run `fn` with every `db` query routed to `tx` (used by the capability
 * runtime). `tx` is a drizzle transaction whose query surface matches `db`;
 * it is accepted as `unknown` to avoid coupling callers to the verbose
 * PgTransaction generics.
 */
export function runWithDbTx<T>(tx: unknown, fn: () => Promise<T>): Promise<T> {
  return activePersistence.runWithDbTx(tx, fn);
}

/** The transaction bound to the current async context, if any. */
export function currentDbTx() {
  return activePersistence.currentDbTx();
}

export const db = activePersistence.db as DbFacade;

/** Open a transaction on the base connection, bypassing any active tenant scope. */
export const dbTransaction = activePersistence.transaction as DbFacade["transaction"];

export const runInTenantScope = activePersistence.runInTenantScope;

export async function closeDb() {
  await activePersistence.close();
}

export { eq, sql, and, or } from "drizzle-orm";
