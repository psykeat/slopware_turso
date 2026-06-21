import type { ExecutionContext } from "../capabilities/core/types";

export type PersistenceProvider = "postgres" | "turso";

export interface TenantScopedRunner {
  <T>(ctx: Pick<ExecutionContext, "tenantId">, fn: () => Promise<T>): Promise<T>;
}

export interface PersistenceRuntime<Db> {
  provider: PersistenceProvider;
  db: Db;
  transaction: Db extends { transaction: infer Tx } ? Tx : never;
  runWithDbTx<T>(tx: unknown, fn: () => Promise<T>): Promise<T>;
  currentDbTx(): Db | undefined;
  runInTenantScope: TenantScopedRunner;
  close(): Promise<void>;
}
