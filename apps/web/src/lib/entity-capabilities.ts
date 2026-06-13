// Generic entity CRUD for apps/web, replacing the introspective
// `/api/data/<entity>` route on a *dynamic* entityName. Op resolution is shared
// with packages/ui via @repo/db/capabilities/entity-ops; here we dispatch
// through the capability server fn ($executeCapability), the sanctioned apps/web
// transport. Use the typed `capability(key)` factory directly for fixed,
// non-generic ops; this helper is for the dynamic-entity call sites.
import {
  resolveEntityDelete,
  resolveEntityGet,
  resolveEntityList,
  resolveEntitySave,
  type EntityListOptions,
} from "@repo/db/capabilities/entity-ops";
import type { CapabilityResult } from "@repo/db/capabilities";

import { $executeCapability, CapabilityClientError } from "#/server-fns/capabilities";

export { UnsupportedEntityOperationError } from "@repo/db/capabilities/entity-ops";

async function exec<T>(key: string, input: Record<string, unknown>): Promise<T> {
  const result = (await $executeCapability({ data: { key, input } })) as CapabilityResult<T>;
  if (!result.ok) throw new CapabilityClientError(result.error);
  return result.data;
}

export async function entityList<T = Record<string, unknown>>(
  entityName: string,
  filters: Record<string, string> = {},
  opts?: EntityListOptions,
): Promise<T[]> {
  const { key, input } = resolveEntityList(entityName, filters, opts);
  const { items } = await exec<{ items: T[] }>(key, input);
  return items;
}

// Paginated variant returning the row count alongside the page.
export async function entityListPage<T = Record<string, unknown>>(
  entityName: string,
  filters: Record<string, string> = {},
  opts?: EntityListOptions,
): Promise<{ items: T[]; total: number }> {
  const { key, input } = resolveEntityList(entityName, filters, { ...opts, withTotal: true });
  const data = await exec<{ items: T[]; total?: number }>(key, input);
  return { items: data.items, total: data.total ?? data.items.length };
}

export async function entityGet<T = Record<string, unknown>>(
  entityName: string,
  id: string,
): Promise<T> {
  const { key, input } = resolveEntityGet(entityName, id);
  return exec<T>(key, input);
}

export async function entitySave<T = Record<string, unknown>>(
  entityName: string,
  id: string | null,
  values: Record<string, unknown>,
): Promise<T> {
  const { key, input } = resolveEntitySave(entityName, id, values);
  return exec<T>(key, input);
}

export async function entityDelete(entityName: string, id: string): Promise<void> {
  const { key, input } = resolveEntityDelete(entityName, id);
  await exec(key, input);
}
