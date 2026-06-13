import { z } from "zod";

import { DataService } from "../../services/data";
import { defineCapability } from "../core/define";
import { CapabilityError } from "../core/types";

// By-id create/update shims for the natural-key master-data entities (article,
// address, currency, ...), which otherwise expose only `upsert` + `archive`.
// The generic entity mask, langtext panel and inline grids edit these by record
// id with partial payloads — exactly as the legacy `/api/data` CRUD route did.
// These delegate verbatim to DataService (no business logic) and are hidden
// from the AI tool surface, where the natural-key `upsert` stays the single
// write path. The id param matches each entity's existing `get` cap.

const looseRowSchema = z.looseObject({});

type EditableSpec = { entityName: string; tableName: string; idParam: string };

function byIdWrites({ entityName, tableName, idParam }: EditableSpec) {
  const create = defineCapability({
    module: "masterdata",
    entityName,
    operation: "create",
    kind: "create",
    summary: { en: `Create ${entityName}`, de: `${entityName} anlegen` },
    input: z.record(z.string(), z.unknown()),
    output: looseRowSchema,
    writesTables: [tableName],
    sideEffects: [],
    idempotent: false,
    supportsDryRun: false,
    minRole: "tenant_user",
    exposure: { llm: "hidden", http: true },
    schemaVersion: 1,
    handler: async (ctx, input) => {
      const [created] = await new DataService(ctx.tenantId).create(tableName, input);
      return created;
    },
  });

  const update = defineCapability({
    module: "masterdata",
    entityName,
    operation: "update",
    kind: "update",
    summary: { en: `Update ${entityName} by id`, de: `${entityName} per ID ändern` },
    input: z.object({
      [idParam]: z.uuid(),
      patch: z
        .record(z.string(), z.unknown())
        .refine((patch) => Object.keys(patch).length > 0, { message: "patch must not be empty" }),
    }),
    output: looseRowSchema,
    writesTables: [tableName],
    sideEffects: [],
    idempotent: true,
    supportsDryRun: false,
    minRole: "tenant_user",
    exposure: { llm: "hidden", http: true },
    schemaVersion: 1,
    handler: async (ctx, input) => {
      const id = (input as Record<string, unknown>)[idParam] as string;
      const patch = (input as { patch: Record<string, unknown> }).patch;
      const [updated] = await new DataService(ctx.tenantId).patch(tableName, id, patch);
      if (!updated) throw new CapabilityError("not_found", `${entityName} not found`);
      return updated;
    },
  });

  return [create, update];
}

export const editableMasterdataCapabilities = [
  ...byIdWrites({ entityName: "article", tableName: "article", idParam: "articleId" }),
  ...byIdWrites({ entityName: "address", tableName: "address", idParam: "addressId" }),
  ...byIdWrites({ entityName: "currency", tableName: "currency", idParam: "currencyId" }),
  ...byIdWrites({ entityName: "articleGroup", tableName: "articleGroup", idParam: "articleGroupId" }),
  ...byIdWrites({ entityName: "country", tableName: "country", idParam: "countryId" }),
  ...byIdWrites({ entityName: "unit", tableName: "unit", idParam: "unitId" }),
  ...byIdWrites({ entityName: "priceList", tableName: "priceList", idParam: "priceListId" }),
];
