import { z } from "zod";

import { DataService } from "../../services/data";
import { defineCapability } from "../core/define";
import { defineListCapability } from "../core/list";
import { CapabilityError } from "../core/types";

const articleOptionRecordSchema = z.looseObject({
  optionId: z.uuid(),
  tenantId: z.uuid(),
  articleId: z.uuid(),
  name: z.string(),
  sortOrder: z.number().int(),
});

const articleOptionWritableFields = z.object({
  articleId: z.uuid().optional(),
  name: z.string().trim().min(1).optional(),
  sortOrder: z.number().int().optional(),
});

export const articleOptionList = defineListCapability({
  module: "masterdata",
  entityName: "articleOption",
  summary: { en: "List article options", de: "Artikeloptionen auflisten" },
  recordSchema: articleOptionRecordSchema,
  extraFilters: { articleId: z.uuid().optional() },
  defaultOrderBy: "sortOrder:asc",
});

export const articleOptionGet = defineCapability({
  module: "masterdata",
  entityName: "articleOption",
  operation: "get",
  kind: "read",
  summary: { en: "Get an article option by id", de: "Artikeloption per ID lesen" },
  input: z.object({ optionId: z.uuid() }),
  output: articleOptionRecordSchema,
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const row = await new DataService(ctx.tenantId).get("articleOption", input.optionId);
    if (!row) throw new CapabilityError("not_found", "Article option not found");
    return row;
  },
});

export const articleOptionCreate = defineCapability({
  module: "masterdata",
  entityName: "articleOption",
  operation: "create",
  kind: "create",
  summary: { en: "Create an article option", de: "Artikeloption anlegen" },
  input: z.object({
    articleId: z.uuid(),
    name: z.string().trim().min(1),
    sortOrder: z.number().int().optional(),
  }),
  output: articleOptionRecordSchema,
  writesTables: ["articleOption"],
  sideEffects: [],
  idempotent: false,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const [created] = await new DataService(ctx.tenantId).create("articleOption", input);
    return created;
  },
});

export const articleOptionUpdate = defineCapability({
  module: "masterdata",
  entityName: "articleOption",
  operation: "update",
  kind: "update",
  summary: { en: "Update an article option", de: "Artikeloption ändern" },
  input: z.object({
    optionId: z.uuid(),
    patch: articleOptionWritableFields
      .refine((patch) => Object.keys(patch).length > 0, { message: "patch must not be empty" }),
  }),
  output: articleOptionRecordSchema,
  writesTables: ["articleOption"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const [updated] = await new DataService(ctx.tenantId).patch("articleOption", input.optionId, input.patch);
    if (!updated) throw new CapabilityError("not_found", "Article option not found");
    return updated;
  },
});

export const articleOptionArchive = defineCapability({
  module: "masterdata",
  entityName: "articleOption",
  operation: "archive",
  kind: "archive",
  summary: { en: "Archive an article option", de: "Artikeloption archivieren" },
  description: {
    en: "Soft delete: the article option is archived, never hard-deleted.",
    de: "Soft Delete: die Artikeloption wird archiviert, nie hart gelöscht.",
  },
  input: z.object({ optionId: z.uuid() }),
  output: z.object({ optionId: z.uuid(), archived: z.literal(true) }),
  writesTables: ["articleOption"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "confirm", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const [updated] = await new DataService(ctx.tenantId).patch("articleOption", input.optionId, {
      archived: true,
    });
    if (!updated) throw new CapabilityError("not_found", "Article option not found");
    return { optionId: input.optionId, archived: true as const };
  },
});

export const articleOptionCapabilities = [
  articleOptionList,
  articleOptionGet,
  articleOptionCreate,
  articleOptionUpdate,
  articleOptionArchive,
];
