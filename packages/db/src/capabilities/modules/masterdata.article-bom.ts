import { z } from "zod";

import { DataService } from "../../services/data";
import { defineCapability } from "../core/define";
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

export const articleBomList = defineCapability({
  module: "masterdata",
  entityName: "articleBom",
  operation: "list",
  kind: "read",
  summary: { en: "List article BOM rows", de: "Stücklistenpositionen auflisten" },
  input: z.object({
    headerArticleId: z.uuid().optional(),
    componentArticleId: z.uuid().optional(),
    search: z.string().trim().min(1).optional(),
    limit: z.number().int().min(1).max(200).default(50),
    offset: z.number().int().min(0).default(0),
  }),
  output: z.object({ items: z.array(articleBomRecordSchema) }),
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const filters: Record<string, string> = {};
    if (input.headerArticleId) filters.headerArticleId = input.headerArticleId;
    if (input.componentArticleId) filters.componentArticleId = input.componentArticleId;
    const rows = await new DataService(ctx.tenantId).list("articleBom", filters, {
      search: input.search,
      limit: input.limit,
      offset: input.offset,
      orderBy: "sortOrder:asc",
    });
    return { items: rows as z.output<typeof articleBomRecordSchema>[] };
  },
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
    const row = await new DataService(ctx.tenantId).get("articleBom", input.bomId);
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
    const [created] = await new DataService(ctx.tenantId).create("articleBom", input);
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
    const [updated] = await new DataService(ctx.tenantId).patch("articleBom", input.bomId, input.patch);
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
    const [updated] = await new DataService(ctx.tenantId).patch("articleBom", input.bomId, {
      archived: true,
    });
    if (!updated) throw new CapabilityError("not_found", "BOM row not found");
    return { bomId: input.bomId, archived: true as const };
  },
});

export const articleBomCapabilities = [articleBomList, articleBomGet, articleBomCreate, articleBomUpdate, articleBomArchive];
