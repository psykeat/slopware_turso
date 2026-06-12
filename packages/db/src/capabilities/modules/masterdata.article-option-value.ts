import { z } from "zod";

import { DataService } from "../../services/data";
import { defineCapability } from "../core/define";
import { CapabilityError } from "../core/types";

const articleOptionValueRecordSchema = z.looseObject({
  valueId: z.uuid(),
  tenantId: z.uuid(),
  optionId: z.uuid(),
  value: z.string(),
  sortOrder: z.number().int(),
});

const articleOptionValueWritableFields = z.object({
  optionId: z.uuid().optional(),
  value: z.string().trim().min(1).optional(),
  sortOrder: z.number().int().optional(),
});

export const articleOptionValueList = defineCapability({
  module: "masterdata",
  entityName: "articleOptionValue",
  operation: "list",
  kind: "read",
  summary: { en: "List article option values", de: "Artikeloptionswerte auflisten" },
  input: z.object({
    optionId: z.uuid().optional(),
    search: z.string().trim().min(1).optional(),
    limit: z.number().int().min(1).max(200).default(50),
    offset: z.number().int().min(0).default(0),
  }),
  output: z.object({ items: z.array(articleOptionValueRecordSchema) }),
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const filters: Record<string, string> = {};
    if (input.optionId) filters.optionId = input.optionId;
    const rows = await new DataService(ctx.tenantId).list("articleOptionValue", filters, {
      search: input.search,
      limit: input.limit,
      offset: input.offset,
      orderBy: "sortOrder:asc",
    });
    return { items: rows as z.output<typeof articleOptionValueRecordSchema>[] };
  },
});

export const articleOptionValueGet = defineCapability({
  module: "masterdata",
  entityName: "articleOptionValue",
  operation: "get",
  kind: "read",
  summary: { en: "Get an article option value by id", de: "Artikeloptionswert per ID lesen" },
  input: z.object({ valueId: z.uuid() }),
  output: articleOptionValueRecordSchema,
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const row = await new DataService(ctx.tenantId).get("articleOptionValue", input.valueId);
    if (!row) throw new CapabilityError("not_found", "Article option value not found");
    return row;
  },
});

export const articleOptionValueCreate = defineCapability({
  module: "masterdata",
  entityName: "articleOptionValue",
  operation: "create",
  kind: "create",
  summary: { en: "Create an article option value", de: "Artikeloptionswert anlegen" },
  input: z.object({
    optionId: z.uuid(),
    value: z.string().trim().min(1),
    sortOrder: z.number().int().optional(),
  }),
  output: articleOptionValueRecordSchema,
  writesTables: ["articleOptionValue"],
  sideEffects: [],
  idempotent: false,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const [created] = await new DataService(ctx.tenantId).create("articleOptionValue", input);
    return created;
  },
});

export const articleOptionValueUpdate = defineCapability({
  module: "masterdata",
  entityName: "articleOptionValue",
  operation: "update",
  kind: "update",
  summary: { en: "Update an article option value", de: "Artikeloptionswert ändern" },
  input: z.object({
    valueId: z.uuid(),
    patch: articleOptionValueWritableFields.refine((patch) => Object.keys(patch).length > 0, {
      message: "patch must not be empty",
    }),
  }),
  output: articleOptionValueRecordSchema,
  writesTables: ["articleOptionValue"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const [updated] = await new DataService(ctx.tenantId).patch(
      "articleOptionValue",
      input.valueId,
      input.patch,
    );
    if (!updated) throw new CapabilityError("not_found", "Article option value not found");
    return updated;
  },
});

export const articleOptionValueArchive = defineCapability({
  module: "masterdata",
  entityName: "articleOptionValue",
  operation: "archive",
  kind: "archive",
  summary: { en: "Archive an article option value", de: "Artikeloptionswert archivieren" },
  description: {
    en: "Soft delete: the article option value is archived, never hard-deleted.",
    de: "Soft Delete: der Artikeloptionswert wird archiviert, nie hart gelöscht.",
  },
  input: z.object({ valueId: z.uuid() }),
  output: z.object({ valueId: z.uuid(), archived: z.literal(true) }),
  writesTables: ["articleOptionValue"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "confirm", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const [updated] = await new DataService(ctx.tenantId).patch("articleOptionValue", input.valueId, {
      archived: true,
    });
    if (!updated) throw new CapabilityError("not_found", "Article option value not found");
    return { valueId: input.valueId, archived: true as const };
  },
});

export const articleOptionValueCapabilities = [
  articleOptionValueList,
  articleOptionValueGet,
  articleOptionValueCreate,
  articleOptionValueUpdate,
  articleOptionValueArchive,
];
