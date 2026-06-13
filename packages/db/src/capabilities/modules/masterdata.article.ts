import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "../../index";
import { article } from "../../schema/app.schema";
import { DataService } from "../../services/data";
import { defineCapability } from "../core/define";
import { listControlsSchema, runEntityList } from "../core/list";
import { CapabilityError } from "../core/types";

// Output rows come straight from DataService; only the stable identity fields
// are part of the contract, everything else passes through.
const articleRecordSchema = z.looseObject({
  articleId: z.uuid(),
  articleNo: z.string(),
  name: z.string(),
});

const articleWritableFields = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().nullable().optional(),
  kurzbeschreibung: z.string().nullable().optional(),
  langtext: z.string().nullable().optional(),
  notiztext: z.string().nullable().optional(),
  warntext: z.string().nullable().optional(),
  articleGroupId: z.uuid().nullable().optional(),
  taxClassId: z.uuid().nullable().optional(),
  baseUnitId: z.uuid().nullable().optional(),
  salesUnitId: z.uuid().nullable().optional(),
  purchaseUnitId: z.uuid().nullable().optional(),
  defaultWarehouseId: z.uuid().nullable().optional(),
  trackingMode: z.string().nullable().optional(),
  printPositionTexts: z.boolean().nullable().optional(),
  customAttributes: z.record(z.string(), z.unknown()).nullable().optional(),
});

async function findArticleByNo(tenantId: string, articleNo: string) {
  const [row] = await db
    .select({ articleId: article.articleId, archivedAt: article.archivedAt })
    .from(article)
    .where(and(eq(article.tenantId, tenantId), eq(article.articleNo, articleNo)))
    .limit(1);
  return row ?? null;
}

export const articleGet = defineCapability({
  module: "masterdata",
  entityName: "article",
  operation: "get",
  kind: "read",
  summary: {
    en: "Get an article by id",
    de: "Artikel per ID lesen",
  },
  input: z.object({ articleId: z.uuid() }),
  output: articleRecordSchema,
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const row = await new DataService(ctx.tenantId).get("article", input.articleId);
    if (!row) {
      throw new CapabilityError("not_found", "Article not found");
    }
    return row;
  },
});

export const articleList = defineCapability({
  module: "masterdata",
  entityName: "article",
  operation: "list",
  kind: "read",
  summary: {
    en: "List articles",
    de: "Artikel auflisten",
  },
  description: {
    en: "Archived articles are always excluded. Free-text search covers article number, name and text fields.",
    de: "Archivierte Artikel sind immer ausgeschlossen. Die Freitextsuche umfasst Artikelnummer, Name und Textfelder.",
  },
  input: z.object({
    articleGroupId: z.uuid().optional(),
    ...listControlsSchema,
  }),
  output: z.object({ items: z.array(articleRecordSchema), total: z.number().int().optional() }),
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const filters: Record<string, string> = {};
    if (input.articleGroupId) filters.articleGroupId = input.articleGroupId;
    return runEntityList(ctx.tenantId, "article", filters, input, "articleNo:asc");
  },
});

export const articleUpsert = defineCapability({
  module: "masterdata",
  entityName: "article",
  operation: "upsert",
  kind: "update",
  summary: {
    en: "Create or update an article by article number",
    de: "Artikel per Artikelnummer anlegen oder ändern",
  },
  description: {
    en: "articleNo is the natural key: an existing active article is patched, otherwise a new one is created (name required). Safe to retry.",
    de: "articleNo ist der natürliche Schlüssel: ein vorhandener aktiver Artikel wird gepatcht, sonst wird neu angelegt (name erforderlich). Wiederholbar ohne Doppelanlage.",
  },
  input: articleWritableFields.extend({
    articleNo: z.string().trim().min(1),
  }),
  output: z.object({
    article: articleRecordSchema,
    created: z.boolean(),
  }),
  writesTables: ["article", "articleVariant"],
  sideEffects: ["ensures a default article variant on create"],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const service = new DataService(ctx.tenantId);
    const existing = await findArticleByNo(ctx.tenantId, input.articleNo);

    if (existing?.archivedAt) {
      throw new CapabilityError(
        "conflict",
        `Article "${input.articleNo}" exists but is archived; unarchive it first`,
      );
    }

    if (existing) {
      const { articleNo: _articleNo, ...patch } = input;
      if (Object.keys(patch).length === 0) {
        const row = await service.get("article", existing.articleId);
        return { article: row, created: false };
      }
      const [updated] = await service.patch("article", existing.articleId, patch);
      if (!updated) {
        throw new CapabilityError("not_found", "Article not found");
      }
      return { article: updated, created: false };
    }

    if (!input.name) {
      throw new CapabilityError("validation", "name is required when creating a new article", [
        { path: "name", message: "Required when no article with this articleNo exists" },
      ]);
    }
    const [created] = await service.create("article", input);
    return { article: created, created: true };
  },
});

export const articleArchive = defineCapability({
  module: "masterdata",
  entityName: "article",
  operation: "archive",
  kind: "archive",
  summary: {
    en: "Archive an article",
    de: "Artikel archivieren",
  },
  description: {
    en: "Soft delete: the article is archived, never hard-deleted.",
    de: "Soft Delete: der Artikel wird archiviert, nie hart gelöscht.",
  },
  input: z.object({ articleId: z.uuid() }),
  output: z.object({ articleId: z.uuid(), archived: z.literal(true) }),
  writesTables: ["article"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "confirm", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const [updated] = await new DataService(ctx.tenantId).patch("article", input.articleId, {
      archived: true,
    });
    if (!updated) {
      throw new CapabilityError("not_found", "Article not found");
    }
    return { articleId: input.articleId, archived: true as const };
  },
});

export const articleCapabilities = [articleGet, articleList, articleUpsert, articleArchive];
