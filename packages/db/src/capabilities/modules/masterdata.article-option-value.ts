import { z } from "zod";

import { DataService } from "../../services/data";
import { defineCapability } from "../core/define";
import { defineListCapability } from "../core/list";
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

export const articleOptionValueList = defineListCapability({
  module: "masterdata",
  entityName: "articleOptionValue",
  summary: { en: "List article option values", de: "Artikeloptionswerte auflisten" },
  recordSchema: articleOptionValueRecordSchema,
  extraFilters: { optionId: z.uuid().optional() },
  defaultOrderBy: "sortOrder:asc",
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
    const row = await new DataService().get("articleOptionValue", input.valueId);
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
    const [created] = await new DataService().create("articleOptionValue", input);
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
    const [updated] = await new DataService().patch(
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
    const [updated] = await new DataService().patch("articleOptionValue", input.valueId, {
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
