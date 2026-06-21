import { z } from "zod";

import { db, eq } from "../../index";
import { articleGroup } from "../../schema/sqlite.schema";
import { DataService } from "../../services/data";
import { defineCapability } from "../core/define";
import { defineListCapability } from "../core/list";
import { CapabilityError } from "../core/types";

const articleGroupRecordSchema = z.object({
  articleGroupId: z.uuid(),
  code: z.string(),
  name: z.string(),
  taxClassId: z.uuid().nullable(),
  baseUnitId: z.uuid().nullable(),
  salesUnitId: z.uuid().nullable(),
  purchaseUnitId: z.uuid().nullable(),
  trackingMode: z.string().nullable(),
  bomType: z.string(),
  printPositionTexts: z.boolean().nullable(),
  archived: z.boolean(),
  createdAt: z.date(),
});

const articleGroupWritableFields = z.object({
  name: z.string().trim().min(1).optional(),
  taxClassId: z.uuid().nullable().optional(),
  baseUnitId: z.uuid().nullable().optional(),
  salesUnitId: z.uuid().nullable().optional(),
  purchaseUnitId: z.uuid().nullable().optional(),
  trackingMode: z.string().nullable().optional(),
  bomType: z.string().trim().min(1).optional(),
  printPositionTexts: z.boolean().nullable().optional(),
});

async function findArticleGroupByCode(code: string) {
  const [row] = await db
    .select({ articleGroupId: articleGroup.articleGroupId, archived: articleGroup.archived })
    .from(articleGroup)
    .where(eq(articleGroup.code, code))
    .limit(1);
  return row ?? null;
}

export const articleGroupList = defineListCapability({
  module: "masterdata",
  entityName: "articleGroup",
  summary: { en: "List article groups", de: "Artikelgruppen auflisten" },
  recordSchema: articleGroupRecordSchema,
  defaultOrderBy: "code:asc",
});

export const articleGroupGet = defineCapability({
  module: "masterdata",
  entityName: "articleGroup",
  operation: "get",
  kind: "read",
  summary: {
    en: "Get an article group by id",
    de: "Artikelgruppe per ID lesen",
  },
  input: z.object({ articleGroupId: z.uuid() }),
  output: articleGroupRecordSchema,
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const row = await new DataService().get("articleGroup", input.articleGroupId);
    if (!row) {
      throw new CapabilityError("not_found", "Article group not found");
    }
    return row;
  },
});

export const articleGroupUpsert = defineCapability({
  module: "masterdata",
  entityName: "articleGroup",
  operation: "upsert",
  kind: "update",
  summary: {
    en: "Create or update an article group by code",
    de: "Artikelgruppe per Code anlegen oder ändern",
  },
  description: {
    en: "Code is the natural key: an existing active article group is patched, otherwise a new one is created (name required). Safe to retry.",
    de: "Code ist der natürliche Schlüssel: eine vorhandene aktive Artikelgruppe wird gepatcht, sonst wird neu angelegt (Name erforderlich). Wiederholbar ohne Doppelanlage.",
  },
  input: articleGroupWritableFields.extend({
    code: z.string().trim().min(1),
  }),
  output: z.object({
    articleGroup: articleGroupRecordSchema,
    created: z.boolean(),
  }),
  writesTables: ["articleGroup"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const service = new DataService();
    const existing = await findArticleGroupByCode(input.code);

    if (existing?.archived) {
      throw new CapabilityError(
        "conflict",
        `Article group "${input.code}" exists but is archived; unarchive it first`,
      );
    }

    if (existing) {
      const { code: _code, ...patch } = input;
      if (Object.keys(patch).length === 0) {
        const row = await service.get("articleGroup", existing.articleGroupId);
        return { articleGroup: row, created: false };
      }
      const [updated] = await service.patch("articleGroup", existing.articleGroupId, patch);
      if (!updated) {
        throw new CapabilityError("not_found", "Article group not found");
      }
      return { articleGroup: updated, created: false };
    }

    if (!input.name) {
      throw new CapabilityError(
        "validation",
        "name is required when creating a new article group",
        [{ path: "name", message: "Required when no article group with this code exists" }],
      );
    }

    const [created] = await service.create("articleGroup", input);
    return { articleGroup: created, created: true };
  },
});

export const articleGroupArchive = defineCapability({
  module: "masterdata",
  entityName: "articleGroup",
  operation: "archive",
  kind: "archive",
  summary: {
    en: "Archive an article group",
    de: "Artikelgruppe archivieren",
  },
  description: {
    en: "Soft delete: the article group is archived, never hard-deleted.",
    de: "Soft Delete: die Artikelgruppe wird archiviert, nie hart gelöscht.",
  },
  input: z.object({ articleGroupId: z.uuid() }),
  output: z.object({ articleGroupId: z.uuid(), archived: z.literal(true) }),
  writesTables: ["articleGroup"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "confirm", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const [updated] = await new DataService().patch("articleGroup", input.articleGroupId, {
      archived: true,
    });
    if (!updated) {
      throw new CapabilityError("not_found", "Article group not found");
    }
    return { articleGroupId: input.articleGroupId, archived: true as const };
  },
});

export const articleGroupCapabilities = [
  articleGroupList,
  articleGroupGet,
  articleGroupUpsert,
  articleGroupArchive,
];
