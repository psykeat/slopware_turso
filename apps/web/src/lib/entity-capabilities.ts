import type { ActionResult } from "@repo/db/actions";
import {
  type EntityListOptions,
  resolveEntityDeleteAction,
  resolveEntityGetAction,
  resolveEntityListAction,
  resolveEntitySaveAction,
  UnsupportedEntityOperationError,
} from "@repo/registry";

import { $executeCapability, CapabilityClientError } from "#/server-fns/capabilities";

export { UnsupportedEntityOperationError };

async function exec<T>(key: string, input: Record<string, unknown>): Promise<T> {
  const result = (await $executeCapability({ data: { key, input } })) as ActionResult<T>;
  if (!result.ok) throw new CapabilityClientError(result.error);
  return result.data;
}

export async function entityList<T = any>(
  entityName: string,
  filters: Record<string, string> = {},
  opts?: EntityListOptions,
): Promise<T[]> {
  const { key, input } = resolveEntityListAction(entityName, filters, opts);
  const { items } = await exec<{ items: T[] }>(key, input);
  return items;
}

// Paginated variant returning the row count alongside the page.
export async function entityListPage<T = any>(
  entityName: string,
  filters: Record<string, string> = {},
  opts?: EntityListOptions,
): Promise<{ items: T[]; total: number }> {
  const { key, input } = resolveEntityListAction(entityName, filters, { ...opts, withTotal: true });
  const data = await exec<{ items: T[]; total?: number }>(key, input);
  return { items: data.items, total: data.total ?? data.items.length };
}

export async function entityGet<T = any>(entityName: string, id: string): Promise<T> {
  const { key, input } = resolveEntityGetAction(entityName, id);
  return exec<T>(key, input);
}

export async function entitySave<T = any>(
  entityName: string,
  id: string | null,
  values: Record<string, unknown>,
): Promise<T> {
  const { key, input } = resolveEntitySaveAction(entityName, id, values);
  return exec<T>(key, input);
}

export async function entityDelete(entityName: string, id: string): Promise<void> {
  const { key, input } = resolveEntityDeleteAction(entityName, id);
  await exec(key, input);
}
