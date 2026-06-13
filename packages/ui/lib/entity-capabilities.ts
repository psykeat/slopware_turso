// Generic entity CRUD over the capability HTTP surface, for shared UI that used
// to hit the introspective `/api/data/<entity>` route on a *dynamic* entityName.
// Capability ops are heterogeneous (upsert+archive vs create/update/archive, and
// the module prefix varies per entity), so we resolve entity→op→key through the
// generated string manifest and dispatch via executeCapability. Tenant context
// is resolved server-side; never send tenantId.
//
// The manifest import is strings-only (no handlers, no Drizzle) so it is safe in
// the client bundle.
import { entityCapabilityManifest } from "@repo/db/capabilities/manifest";

import { executeCapability } from "./capability-client";

export class UnsupportedEntityOperationError extends Error {
  constructor(entityName: string, operation: string) {
    super(`Entity "${entityName}" has no "${operation}" capability`);
    this.name = "UnsupportedEntityOperationError";
  }
}

function ops(entityName: string): Record<string, string> {
  return entityCapabilityManifest[entityName]?.ops ?? {};
}

function requireOp(entityName: string, operation: string): string {
  const key = ops(entityName)[operation];
  if (!key) throw new UnsupportedEntityOperationError(entityName, operation);
  return key;
}

// FK-filtered list, mirroring `GET /api/data/<entity>?col=val`. Returns the row
// array (the list capability wraps it as `{ items }`). Defaults to the
// capability max page size so inline sub-grids show every related row.
export async function entityList<T = Record<string, unknown>>(
  entityName: string,
  filters: Record<string, string> = {},
  opts?: { search?: string; limit?: number; offset?: number },
): Promise<T[]> {
  const key = requireOp(entityName, "list");
  const { data } = await executeCapability<{ items: T[] }>(key, {
    filters,
    ...(opts?.search ? { search: opts.search } : {}),
    limit: opts?.limit ?? 200,
    ...(opts?.offset ? { offset: opts.offset } : {}),
  });
  return data.items;
}

export async function entityGet<T = Record<string, unknown>>(
  entityName: string,
  id: string,
): Promise<T> {
  const key = requireOp(entityName, "get");
  const { data } = await executeCapability<T>(key, { id });
  return data;
}

// Create when `id` is null, otherwise update. Entities with a natural-key
// `upsert` (article/address/currency/...) expose only that, so prefer it; for
// those, `values` must carry the natural key. Generic CRUD entities take a raw
// record on create and `{ id, patch }` on update.
export async function entitySave<T = Record<string, unknown>>(
  entityName: string,
  id: string | null,
  values: Record<string, unknown>,
): Promise<T> {
  const upsertKey = ops(entityName).upsert;
  if (upsertKey) {
    const { data } = await executeCapability<T>(upsertKey, values);
    return data;
  }
  if (id === null) {
    const { data } = await executeCapability<T>(requireOp(entityName, "create"), values);
    return data;
  }
  const { data } = await executeCapability<T>(requireOp(entityName, "update"), {
    id,
    patch: values,
  });
  return data;
}

// Soft-archive (the capability surface never hard-deletes business data); falls
// back to a `delete` op for the rare entity that models one.
export async function entityDelete(entityName: string, id: string): Promise<void> {
  const key = ops(entityName).archive ?? ops(entityName).delete;
  if (!key) throw new UnsupportedEntityOperationError(entityName, "archive");
  await executeCapability(key, { id });
}
