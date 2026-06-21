import { z } from "zod";

import {
  archiveArticleVariants,
  generateArticleVariants,
  previewArticleVariants,
} from "../../services/article-variant-generator";
import { DataService } from "../../services/data";
import { DocumentService } from "../../services/document-service";
import { copyVariantAxesFromArticle } from "../../services/variant-template";
import { defineCapability } from "../core/define";
import { listControlsSchema, runEntityList } from "../core/list";
import { CapabilityError } from "../core/types";

const articleVariantRecordSchema = z.looseObject({
  variantId: z.uuid(),
  articleId: z.uuid(),
  sku: z.string(),
  ean: z.string().nullable().optional(),
  optionValueHash: z.string(),
  price: z.union([z.string(), z.number()]).nullable().optional(),
  weight: z.union([z.string(), z.number()]).nullable().optional(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

const articleVariantWritableFields = z.object({
  articleId: z.uuid().optional(),
  sku: z.string().trim().min(1).optional(),
  ean: z.string().nullable().optional(),
  optionValueHash: z.string().trim().min(1).optional(),
  price: z.union([z.string(), z.number()]).nullable().optional(),
  weight: z.union([z.string(), z.number()]).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const articleVariantList = defineCapability({
  module: "masterdata",
  entityName: "articleVariant",
  operation: "list",
  kind: "read",
  summary: { en: "List article variants", de: "Artikelvarianten auflisten" },
  input: z.object({
    articleId: z.uuid().optional(),
    ...listControlsSchema,
  }),
  output: z.object({
    items: z.array(articleVariantRecordSchema),
    total: z.number().int().optional(),
  }),
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
    return runEntityList<z.output<typeof articleVariantRecordSchema>>(
      "articleVariant",
      filters,
      input,
      "sku:asc",
    );
  },
});

export const articleVariantGet = defineCapability({
  module: "masterdata",
  entityName: "articleVariant",
  operation: "get",
  kind: "read",
  summary: { en: "Get an article variant by id", de: "Artikelvariante per ID lesen" },
  input: z.object({ variantId: z.uuid() }),
  output: articleVariantRecordSchema,
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const row = await new DataService().get("articleVariant", input.variantId);
    if (!row) throw new CapabilityError("not_found", "Article variant not found");
    return row;
  },
});

export const articleVariantUpdate = defineCapability({
  module: "masterdata",
  entityName: "articleVariant",
  operation: "update",
  kind: "update",
  summary: { en: "Update an article variant", de: "Artikelvariante ändern" },
  input: z.object({
    variantId: z.uuid(),
    patch: articleVariantWritableFields.refine((patch) => Object.keys(patch).length > 0, {
      message: "patch must not be empty",
    }),
  }),
  output: articleVariantRecordSchema,
  writesTables: ["articleVariant"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const [updated] = await new DataService().patch("articleVariant", input.variantId, input.patch);
    if (!updated) throw new CapabilityError("not_found", "Article variant not found");
    return updated;
  },
});

export const articleVariantArchive = defineCapability({
  module: "masterdata",
  entityName: "articleVariant",
  operation: "archive",
  kind: "archive",
  summary: { en: "Archive article variants", de: "Artikelvarianten archivieren" },
  description: {
    en: "Soft delete: variants are deactivated and their inventory items are marked untracked.",
    de: "Soft Delete: Varianten werden deaktiviert und ihre Lagerartikel als nicht verfolgt markiert.",
  },
  input: z.object({
    articleId: z.uuid(),
    variantIds: z.array(z.uuid()).optional(),
  }),
  output: z.object({ archivedVariants: z.number().int() }),
  writesTables: ["articleVariant", "inventoryItem"],
  sideEffects: ["marks inventory items as untracked"],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "confirm", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) =>
    archiveArticleVariants(ctx.tenantId, input.articleId, input.variantIds),
});

export const articleVariantGenerateVariants = defineCapability({
  module: "masterdata",
  entityName: "articleVariant",
  operation: "generateVariants",
  kind: "process",
  summary: { en: "Generate article variants", de: "Artikelvarianten erzeugen" },
  input: z.object({
    articleId: z.uuid(),
    templateId: z.uuid().optional(),
  }),
  output: z.object({
    articleId: z.uuid(),
    combinations: z.number().int(),
    createdVariants: z.number().int(),
    createdInventoryItems: z.number().int(),
    skippedVariants: z.number().int(),
    excludedVariants: z.number().int(),
  }),
  writesTables: ["articleVariant", "articleVariantOptionValue", "inventoryItem"],
  sideEffects: ["creates inventory items when missing"],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) =>
    generateArticleVariants(ctx.tenantId, input.articleId, {
      templateId: input.templateId,
    }),
});

export const articleVariantPreviewVariants = defineCapability({
  module: "masterdata",
  entityName: "articleVariant",
  operation: "previewVariants",
  kind: "read",
  summary: { en: "Preview article variants", de: "Artikelvarianten vorschauen" },
  input: z.object({
    articleId: z.uuid(),
    templateId: z.uuid().optional(),
  }),
  output: z.object({
    articleId: z.uuid(),
    axes: z.array(
      z.object({
        optionId: z.uuid(),
        optionName: z.string(),
        values: z.array(
          z.object({
            valueId: z.uuid(),
            value: z.string(),
          }),
        ),
      }),
    ),
    combinations: z.array(z.looseObject({ optionValueHash: z.string(), status: z.string() })),
    counts: z.object({
      total: z.number().int(),
      create: z.number().int(),
      exists: z.number().int(),
      excluded: z.number().int(),
    }),
  }),
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) =>
    previewArticleVariants(ctx.tenantId, input.articleId, {
      templateId: input.templateId,
    }),
});

export const articleVariantCopyVariantAxes = defineCapability({
  module: "masterdata",
  entityName: "articleVariant",
  operation: "copyVariantAxes",
  kind: "process",
  summary: {
    en: "Copy variant axes from another article",
    de: "Variantenachsen von anderem Artikel kopieren",
  },
  input: z.object({
    targetArticleId: z.uuid(),
    sourceArticleId: z.uuid(),
  }),
  output: z.object({
    createdOptions: z.number().int(),
    createdValues: z.number().int(),
    matchedOptions: z.number().int(),
    matchedValues: z.number().int(),
  }),
  writesTables: ["articleOption", "articleOptionValue"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    if (input.targetArticleId === input.sourceArticleId) {
      throw new CapabilityError("validation", "Source and target article must differ");
    }
    return copyVariantAxesFromArticle(ctx.tenantId, input.targetArticleId, input.sourceArticleId);
  },
});

export const articleVariantPricing = defineCapability({
  module: "masterdata",
  entityName: "articleVariant",
  operation: "pricing",
  kind: "read",
  summary: { en: "Resolve variant pricing", de: "Variantenpreis ermitteln" },
  input: z.object({
    variantId: z.uuid(),
    customerId: z.uuid().nullable().optional(),
    documentDate: z.string().optional(),
    deliveryAddressId: z.uuid().nullable().optional(),
    deliveryCountryCode: z.string().nullable().optional(),
    billingCountryCode: z.string().nullable().optional(),
  }),
  output: z.object({
    unitPrice: z.string(),
    taxCodeId: z.uuid().nullable(),
    taxReason: z.string(),
    taxRuleId: z.uuid().nullable(),
    taxCountryCodeUsed: z.string().nullable(),
    taxRate: z.string().nullable(),
    articleTaxClassId: z.uuid().nullable(),
    customerTaxClassId: z.uuid().nullable(),
  }),
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const service = new DocumentService();
    return service.resolveVariantPricing(
      input.variantId,
      input.customerId ?? null,
      input.documentDate ?? new Date().toISOString().slice(0, 10),
      ctx.tenantId,
      {
        deliveryAddressId: input.deliveryAddressId ?? null,
        deliveryCountryCode: input.deliveryCountryCode ?? null,
        billingCountryCode: input.billingCountryCode ?? null,
      },
    );
  },
});

export const articleVariantArchiveBulk = defineCapability({
  module: "masterdata",
  entityName: "articleVariant",
  operation: "archiveBulk",
  kind: "archive",
  summary: {
    en: "Archive variants of an article",
    de: "Varianten eines Artikels archivieren",
  },
  description: {
    en: "Archives all variants of the article, or only the given variantIds.",
    de: "Archiviert alle Varianten des Artikels oder nur die übergebenen variantIds.",
  },
  input: z.object({
    articleId: z.uuid(),
    variantIds: z.array(z.uuid()).optional(),
  }),
  output: z.object({ archivedVariants: z.number().int() }),
  writesTables: ["articleVariant"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) =>
    archiveArticleVariants(ctx.tenantId, input.articleId, input.variantIds),
});

export const articleVariantCapabilities = [
  articleVariantList,
  articleVariantGet,
  articleVariantUpdate,
  articleVariantArchive,
  articleVariantArchiveBulk,
  articleVariantGenerateVariants,
  articleVariantPreviewVariants,
  articleVariantCopyVariantAxes,
  articleVariantPricing,
];
