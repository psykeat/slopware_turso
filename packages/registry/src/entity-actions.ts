import type { EntityActionOperation } from "./action-types";
import {
  type EntityListOptions,
  type ResolvedEntityAction,
  UnsupportedEntityOperationError,
} from "./action-types";
import { entityActionManifest } from "./actions";

function ops(entityName: string): Record<string, EntityActionOperation> {
  return entityActionManifest[entityName]?.ops ?? {};
}

function requireOp(entityName: string, operation: string): EntityActionOperation {
  const op = ops(entityName)[operation];
  if (!op) throw new UnsupportedEntityOperationError(entityName, operation);
  return op;
}

export function listEntityActionEntries() {
  return entityActionManifest;
}

export function listEntityActions(entityName: string): Record<string, EntityActionOperation> {
  return ops(entityName);
}

export function resolveEntityListAction(
  entityName: string,
  filters: Record<string, string> = {},
  opts: EntityListOptions = {},
): ResolvedEntityAction {
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

export function resolveEntityGetAction(entityName: string, id: string): ResolvedEntityAction {
  const op = requireOp(entityName, "get");
  return { key: op.key, input: { [op.idParam ?? "id"]: id } };
}

export function resolveEntitySaveAction(
  entityName: string,
  id: string | null,
  values: Record<string, unknown>,
): ResolvedEntityAction {
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

export function resolveEntityDeleteAction(entityName: string, id: string): ResolvedEntityAction {
  const op = ops(entityName).archive ?? ops(entityName).delete;
  if (!op) throw new UnsupportedEntityOperationError(entityName, "archive");
  return { key: op.key, input: { [op.idParam ?? "id"]: id } };
}
