import { z } from "zod";

import { DataService } from "../../services/data";
import { DocumentService } from "../../services/document-service";
import { LogisticsService } from "../../services/logistics-service";
import { defineCapability } from "../core/define";
import { CapabilityError } from "../core/types";

const looseRowSchema = z.looseObject({});

const draftLineInputSchema = z.object({
  documentLineId: z.uuid().nullable().optional(),
  lineNo: z.number().int(),
  articleId: z.uuid().nullable().optional(),
  variantId: z.uuid().nullable().optional(),
  articleTextSnapshot: z.string().nullable().optional(),
  langText: z.string().nullable().optional(),
  langTextSourceEntity: z.string().nullable().optional(),
  langTextSourceId: z.uuid().nullable().optional(),
  langTextSourceField: z.string().nullable().optional(),
  langTextLinkedAt: z.string().nullable().optional(),
  langTextOverriddenAt: z.string().nullable().optional(),
  quantity: z.union([z.string(), z.number()]),
  unit: z.string().nullable().optional(),
  netPrice: z.union([z.string(), z.number()]),
  discountPercentage: z.union([z.string(), z.number()]).nullable().optional(),
  taxCodeId: z.uuid().nullable().optional(),
  taxAmount: z.union([z.string(), z.number()]).nullable().optional(),
  lineTotalNet: z.union([z.string(), z.number()]).nullable().optional(),
  warehouseId: z.uuid().nullable().optional(),
  costCenterId: z.uuid().nullable().optional(),
  movementType: z.string().nullable().optional(),
  lineType: z.string().nullable().optional(),
  bomGroupId: z.uuid().nullable().optional(),
  archived: z.boolean().optional(),
});

const documentWriteInputSchema = z.object({
  documentGroupId: z.uuid().nullable().optional(),
  documentType: z.string().nullable().optional(),
  documentDirection: z.string().nullable().optional(),
  documentDate: z.string().nullable().optional(),
  customerId: z.uuid().nullable().optional(),
  billingAddress: z.unknown().optional(),
  deliveryAddress: z.unknown().optional(),
  deliveryAddressId: z.uuid().nullable().optional(),
  customAttributes: z.unknown().optional(),
  currencyId: z.string().nullable().optional(),
  warehouseId: z.uuid().nullable().optional(),
  paymentTermId: z.uuid().nullable().optional(),
  shippingMethodId: z.uuid().nullable().optional(),
  noteText: z.string().nullable().optional(),
  noteTextSourceEntity: z.string().nullable().optional(),
  noteTextSourceId: z.uuid().nullable().optional(),
  noteTextSourceField: z.string().nullable().optional(),
  noteTextLinkedAt: z.string().nullable().optional(),
  noteTextOverriddenAt: z.string().nullable().optional(),
  preText: z.string().nullable().optional(),
  preTextSourceEntity: z.string().nullable().optional(),
  preTextSourceId: z.uuid().nullable().optional(),
  preTextSourceField: z.string().nullable().optional(),
  preTextLinkedAt: z.string().nullable().optional(),
  preTextOverriddenAt: z.string().nullable().optional(),
  postText: z.string().nullable().optional(),
  postTextSourceEntity: z.string().nullable().optional(),
  postTextSourceId: z.uuid().nullable().optional(),
  postTextSourceField: z.string().nullable().optional(),
  postTextLinkedAt: z.string().nullable().optional(),
  postTextOverriddenAt: z.string().nullable().optional(),
  stornoText: z.string().nullable().optional(),
  stornoTextSourceEntity: z.string().nullable().optional(),
  stornoTextSourceId: z.uuid().nullable().optional(),
  stornoTextSourceField: z.string().nullable().optional(),
  stornoTextLinkedAt: z.string().nullable().optional(),
  stornoTextOverriddenAt: z.string().nullable().optional(),
});

const saveDraftInputSchema = documentWriteInputSchema.extend({
  documentId: z.uuid().nullable().optional(),
  lines: z.array(draftLineInputSchema),
});

const documentUpdateInputSchema = z.object({
  documentId: z.uuid(),
  patch: z
    .record(z.string(), z.unknown())
    .refine((patch) => Object.keys(patch).length > 0, { message: "patch must not be empty" }),
});

export const documentList = defineCapability({
  module: "sales",
  entityName: "document",
  operation: "list",
  kind: "read",
  summary: { en: "List documents", de: "Belege auflisten" },
  input: z.object({
    documentGroupId: z.uuid().optional(),
    documentType: z.string().optional(),
    status: z.string().optional(),
    customerId: z.uuid().optional(),
    companyId: z.uuid().optional(),
    search: z.string().trim().min(1).optional(),
    limit: z.number().int().min(1).max(200).default(50),
    offset: z.number().int().min(0).default(0),
  }),
  output: z.object({ items: z.array(looseRowSchema) }),
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const filters: Record<string, string> = {};
    if (input.documentGroupId) filters.documentGroupId = input.documentGroupId;
    if (input.documentType) filters.documentType = input.documentType;
    if (input.status) filters.status = input.status;
    if (input.customerId) filters.customerId = input.customerId;
    if (input.companyId) filters.companyId = input.companyId;
    const rows = await new DataService(ctx.tenantId).list("document", filters, {
      search: input.search,
      limit: input.limit,
      offset: input.offset,
      orderBy: "documentDate:desc",
    });
    return { items: rows as z.output<typeof looseRowSchema>[] };
  },
});

export const documentGet = defineCapability({
  module: "sales",
  entityName: "document",
  operation: "get",
  kind: "read",
  summary: { en: "Get a document", de: "Beleg lesen" },
  input: z.object({ documentId: z.uuid() }),
  output: looseRowSchema,
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const row = await new DataService(ctx.tenantId).get("document", input.documentId);
    if (!row) throw new CapabilityError("not_found", "Document not found");
    return row;
  },
});

export const documentUpdate = defineCapability({
  module: "sales",
  entityName: "document",
  operation: "update",
  kind: "update",
  summary: { en: "Update a document", de: "Beleg ändern" },
  input: documentUpdateInputSchema,
  output: looseRowSchema,
  writesTables: ["document"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const [updated] = await new DataService(ctx.tenantId).patch("document", input.documentId, input.patch);
    if (!updated) throw new CapabilityError("not_found", "Document not found");
    return updated;
  },
});

export const documentCreate = defineCapability({
  module: "sales",
  entityName: "document",
  operation: "create",
  kind: "create",
  summary: { en: "Create a document", de: "Beleg anlegen" },
  input: documentWriteInputSchema.extend({
    documentGroupId: z.uuid(),
    documentType: z.string().min(1),
    documentDirection: z.string().min(1),
    documentDate: z.string().min(1),
    status: z.string().default("draft"),
  }),
  output: looseRowSchema,
  writesTables: ["document"],
  sideEffects: [],
  idempotent: false,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => new DocumentService().createDocument(ctx.tenantId, input),
});

export const documentSaveDraft = defineCapability({
  module: "sales",
  entityName: "document",
  operation: "saveDraft",
  kind: "update",
  summary: { en: "Save a draft document", de: "Entwurf speichern" },
  input: saveDraftInputSchema,
  output: z.object({
    success: z.boolean(),
    documentId: z.uuid(),
    documentNo: z.string(),
  }),
  writesTables: ["document", "documentLine", "documentLineAllocation"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => new DocumentService().saveDocumentDraft(ctx.tenantId, ctx.userId ?? "", input),
});

export const documentPost = defineCapability({
  module: "sales",
  entityName: "document",
  operation: "post",
  kind: "process",
  summary: { en: "Post a document", de: "Beleg verbuchen" },
  input: z.object({ documentId: z.uuid() }),
  output: z.object({ success: z.boolean(), document: looseRowSchema }),
  writesTables: ["document", "documentLine", "inventoryMovement", "inventoryBalance", "journalEntry", "journalLine"],
  sideEffects: ["creates inventory and accounting postings"],
  idempotent: false,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "confirm", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    if (!ctx.userId) throw new CapabilityError("forbidden", "User id required");
    return new DocumentService().postDocument(input.documentId, ctx.userId, ctx.tenantId);
  },
});

export const documentStorno = defineCapability({
  module: "sales",
  entityName: "document",
  operation: "storno",
  kind: "process",
  summary: { en: "Reverse a document", de: "Beleg stornieren" },
  input: z.object({ documentId: z.uuid() }),
  output: z.object({ success: z.boolean(), stornoDocumentId: z.uuid() }),
  writesTables: ["document", "documentLine"],
  sideEffects: ["creates a reversal document"],
  idempotent: false,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "confirm", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    if (!ctx.userId) throw new CapabilityError("forbidden", "User id required");
    return new DocumentService().stornoDocument(input.documentId, ctx.userId, ctx.tenantId);
  },
});

export const documentDuplicate = defineCapability({
  module: "sales",
  entityName: "document",
  operation: "duplicate",
  kind: "process",
  summary: { en: "Duplicate a document", de: "Beleg duplizieren" },
  input: z.object({
    documentId: z.uuid(),
    targetGroupId: z.uuid(),
  }),
  output: z.object({ documentId: z.uuid(), documentNo: z.string() }),
  writesTables: ["document", "documentLine", "documentLineTracking"],
  sideEffects: ["copies active document lines and tracking rows"],
  idempotent: false,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    if (!ctx.userId) throw new CapabilityError("forbidden", "User id required");
    return new DocumentService().duplicateDocument(
      input.documentId,
      ctx.userId,
      ctx.tenantId,
      input.targetGroupId,
    );
  },
});

export const documentConvert = defineCapability({
  module: "sales",
  entityName: "document",
  operation: "convert",
  kind: "process",
  summary: { en: "Convert a document", de: "Beleg umwandeln" },
  input: z.object({
    documentId: z.uuid(),
    targetGroupId: z.uuid(),
  }),
  output: z.object({ success: z.boolean(), newDocumentId: z.uuid() }),
  writesTables: ["document", "documentLine", "documentLineAllocation", "documentLineTracking"],
  sideEffects: ["archives the source document and creates a target draft"],
  idempotent: false,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    if (!ctx.userId) throw new CapabilityError("forbidden", "User id required");
    return new DocumentService().convertDocument(
      input.documentId,
      ctx.userId,
      ctx.tenantId,
      input.targetGroupId,
    );
  },
});

export const documentDelete = defineCapability({
  module: "sales",
  entityName: "document",
  operation: "delete",
  kind: "archive",
  summary: { en: "Delete a document safely", de: "Beleg sicher löschen" },
  description: {
    en: "Business documents are never hard-deleted; drafts are cancelled and posted documents are reversed through the existing document lifecycle.",
    de: "Belege werden nie hart gelöscht; Entwürfe werden storniert und gebuchte Belege über den bestehenden Beleg-Lifecycle rückgängig gemacht.",
  },
  input: z.object({ documentId: z.uuid() }),
  output: z.object({
    deleted: z.boolean(),
    archived: z.boolean(),
    cancelled: z.boolean(),
    fkViolation: z.boolean().optional(),
  }),
  writesTables: ["document", "documentLine", "documentLineAllocation", "inventoryMovement", "inventoryBalance", "serialNumber"],
  sideEffects: ["cancels the document or reverts its movements"],
  idempotent: false,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "confirm", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => new DocumentService().deleteDocument(input.documentId, ctx.tenantId),
});

const targetGroupCandidateSchema = z.object({
  documentGroupId: z.uuid(),
  name: z.string(),
  documentType: z.string(),
  groupNumber: z.number().int(),
});

export const documentConvertCandidates = defineCapability({
  module: "sales",
  entityName: "document",
  operation: "convertCandidates",
  kind: "read",
  summary: {
    en: "List conversion target groups for a document",
    de: "Wandlungs-Zielgruppen eines Belegs auflisten",
  },
  input: z.object({ documentId: z.uuid() }),
  output: z.object({ candidates: z.array(targetGroupCandidateSchema) }),
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => ({
    candidates: await new DocumentService().getConversionCandidates(
      input.documentId,
      ctx.tenantId,
    ),
  }),
});

export const documentDuplicateCandidates = defineCapability({
  module: "sales",
  entityName: "document",
  operation: "duplicateCandidates",
  kind: "read",
  summary: {
    en: "List duplicate target groups for a document",
    de: "Duplikat-Zielgruppen eines Belegs auflisten",
  },
  input: z.object({ documentId: z.uuid() }),
  output: z.object({ candidates: z.array(targetGroupCandidateSchema) }),
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => ({
    candidates: await new DocumentService().getDuplicateCandidates(input.documentId, ctx.tenantId),
  }),
});

export const documentTree = defineCapability({
  module: "sales",
  entityName: "document",
  operation: "tree",
  kind: "read",
  summary: { en: "Get the document tree", de: "Belegbaum laden" },
  input: z.object({ companyId: z.uuid().optional() }),
  output: z.array(looseRowSchema),
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => new DocumentService().getDocumentTree(ctx.tenantId, input.companyId),
});

export const documentAudit = defineCapability({
  module: "sales",
  entityName: "document",
  operation: "audit",
  kind: "read",
  summary: { en: "Get the document audit trail", de: "Beleg-Audit-Trail laden" },
  input: z.object({ documentId: z.uuid() }),
  output: looseRowSchema,
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => new DocumentService().getDocumentAuditTrail(input.documentId, ctx.tenantId),
});

export const documentShipment = defineCapability({
  module: "sales",
  entityName: "document",
  operation: "shipment",
  kind: "process",
  summary: { en: "Resolve the shipment for a document", de: "Sendung zum Beleg auflösen" },
  input: z.object({ documentId: z.uuid() }),
  output: z.object({
    shipment: looseRowSchema,
    packages: z.array(looseRowSchema),
  }),
  writesTables: ["documentShipment", "documentShipmentPackage"],
  sideEffects: ["creates a shipment when none exists"],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => new LogisticsService().getOrCreateShipment(ctx.tenantId, input.documentId),
});

export const documentDelta = defineCapability({
  module: "sales",
  entityName: "document",
  operation: "delta",
  kind: "process",
  summary: { en: "Apply a delta effect", de: "Delta-Effekt anwenden" },
  input: z.object({
    documentLineId: z.uuid(),
    qtyDelta: z.number(),
  }),
  output: z.object({ success: z.boolean() }),
  writesTables: ["inventoryBalance", "inventoryMovement"],
  sideEffects: ["adjusts stock balances and appends an inventory movement"],
  idempotent: false,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "confirm", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    if (!ctx.userId) throw new CapabilityError("forbidden", "User id required");
    return new DocumentService().applyDeltaEffect(
      input.documentLineId,
      input.qtyDelta,
      ctx.userId,
      ctx.tenantId,
    );
  },
});

export const documentPricing = defineCapability({
  module: "sales",
  entityName: "document",
  operation: "pricing",
  kind: "read",
  summary: { en: "Resolve document pricing", de: "Belegpreis ermitteln" },
  input: z.object({
    variantId: z.uuid(),
    customerId: z.uuid().nullable().optional(),
    documentDate: z.string().optional(),
  }),
  output: z.object({
    unitPrice: z.string(),
    taxCodeId: z.uuid().nullable(),
  }),
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) =>
    new DocumentService().resolveVariantPricing(
      input.variantId,
      input.customerId ?? null,
      input.documentDate ?? new Date().toISOString().slice(0, 10),
      ctx.tenantId,
    ),
});

export const documentCapabilities = [
  documentList,
  documentGet,
  documentUpdate,
  documentCreate,
  documentSaveDraft,
  documentPost,
  documentStorno,
  documentDuplicate,
  documentDuplicateCandidates,
  documentConvert,
  documentConvertCandidates,
  documentDelete,
  documentTree,
  documentAudit,
  documentShipment,
  documentDelta,
  documentPricing,
];
