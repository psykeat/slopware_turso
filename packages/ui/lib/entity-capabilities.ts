import {
  type EntityListOptions,
  resolveEntityDeleteAction,
  resolveEntityGetAction,
  resolveEntityListAction,
  resolveEntitySaveAction,
  UnsupportedEntityOperationError,
} from "@repo/registry";

import { executeCapability } from "./capability-client";

export { UnsupportedEntityOperationError };

export async function entityList<T = Record<string, unknown>>(
  entityName: string,
  filters: Record<string, string> = {},
  opts?: EntityListOptions,
): Promise<T[]> {
  const { key, input } = resolveEntityListAction(entityName, filters, opts);
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
  const { key, input } = resolveEntityListAction(entityName, filters, { ...opts, withTotal: true });
  const { data } = await executeCapability<{ items: T[]; total?: number }>(key, input);
  return { items: data.items, total: data.total ?? data.items.length };
}

export async function entityGet<T = Record<string, unknown>>(
  entityName: string,
  id: string,
): Promise<T> {
  const { key, input } = resolveEntityGetAction(entityName, id);
  const { data } = await executeCapability<T>(key, input);
  return data;
}

export async function entitySave<T = Record<string, unknown>>(
  entityName: string,
  id: string | null,
  values: Record<string, unknown>,
): Promise<T> {
  const { key, input } = resolveEntitySaveAction(entityName, id, values);
  const { data } = await executeCapability<T>(key, input);
  return data;
}

export async function entityDelete(entityName: string, id: string): Promise<void> {
  const { key, input } = resolveEntityDeleteAction(entityName, id);
  await executeCapability(key, input);
}
