import type { EntityCapabilityOp } from "./manifest-build";
import { entityCapabilityManifest } from "./manifest.generated";

// Transport-agnostic resolution of a generic entity CRUD intent to a concrete
// { capabilityKey, input }. Both the packages/ui HTTP helper and the apps/web
// server-fn helper share this so the heterogeneity (which ops exist, plus their
// per-op input shapes captured in the manifest as idParam / filtersWrapped)
// lives in exactly one place. Imports only the generated string manifest, so it
// is client-bundle safe.

export class UnsupportedEntityOperationError extends Error {
  constructor(entityName: string, operation: string) {
    super(`Entity "${entityName}" has no usable "${operation}" capability`);
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
  orderBy?: string;
  filterRules?: Array<{ col: string; op: string; val: string }>;
  /** Request the matching row count; the list cap then returns `{ items, total }`. */
  withTotal?: boolean;
}

function ops(entityName: string): Record<string, EntityCapabilityOp> {
  return entityCapabilityManifest[entityName]?.ops ?? {};
}

function requireOp(entityName: string, operation: string): EntityCapabilityOp {
  const op = ops(entityName)[operation];
  if (!op) throw new UnsupportedEntityOperationError(entityName, operation);
  return op;
}

// FK-filtered list. Factory list caps wrap filters under `{ filters }`; bespoke
// caps take flat FK fields (their declared names must match the filter keys).
// Defaults to the capability max page size so inline sub-grids show every
// related row, matching the unbounded `/api/data` reads they replace.
export function resolveEntityList(
  entityName: string,
  filters: Record<string, string> = {},
  opts: EntityListOptions = {},
): ResolvedEntityCall {
  const op = requireOp(entityName, "list");
  const controls = {
    ...(opts.search ? { search: opts.search } : {}),
    ...(opts.orderBy ? { orderBy: opts.orderBy } : {}),
    ...(opts.filterRules ? { filterRules: opts.filterRules } : {}),
    limit: opts.limit ?? 200,
    ...(opts.offset ? { offset: opts.offset } : {}),
    ...(opts.withTotal ? { withTotal: true } : {}),
  };
  return {
    key: op.key,
    input: op.filtersWrapped ? { filters, ...controls } : { ...filters, ...controls },
  };
}

export function resolveEntityGet(entityName: string, id: string): ResolvedEntityCall {
  const op = requireOp(entityName, "get");
  return { key: op.key, input: { [op.idParam ?? "id"]: id } };
}

// Create when `id` is null, otherwise update. Prefer the id-addressed
// create/update ops; fall back to a natural-key `upsert` for entities that only
// expose that (article/address/...), where `values` must carry the natural key.
export function resolveEntitySave(
  entityName: string,
  id: string | null,
  values: Record<string, unknown>,
): ResolvedEntityCall {
  const entityOps = ops(entityName);
  if (id === null) {
    const create = entityOps.create ?? entityOps.upsert;
    if (!create) throw new UnsupportedEntityOperationError(entityName, "create");
    return { key: create.key, input: values };
  }
  const update = entityOps.update;
  if (update) {
    return { key: update.key, input: { [update.idParam ?? "id"]: id, patch: values } };
  }
  if (entityOps.upsert) return { key: entityOps.upsert.key, input: values };
  throw new UnsupportedEntityOperationError(entityName, "update");
}

// Soft-archive (the capability surface never hard-deletes business data); falls
// back to a `delete` op for the rare entity that models one.
export function resolveEntityDelete(entityName: string, id: string): ResolvedEntityCall {
  const op = ops(entityName).archive ?? ops(entityName).delete;
  if (!op) throw new UnsupportedEntityOperationError(entityName, "archive");
  return { key: op.key, input: { [op.idParam ?? "id"]: id } };
}
