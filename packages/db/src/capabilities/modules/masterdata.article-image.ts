import { z } from "zod";

import { DataService } from "../../services/data";
import { defineCapability } from "../core/define";
import { CapabilityError } from "../core/types";

const articleImageRecordSchema = z.looseObject({
  articleImageId: z.uuid(),
  tenantId: z.uuid(),
  articleId: z.uuid(),
  storageKey: z.string(),
  fileName: z.string(),
  mimeType: z.string(),
  fileSize: z.number().int(),
  width: z.number().int().nullable().optional(),
  height: z.number().int().nullable().optional(),
  altText: z.string().nullable().optional(),
  sortOrder: z.number().int(),
  archived: z.boolean(),
  createdAt: z.date(),
});

const articleImageCreateSchema = z.object({
  articleId: z.uuid(),
  storageKey: z.string().trim().min(1),
  fileName: z.string().trim().min(1),
  mimeType: z.string().trim().min(1),
  fileSize: z.number().int().nonnegative(),
  width: z.number().int().nullable().optional(),
  height: z.number().int().nullable().optional(),
  altText: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

const articleImagePatchSchema = z.object({
  articleId: z.uuid().optional(),
  storageKey: z.string().trim().min(1).optional(),
  fileName: z.string().trim().min(1).optional(),
  mimeType: z.string().trim().min(1).optional(),
  fileSize: z.number().int().nonnegative().optional(),
  width: z.number().int().nullable().optional(),
  height: z.number().int().nullable().optional(),
  altText: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  archived: z.boolean().optional(),
});

export const articleImageList = defineCapability({
  module: "masterdata",
  entityName: "articleImage",
  operation: "list",
  kind: "read",
  summary: { en: "List article images", de: "Artikelbilder auflisten" },
  input: z.object({
    articleId: z.uuid().optional(),
    search: z.string().trim().min(1).optional(),
    limit: z.number().int().min(1).max(200).default(50),
    offset: z.number().int().min(0).default(0),
  }),
  output: z.object({ items: z.array(articleImageRecordSchema) }),
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const filters: Record<string, string> = {};
    if (input.articleId) filters.articleId = input.articleId;
    const rows = await new DataService(ctx.tenantId).list("articleImage", filters, {
      search: input.search,
      limit: input.limit,
      offset: input.offset,
      orderBy: "sortOrder:asc",
    });
    return { items: rows as z.output<typeof articleImageRecordSchema>[] };
  },
});

export const articleImageGet = defineCapability({
  module: "masterdata",
  entityName: "articleImage",
  operation: "get",
  kind: "read",
  summary: { en: "Get an article image by id", de: "Artikelbild per ID lesen" },
  input: z.object({ articleImageId: z.uuid() }),
  output: articleImageRecordSchema,
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const row = await new DataService(ctx.tenantId).get("articleImage", input.articleImageId);
    if (!row) throw new CapabilityError("not_found", "Article image not found");
    return row;
  },
});

export const articleImageCreate = defineCapability({
  module: "masterdata",
  entityName: "articleImage",
  operation: "create",
  kind: "create",
  summary: { en: "Create an article image", de: "Artikelbild anlegen" },
  input: articleImageCreateSchema,
  output: articleImageRecordSchema,
  writesTables: ["articleImage"],
  sideEffects: [],
  idempotent: false,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const [created] = await new DataService(ctx.tenantId).create("articleImage", input);
    return created;
  },
});

export const articleImageUpdate = defineCapability({
  module: "masterdata",
  entityName: "articleImage",
  operation: "update",
  kind: "update",
  summary: { en: "Update an article image", de: "Artikelbild ändern" },
  input: z.object({
    articleImageId: z.uuid(),
    patch: articleImagePatchSchema.refine((patch) => Object.keys(patch).length > 0, {
      message: "patch must not be empty",
    }),
  }),
  output: articleImageRecordSchema,
  writesTables: ["articleImage"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const [updated] = await new DataService(ctx.tenantId).patch("articleImage", input.articleImageId, input.patch);
    if (!updated) throw new CapabilityError("not_found", "Article image not found");
    return updated;
  },
});

export const articleImageArchive = defineCapability({
  module: "masterdata",
  entityName: "articleImage",
  operation: "archive",
  kind: "archive",
  summary: { en: "Archive an article image", de: "Artikelbild archivieren" },
  description: {
    en: "Soft delete: the article image is archived, never hard-deleted.",
    de: "Soft Delete: das Artikelbild wird archiviert, nie hart gelöscht.",
  },
  input: z.object({ articleImageId: z.uuid() }),
  output: z.object({ articleImageId: z.uuid(), archived: z.literal(true) }),
  writesTables: ["articleImage"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "confirm", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const [updated] = await new DataService(ctx.tenantId).patch("articleImage", input.articleImageId, {
      archived: true,
    });
    if (!updated) throw new CapabilityError("not_found", "Article image not found");
    return { articleImageId: input.articleImageId, archived: true as const };
  },
});

export const articleImageCapabilities = [articleImageList, articleImageGet, articleImageCreate, articleImageUpdate, articleImageArchive];
