import { z } from "zod";

import { DataService } from "../../services/data";
import { defineCapability } from "../core/define";
import { defineListCapability } from "../core/list";
import { CapabilityError } from "../core/types";

const articleCategoryRecordSchema = z.looseObject({
  articleCategoryId: z.uuid(),
  tenantId: z.uuid(),
  articleId: z.uuid(),
  categoryId: z.uuid(),
  sortOrder: z.number().int(),
  archived: z.boolean(),
  createdAt: z.date(),
});

const articleCategoryCreateSchema = z.object({
  articleId: z.uuid(),
  categoryId: z.uuid(),
  sortOrder: z.number().int().optional(),
});

const articleCategoryPatchSchema = z.object({
  articleId: z.uuid().optional(),
  categoryId: z.uuid().optional(),
  sortOrder: z.number().int().optional(),
  archived: z.boolean().optional(),
});

export const articleCategoryList = defineListCapability({
  module: "masterdata",
  entityName: "articleCategory",
  summary: { en: "List article categories", de: "Artikelkategorien auflisten" },
  recordSchema: articleCategoryRecordSchema,
  extraFilters: { articleId: z.uuid().optional(), categoryId: z.uuid().optional() },
  defaultOrderBy: "sortOrder:asc",
});

export const articleCategoryGet = defineCapability({
  module: "masterdata",
  entityName: "articleCategory",
  operation: "get",
  kind: "read",
  summary: { en: "Get an article category by id", de: "Artikelkategorie per ID lesen" },
  input: z.object({ articleCategoryId: z.uuid() }),
  output: articleCategoryRecordSchema,
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const row = await new DataService(ctx.tenantId).get("articleCategory", input.articleCategoryId);
    if (!row) throw new CapabilityError("not_found", "Article category not found");
    return row;
  },
});

export const articleCategoryCreate = defineCapability({
  module: "masterdata",
  entityName: "articleCategory",
  operation: "create",
  kind: "create",
  summary: { en: "Create an article category link", de: "Artikel-Kategorien-Zuordnung anlegen" },
  input: articleCategoryCreateSchema,
  output: articleCategoryRecordSchema,
  writesTables: ["articleCategory"],
  sideEffects: [],
  idempotent: false,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const [created] = await new DataService(ctx.tenantId).create("articleCategory", input);
    return created;
  },
});

export const articleCategoryUpdate = defineCapability({
  module: "masterdata",
  entityName: "articleCategory",
  operation: "update",
  kind: "update",
  summary: { en: "Update an article category link", de: "Artikel-Kategorien-Zuordnung ändern" },
  input: z.object({
    articleCategoryId: z.uuid(),
    patch: articleCategoryPatchSchema.refine((patch) => Object.keys(patch).length > 0, {
      message: "patch must not be empty",
    }),
  }),
  output: articleCategoryRecordSchema,
  writesTables: ["articleCategory"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const [updated] = await new DataService(ctx.tenantId).patch(
      "articleCategory",
      input.articleCategoryId,
      input.patch,
    );
    if (!updated) throw new CapabilityError("not_found", "Article category not found");
    return updated;
  },
});

export const articleCategoryArchive = defineCapability({
  module: "masterdata",
  entityName: "articleCategory",
  operation: "archive",
  kind: "archive",
  summary: { en: "Archive an article category link", de: "Artikel-Kategorien-Zuordnung archivieren" },
  description: {
    en: "Soft delete: the article-category link is archived, never hard-deleted.",
    de: "Soft Delete: die Artikel-Kategorien-Zuordnung wird archiviert, nie hart gelöscht.",
  },
  input: z.object({ articleCategoryId: z.uuid() }),
  output: z.object({ articleCategoryId: z.uuid(), archived: z.literal(true) }),
  writesTables: ["articleCategory"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "confirm", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const [updated] = await new DataService(ctx.tenantId).patch("articleCategory", input.articleCategoryId, {
      archived: true,
    });
    if (!updated) throw new CapabilityError("not_found", "Article category not found");
    return { articleCategoryId: input.articleCategoryId, archived: true as const };
  },
});

export const articleCategoryCapabilities = [
  articleCategoryList,
  articleCategoryGet,
  articleCategoryCreate,
  articleCategoryUpdate,
  articleCategoryArchive,
];
