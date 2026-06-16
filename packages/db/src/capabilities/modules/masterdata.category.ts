import { z } from "zod";

import { DataService } from "../../services/data";
import { defineCapability } from "../core/define";
import { listControlsSchema, runEntityList } from "../core/list";
import { CapabilityError } from "../core/types";

const categoryRecordSchema = z.looseObject({
  categoryId: z.uuid(),
  tenantId: z.uuid(),
  parentCategoryId: z.uuid().nullable().optional(),
  code: z.string().nullable().optional(),
  name: z.string(),
  slug: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  sortOrder: z.number().int(),
  archived: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date().nullable().optional(),
});

const categoryWritableFields = z.object({
  parentCategoryId: z.uuid().nullable().optional(),
  code: z.string().nullable().optional(),
  name: z.string().trim().min(1).optional(),
  slug: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  archived: z.boolean().optional(),
});

export const categoryList = defineCapability({
  module: "masterdata",
  entityName: "category",
  operation: "list",
  kind: "read",
  summary: { en: "List categories", de: "Kategorien auflisten" },
  input: z.object({ ...listControlsSchema }),
  output: z.object({ items: z.array(categoryRecordSchema), total: z.number().int().optional() }),
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => runEntityList(ctx.tenantId, "category", {}, input, "sortOrder:asc"),
});

export const categoryGet = defineCapability({
  module: "masterdata",
  entityName: "category",
  operation: "get",
  kind: "read",
  summary: { en: "Get a category", de: "Kategorie lesen" },
  input: z.object({ categoryId: z.uuid() }),
  output: categoryRecordSchema,
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const row = await new DataService(ctx.tenantId).get("category", input.categoryId);
    if (!row) throw new CapabilityError("not_found", "Category not found");
    return row;
  },
});

export const categoryCreate = defineCapability({
  module: "masterdata",
  entityName: "category",
  operation: "create",
  kind: "create",
  summary: { en: "Create a category", de: "Kategorie anlegen" },
  input: z.object({
    parentCategoryId: z.uuid().nullable().optional(),
    code: z.string().nullable().optional(),
    name: z.string().trim().min(1),
    slug: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    sortOrder: z.number().int().optional(),
  }),
  output: categoryRecordSchema,
  writesTables: ["category"],
  sideEffects: [],
  idempotent: false,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const [created] = await new DataService(ctx.tenantId).create("category", input);
    return created;
  },
});

export const categoryUpdate = defineCapability({
  module: "masterdata",
  entityName: "category",
  operation: "update",
  kind: "update",
  summary: { en: "Update a category", de: "Kategorie ändern" },
  input: z.object({
    categoryId: z.uuid(),
    patch: categoryWritableFields.refine((patch) => Object.keys(patch).length > 0, {
      message: "patch must not be empty",
    }),
  }),
  output: categoryRecordSchema,
  writesTables: ["category"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const [updated] = await new DataService(ctx.tenantId).patch("category", input.categoryId, input.patch);
    if (!updated) throw new CapabilityError("not_found", "Category not found");
    return updated;
  },
});

export const categoryArchive = defineCapability({
  module: "masterdata",
  entityName: "category",
  operation: "archive",
  kind: "archive",
  summary: { en: "Archive a category", de: "Kategorie archivieren" },
  input: z.object({ categoryId: z.uuid() }),
  output: z.object({ categoryId: z.uuid(), archived: z.literal(true) }),
  writesTables: ["category"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "confirm", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const [updated] = await new DataService(ctx.tenantId).patch("category", input.categoryId, {
      archived: true,
    });
    if (!updated) throw new CapabilityError("not_found", "Category not found");
    return { categoryId: input.categoryId, archived: true as const };
  },
});

export const categoryCapabilities = [categoryList, categoryGet, categoryCreate, categoryUpdate, categoryArchive];
