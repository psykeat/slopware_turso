import { z } from "zod";

import { DataService } from "../../services/data";
import { defineCapability } from "../core/define";
import { defineListCapability } from "../core/list";
import { CapabilityError } from "../core/types";

const articleBomRecordSchema = z.looseObject({
  bomId: z.uuid(),
  tenantId: z.uuid(),
  headerArticleId: z.uuid(),
  componentArticleId: z.uuid(),
  quantity: z.union([z.string(), z.number()]),
  scrapPercentage: z.union([z.string(), z.number()]),
  sortOrder: z.number().int(),
  archived: z.boolean(),
  createdAt: z.date(),
});

const articleBomCreateSchema = z.object({
  headerArticleId: z.uuid(),
  componentArticleId: z.uuid(),
  quantity: z.union([z.string(), z.number()]),
  scrapPercentage: z.union([z.string(), z.number()]).optional(),
  sortOrder: z.number().int().optional(),
});

const articleBomPatchSchema = z.object({
  headerArticleId: z.uuid().optional(),
  componentArticleId: z.uuid().optional(),
  quantity: z.union([z.string(), z.number()]).optional(),
  scrapPercentage: z.union([z.string(), z.number()]).optional(),
  sortOrder: z.number().int().optional(),
  archived: z.boolean().optional(),
});

export const articleBomList = defineListCapability({
  module: "masterdata",
  entityName: "articleBom",
  summary: { en: "List article BOM rows", de: "Stücklistenpositionen auflisten" },
  recordSchema: articleBomRecordSchema,
  extraFilters: { headerArticleId: z.uuid().optional(), componentArticleId: z.uuid().optional() },
  defaultOrderBy: "sortOrder:asc",
});

export const articleBomGet = defineCapability({
  module: "masterdata",
  entityName: "articleBom",
  operation: "get",
  kind: "read",
  summary: { en: "Get a BOM row by id", de: "Stücklistenposition per ID lesen" },
  input: z.object({ bomId: z.uuid() }),
  output: articleBomRecordSchema,
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const row = await new DataService().get("articleBom", input.bomId);
    if (!row) throw new CapabilityError("not_found", "BOM row not found");
    return row;
  },
});

export const articleBomCreate = defineCapability({
  module: "masterdata",
  entityName: "articleBom",
  operation: "create",
  kind: "create",
  summary: { en: "Create a BOM row", de: "Stücklistenposition anlegen" },
  input: articleBomCreateSchema,
  output: articleBomRecordSchema,
  writesTables: ["articleBom"],
  sideEffects: [],
  idempotent: false,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const [created] = await new DataService().create("articleBom", input);
    return created;
  },
});

export const articleBomUpdate = defineCapability({
  module: "masterdata",
  entityName: "articleBom",
  operation: "update",
  kind: "update",
  summary: { en: "Update a BOM row", de: "Stücklistenposition ändern" },
  input: z.object({
    bomId: z.uuid(),
    patch: articleBomPatchSchema.refine((patch) => Object.keys(patch).length > 0, {
      message: "patch must not be empty",
    }),
  }),
  output: articleBomRecordSchema,
  writesTables: ["articleBom"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const [updated] = await new DataService().patch("articleBom", input.bomId, input.patch);
    if (!updated) throw new CapabilityError("not_found", "BOM row not found");
    return updated;
  },
});

export const articleBomArchive = defineCapability({
  module: "masterdata",
  entityName: "articleBom",
  operation: "archive",
  kind: "archive",
  summary: { en: "Archive a BOM row", de: "Stücklistenposition archivieren" },
  description: {
    en: "Soft delete: the BOM row is archived, never hard-deleted.",
    de: "Soft Delete: die Stücklistenposition wird archiviert, nie hart gelöscht.",
  },
  input: z.object({ bomId: z.uuid() }),
  output: z.object({ bomId: z.uuid(), archived: z.literal(true) }),
  writesTables: ["articleBom"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "confirm", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const [updated] = await new DataService().patch("articleBom", input.bomId, {
      archived: true,
    });
    if (!updated) throw new CapabilityError("not_found", "BOM row not found");
    return { bomId: input.bomId, archived: true as const };
  },
});

export const articleBomCapabilities = [
  articleBomList,
  articleBomGet,
  articleBomCreate,
  articleBomUpdate,
  articleBomArchive,
];
