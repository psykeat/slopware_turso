import { z } from "zod";

import {
  applyVariantTemplateToArticle,
  createVariantTemplate,
  getVariantTemplate,
  listVariantTemplates,
  updateVariantTemplate,
} from "../../services/variant-template";
import { variantTemplateDefinitionSchema } from "../../services/variant-template-schema";
import { defineCapability } from "../core/define";
import { CapabilityError } from "../core/types";

const templateRecordSchema = z.object({
  templateId: z.uuid(),
  slug: z.string(),
  label: z.string(),
  articleGroupId: z.uuid().nullable(),
  definition: variantTemplateDefinitionSchema,
  archived: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date().nullable(),
});

const applyAxesResultSchema = z.object({
  createdOptions: z.number().int(),
  createdValues: z.number().int(),
  matchedOptions: z.number().int(),
  matchedValues: z.number().int(),
});

export const variantTemplateList = defineCapability({
  module: "masterdata",
  entityName: "articleVariantTemplate",
  operation: "list",
  kind: "read",
  summary: {
    en: "List variant templates",
    de: "Variantenvorlagen auflisten",
  },
  input: z.object({ includeArchived: z.boolean().default(false) }),
  output: z.object({ items: z.array(templateRecordSchema) }),
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => ({
    items: await listVariantTemplates(ctx.tenantId, { includeArchived: input.includeArchived }),
  }),
});

export const variantTemplateGet = defineCapability({
  module: "masterdata",
  entityName: "articleVariantTemplate",
  operation: "get",
  kind: "read",
  summary: {
    en: "Get a variant template by id",
    de: "Variantenvorlage per ID lesen",
  },
  input: z.object({ templateId: z.uuid() }),
  output: templateRecordSchema,
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const template = await getVariantTemplate(ctx.tenantId, input.templateId);
    if (!template) {
      throw new CapabilityError("not_found", "Variant template not found");
    }
    return template;
  },
});

export const variantTemplateCreate = defineCapability({
  module: "masterdata",
  entityName: "articleVariantTemplate",
  operation: "create",
  kind: "create",
  summary: {
    en: "Create a variant template",
    de: "Variantenvorlage anlegen",
  },
  description: {
    en: "Creates a reusable product-type template with variant axes, exclusion rules and SKU pattern.",
    de: "Legt eine wiederverwendbare Produkttyp-Vorlage mit Variantenachsen, Ausschlussregeln und SKU-Muster an.",
  },
  input: z.object({
    slug: z.string().trim().min(1),
    label: z.string().trim().min(1),
    articleGroupId: z.uuid().nullable().optional(),
    definition: variantTemplateDefinitionSchema,
  }),
  output: templateRecordSchema,
  writesTables: ["articleVariantTemplate"],
  sideEffects: [],
  idempotent: false,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: (ctx, input) => createVariantTemplate(ctx.tenantId, input),
});

export const variantTemplateUpdate = defineCapability({
  module: "masterdata",
  entityName: "articleVariantTemplate",
  operation: "update",
  kind: "update",
  summary: {
    en: "Update or archive a variant template",
    de: "Variantenvorlage ändern oder archivieren",
  },
  input: z.object({
    templateId: z.uuid(),
    patch: z
      .object({
        slug: z.string().trim().min(1).optional(),
        label: z.string().trim().min(1).optional(),
        articleGroupId: z.uuid().nullable().optional(),
        definition: variantTemplateDefinitionSchema.optional(),
        archived: z.boolean().optional(),
      })
      .refine((patch) => Object.keys(patch).length > 0, { message: "patch must not be empty" }),
  }),
  output: templateRecordSchema,
  writesTables: ["articleVariantTemplate"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: (ctx, input) => updateVariantTemplate(ctx.tenantId, input.templateId, input.patch),
});

export const variantTemplateApplyToArticle = defineCapability({
  module: "masterdata",
  entityName: "articleVariantTemplate",
  operation: "applyToArticle",
  kind: "process",
  summary: {
    en: "Apply a variant template's axes to an article",
    de: "Achsen einer Variantenvorlage auf einen Artikel anwenden",
  },
  description: {
    en: "Merge-only: existing options and values on the article are matched and kept, nothing is deleted.",
    de: "Nur Merge: vorhandene Optionen und Werte des Artikels werden gematcht und behalten, nichts wird gelöscht.",
  },
  input: z.object({
    articleId: z.uuid(),
    templateId: z.uuid(),
  }),
  output: applyAxesResultSchema,
  writesTables: ["articleOption", "articleOptionValue"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: (ctx, input) =>
    applyVariantTemplateToArticle(ctx.tenantId, input.articleId, input.templateId),
});

export const variantTemplateCapabilities = [
  variantTemplateList,
  variantTemplateGet,
  variantTemplateCreate,
  variantTemplateUpdate,
  variantTemplateApplyToArticle,
];
