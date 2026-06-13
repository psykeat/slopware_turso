import { entityCapabilityManifest } from "./manifest.generated";

// Transport-agnostic resolution of a generic entity CRUD intent to a concrete
// { capabilityKey, input }. Both the packages/ui HTTP helper and the apps/web
// server-fn helper share this so the heterogeneity (upsert+archive vs
// create/update/archive, per-entity module prefix) lives in exactly one place.
// Imports only the generated string manifest, so it is client-bundle safe.

export class UnsupportedEntityOperationError extends Error {
  constructor(entityName: string, operation: string) {
    super(`Entity "${entityName}" has no "${operation}" capability`);
    this.name = "UnsupportedEntityOperationError";
  }
}

export interface ResolvedEntityCall {
  key: string;
  input: Record<string, unknown>;
}

export interface EntityListOptions {
  search?: string;
  limit?: number;
  offset?: number;
}

function ops(entityName: string): Record<string, string> {
  return entityCapabilityManifest[entityName]?.ops ?? {};
}

function requireOp(entityName: string, operation: string): string {
  const key = ops(entityName)[operation];
  if (!key) throw new UnsupportedEntityOperationError(entityName, operation);
  return key;
}

// FK-filtered list. Defaults to the capability max page size so inline sub-grids
// show every related row, matching the unbounded `/api/data` reads they replace.
export function resolveEntityList(
  entityName: string,
  filters: Record<string, string> = {},
  opts: EntityListOptions = {},
): ResolvedEntityCall {
  return {
    key: requireOp(entityName, "list"),
    input: {
      filters,
      ...(opts.search ? { search: opts.search } : {}),
      limit: opts.limit ?? 200,
      ...(opts.offset ? { offset: opts.offset } : {}),
    },
  };
}

export function resolveEntityGet(entityName: string, id: string): ResolvedEntityCall {
  return { key: requireOp(entityName, "get"), input: { id } };
}

// Create when `id` is null, otherwise update. Natural-key upsert entities
// (article/address/currency/...) expose only `upsert`, so prefer it; for those
// `values` must carry the natural key. Generic CRUD entities take a raw record
// on create and `{ id, patch }` on update.
export function resolveEntitySave(
  entityName: string,
  id: string | null,
  values: Record<string, unknown>,
): ResolvedEntityCall {
  const upsertKey = ops(entityName).upsert;
  if (upsertKey) return { key: upsertKey, input: values };
  if (id === null) return { key: requireOp(entityName, "create"), input: values };
  return { key: requireOp(entityName, "update"), input: { id, patch: values } };
}

// Soft-archive (the capability surface never hard-deletes business data); falls
// back to a `delete` op for the rare entity that models one.
export function resolveEntityDelete(entityName: string, id: string): ResolvedEntityCall {
  const key = ops(entityName).archive ?? ops(entityName).delete;
  if (!key) throw new UnsupportedEntityOperationError(entityName, "archive");
  return { key, input: { id } };
}
