import { z } from "zod";

import { DataService } from "../../services/data";
import { defineCapability } from "../core/define";
import { defineListCapability } from "../core/list";
import { CapabilityError } from "../core/types";

const articleMediaRecordSchema = z.looseObject({
  articleMediaId: z.uuid(),
  tenantId: z.uuid(),
  articleId: z.uuid(),
  variantId: z.uuid().nullable().optional(),
  mediaAssetId: z.uuid(),
  role: z.string(),
  sortOrder: z.number().int(),
  archived: z.boolean(),
  createdAt: z.date(),
});

const articleMediaCreateSchema = z.object({
  articleId: z.uuid(),
  variantId: z.uuid().nullable().optional(),
  mediaAssetId: z.uuid(),
  role: z.string().trim().min(1).optional(),
  sortOrder: z.number().int().optional(),
});

const articleMediaPatchSchema = z.object({
  articleId: z.uuid().optional(),
  variantId: z.uuid().nullable().optional(),
  mediaAssetId: z.uuid().optional(),
  role: z.string().trim().min(1).optional(),
  sortOrder: z.number().int().optional(),
  archived: z.boolean().optional(),
});

export const articleMediaList = defineListCapability({
  module: "masterdata",
  entityName: "articleMedia",
  summary: { en: "List article media links", de: "Artikelmedien-Verknüpfungen auflisten" },
  recordSchema: articleMediaRecordSchema,
  extraFilters: {
    articleId: z.uuid().optional(),
    variantId: z.uuid().optional(),
    mediaAssetId: z.uuid().optional(),
  },
  defaultOrderBy: "sortOrder:asc",
});

export const articleMediaGet = defineCapability({
  module: "masterdata",
  entityName: "articleMedia",
  operation: "get",
  kind: "read",
  summary: { en: "Get an article media link by id", de: "Artikelmedien-Verknüpfung per ID lesen" },
  input: z.object({ articleMediaId: z.uuid() }),
  output: articleMediaRecordSchema,
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const row = await new DataService(ctx.tenantId).get("articleMedia", input.articleMediaId);
    if (!row) throw new CapabilityError("not_found", "Article media link not found");
    return row;
  },
});

export const articleMediaCreate = defineCapability({
  module: "masterdata",
  entityName: "articleMedia",
  operation: "create",
  kind: "create",
  summary: { en: "Create an article media link", de: "Artikelmedien-Verknüpfung anlegen" },
  input: articleMediaCreateSchema,
  output: articleMediaRecordSchema,
  writesTables: ["articleMedia"],
  sideEffects: [],
  idempotent: false,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const [created] = await new DataService(ctx.tenantId).create("articleMedia", input);
    return created;
  },
});

export const articleMediaUpdate = defineCapability({
  module: "masterdata",
  entityName: "articleMedia",
  operation: "update",
  kind: "update",
  summary: { en: "Update an article media link", de: "Artikelmedien-Verknüpfung ändern" },
  input: z.object({
    articleMediaId: z.uuid(),
    patch: articleMediaPatchSchema.refine((patch) => Object.keys(patch).length > 0, {
      message: "patch must not be empty",
    }),
  }),
  output: articleMediaRecordSchema,
  writesTables: ["articleMedia"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const [updated] = await new DataService(ctx.tenantId).patch("articleMedia", input.articleMediaId, input.patch);
    if (!updated) throw new CapabilityError("not_found", "Article media link not found");
    return updated;
  },
});

export const articleMediaArchive = defineCapability({
  module: "masterdata",
  entityName: "articleMedia",
  operation: "archive",
  kind: "archive",
  summary: { en: "Archive an article media link", de: "Artikelmedien-Verknüpfung archivieren" },
  description: {
    en: "Soft delete: the article media link is archived, never hard-deleted.",
    de: "Soft Delete: die Artikelmedien-Verknüpfung wird archiviert, nie hart gelöscht.",
  },
  input: z.object({ articleMediaId: z.uuid() }),
  output: z.object({ articleMediaId: z.uuid(), archived: z.literal(true) }),
  writesTables: ["articleMedia"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "confirm", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const [updated] = await new DataService(ctx.tenantId).patch("articleMedia", input.articleMediaId, {
      archived: true,
    });
    if (!updated) throw new CapabilityError("not_found", "Article media link not found");
    return { articleMediaId: input.articleMediaId, archived: true as const };
  },
});

export const articleMediaCapabilities = [articleMediaList, articleMediaGet, articleMediaCreate, articleMediaUpdate, articleMediaArchive];
