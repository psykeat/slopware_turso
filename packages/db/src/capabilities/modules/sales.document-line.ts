import { z } from "zod";

import { DataService } from "../../services/data";
import { DocumentService } from "../../services/document-service";
import { defineCapability } from "../core/define";
import { CapabilityError } from "../core/types";

const looseRowSchema = z.looseObject({});

const listInputSchema = z.object({
  documentId: z.uuid().optional(),
  variantId: z.uuid().optional(),
  search: z.string().trim().min(1).optional(),
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
});

const idInputSchema = z.object({ id: z.uuid() });

const patchInputSchema = z.object({
  id: z.uuid(),
  patch: z
    .record(z.string(), z.unknown())
    .refine((patch) => Object.keys(patch).length > 0, { message: "patch must not be empty" }),
});

function makeCrud(entityName: "documentLine" | "documentLineTracking" | "documentLineAllocation", tableName: string, orderBy: string) {
  return {
    list: defineCapability({
      module: "sales",
      entityName,
      operation: "list",
      kind: "read",
      summary: { en: `List ${entityName}`, de: `${entityName} auflisten` },
      input: listInputSchema,
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
        if (input.documentId) filters.documentId = input.documentId;
        if (input.variantId) filters.variantId = input.variantId;
        const rows = await new DataService(ctx.tenantId).list(tableName, filters, {
          search: input.search,
          limit: input.limit,
          offset: input.offset,
          orderBy,
        });
        return { items: rows as z.output<typeof looseRowSchema>[] };
      },
    }),
    get: defineCapability({
      module: "sales",
      entityName,
      operation: "get",
      kind: "read",
      summary: { en: `Get ${entityName}`, de: `${entityName} lesen` },
      input: idInputSchema,
      output: looseRowSchema,
      writesTables: [],
      sideEffects: [],
      idempotent: true,
      supportsDryRun: false,
      minRole: "tenant_user",
      exposure: { llm: "safe", http: true },
      schemaVersion: 1,
      handler: async (ctx, input) => {
        const row = await new DataService(ctx.tenantId).get(tableName, input.id);
        if (!row) throw new CapabilityError("not_found", `${entityName} not found`);
        return row;
      },
    }),
    create: defineCapability({
      module: "sales",
      entityName,
      operation: "create",
      kind: "create",
      summary: { en: `Create ${entityName}`, de: `${entityName} anlegen` },
      input: z.record(z.string(), z.unknown()),
      output: looseRowSchema,
      writesTables: [tableName],
      sideEffects: [],
      idempotent: false,
      supportsDryRun: false,
      minRole: "tenant_user",
      exposure: { llm: "safe", http: true },
      schemaVersion: 1,
      handler: async (ctx, input) => {
        const [created] = await new DataService(ctx.tenantId).create(tableName, input);
        return created;
      },
    }),
    update: defineCapability({
      module: "sales",
      entityName,
      operation: "update",
      kind: "update",
      summary: { en: `Update ${entityName}`, de: `${entityName} ändern` },
      input: patchInputSchema,
      output: looseRowSchema,
      writesTables: [tableName],
      sideEffects: [],
      idempotent: true,
      supportsDryRun: false,
      minRole: "tenant_user",
      exposure: { llm: "safe", http: true },
      schemaVersion: 1,
      handler: async (ctx, input) => {
        const [updated] = await new DataService(ctx.tenantId).patch(tableName, input.id, input.patch);
        if (!updated) throw new CapabilityError("not_found", `${entityName} not found`);
        return updated;
      },
    }),
  };
}

const documentLine = makeCrud("documentLine", "documentLine", "lineNo:asc");
const documentLineTracking = makeCrud("documentLineTracking", "documentLineTracking", "createdAt:asc");
const documentLineAllocation = makeCrud("documentLineAllocation", "documentLineAllocation", "createdAt:asc");

export const documentLineArchive = defineCapability({
  module: "sales",
  entityName: "documentLine",
  operation: "archive",
  kind: "archive",
  summary: { en: "Archive a document line", de: "Belegzeile archivieren" },
  input: z.object({ id: z.uuid() }),
  output: z.object({ id: z.uuid(), archived: z.literal(true) }),
  writesTables: ["documentLine"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "confirm", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const [updated] = await new DataService(ctx.tenantId).patch("documentLine", input.id, {
      archivedAt: new Date(),
    });
    if (!updated) throw new CapabilityError("not_found", "Document line not found");
    return { id: input.id, archived: true as const };
  },
});

export const documentLineTrackingRead = defineCapability({
  module: "sales",
  entityName: "documentLine",
  operation: "tracking",
  kind: "read",
  summary: { en: "Get document line tracking", de: "Belegzeilen-Tracking laden" },
  input: z.object({ documentLineId: z.uuid() }),
  output: z.object({ items: z.array(looseRowSchema) }),
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const rows = await new DataService(ctx.tenantId).list(
      "documentLineTracking",
      { documentLineId: input.documentLineId },
      { orderBy: "createdAt:asc" },
    );
    return { items: rows as z.output<typeof looseRowSchema>[] };
  },
});

export const documentLineDelta = defineCapability({
  module: "sales",
  entityName: "documentLine",
  operation: "delta",
  kind: "process",
  summary: { en: "Apply a document line delta", de: "Delta auf Belegzeile anwenden" },
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

export const documentLineCapabilities = [
  documentLine.list,
  documentLine.get,
  documentLine.create,
  documentLine.update,
  documentLineArchive,
  documentLineTracking.list,
  documentLineTracking.get,
  documentLineTracking.create,
  documentLineTracking.update,
  documentLineTrackingRead,
  documentLineAllocation.list,
  documentLineAllocation.get,
  documentLineAllocation.create,
  documentLineAllocation.update,
  documentLineDelta,
];
