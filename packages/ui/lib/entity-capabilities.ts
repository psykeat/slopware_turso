// Generic entity CRUD over the capability HTTP surface, for shared UI that used
// to hit the introspective `/api/data/<entity>` route on a *dynamic* entityName.
// Op resolution (which capability key + input for list/get/save/delete) is shared
// with apps/web via @repo/db/capabilities/entity-ops; here we just supply the
// HTTP transport. Tenant context is resolved server-side; never send tenantId.
import {
  resolveEntityDelete,
  resolveEntityGet,
  resolveEntityList,
  resolveEntitySave,
  type EntityListOptions,
} from "@repo/db/capabilities/entity-ops";

import { executeCapability } from "./capability-client";

export { UnsupportedEntityOperationError } from "@repo/db/capabilities/entity-ops";

export async function entityList<T = Record<string, unknown>>(
  entityName: string,
  filters: Record<string, string> = {},
  opts?: EntityListOptions,
): Promise<T[]> {
  const { key, input } = resolveEntityList(entityName, filters, opts);
  const { data } = await executeCapability<{ items: T[] }>(key, input);
  return data.items;
}

// Paginated variant returning the row count alongside the page; pass
// `withTotal` (forced on here) when the grid renders page counts.
export async function entityListPage<T = Record<string, unknown>>(
  entityName: string,
  filters: Record<string, string> = {},
  opts?: EntityListOptions,
): Promise<{ items: T[]; total: number }> {
  const { key, input } = resolveEntityList(entityName, filters, { ...opts, withTotal: true });
  const { data } = await executeCapability<{ items: T[]; total?: number }>(key, input);
  return { items: data.items, total: data.total ?? data.items.length };
}

export async function entityGet<T = Record<string, unknown>>(
  entityName: string,
  id: string,
): Promise<T> {
  const { key, input } = resolveEntityGet(entityName, id);
  const { data } = await executeCapability<T>(key, input);
  return data;
}

export async function entitySave<T = Record<string, unknown>>(
  entityName: string,
  id: string | null,
  values: Record<string, unknown>,
): Promise<T> {
  const { key, input } = resolveEntitySave(entityName, id, values);
  const { data } = await executeCapability<T>(key, input);
  return data;
}

export async function entityDelete(entityName: string, id: string): Promise<void> {
  const { key, input } = resolveEntityDelete(entityName, id);
  await executeCapability(key, input);
}
