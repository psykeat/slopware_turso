import { z } from "zod";

import { DataService } from "../../services/data";
import { DocumentService } from "../../services/document-service";
import { defineCapability } from "../core/define";
import { listControlsSchema, listOutputSchema, runEntityList } from "../core/list";
import { CapabilityError } from "../core/types";

const looseRowSchema = z.looseObject({});

const listInputSchema = z.object({
  documentId: z.uuid().optional(),
  variantId: z.uuid().optional(),
  ...listControlsSchema,
});

const idInputSchema = z.object({ id: z.uuid() });

const patchInputSchema = z.object({
  id: z.uuid(),
  patch: z
    .record(z.string(), z.unknown())
    .refine((patch) => Object.keys(patch).length > 0, { message: "patch must not be empty" }),
});

function makeCrud(
  entityName: "documentLine" | "documentLineTracking" | "documentLineAllocation",
  tableName: string,
  orderBy: string,
) {
  return {
    list: defineCapability({
      module: "sales",
      entityName,
      operation: "list",
      kind: "read",
      summary: { en: `List ${entityName}`, de: `${entityName} auflisten` },
      input: listInputSchema,
      output: listOutputSchema,
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
        return runEntityList(tableName, filters, input, orderBy);
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
        const row = await new DataService().get(tableName, input.id);
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
        const [created] = await new DataService().create(tableName, input);
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
        const [updated] = await new DataService().patch(tableName, input.id, input.patch);
        if (!updated) throw new CapabilityError("not_found", `${entityName} not found`);
        return updated;
      },
    }),
  };
}

const documentLine = makeCrud("documentLine", "documentLine", "lineNo:asc");
const documentLineTracking = makeCrud(
  "documentLineTracking",
  "documentLineTracking",
  "createdAt:asc",
);
const documentLineAllocation = makeCrud(
  "documentLineAllocation",
  "documentLineAllocation",
  "createdAt:asc",
);

// A document line is never a plain row insert: it runs through the document
// lifecycle (validate the parent, sequence/compute line fields, explode BOMs),
// which can yield several rows. Delegates to DocumentService.createDocumentLine,
// matching the /api/data POST special-case it replaces, and returns every
// inserted row. Defined standalone (not via makeCrud) because of the array shape.
export const documentLineCreate = defineCapability({
  module: "sales",
  entityName: "documentLine",
  operation: "create",
  kind: "create",
  summary: { en: "Create a document line", de: "Belegzeile anlegen" },
  input: z.record(z.string(), z.unknown()),
  output: z.object({ lines: z.array(looseRowSchema) }),
  writesTables: ["documentLine"],
  sideEffects: ["recomputes document totals", "explodes BOM components"],
  idempotent: false,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const lines = await new DocumentService().createDocumentLine(
      input as Parameters<DocumentService["createDocumentLine"]>[0],
    );
    return { lines: lines as z.output<typeof looseRowSchema>[] };
  },
});

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
    const [updated] = await new DataService().patch("documentLine", input.id, {
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
    const rows = await new DataService().list(
      "documentLineTracking",
      { documentLineId: input.documentLineId },
      { orderBy: "createdAt:asc" },
    );
    return { items: rows as z.output<typeof looseRowSchema>[] };
  },
});

async function assertLineInDocument(tenantId: string, documentId: string, documentLineId: string) {
  const line = await new DataService().get("documentLine", documentLineId);
  if (!line || (line as { documentId?: string }).documentId !== documentId) {
    throw new CapabilityError("not_found", "Document line not found");
  }
}

export const documentLineTrackingAdd = defineCapability({
  module: "sales",
  entityName: "documentLineTracking",
  operation: "add",
  kind: "create",
  summary: {
    en: "Add a tracking row to a document line",
    de: "Tracking-Zeile zur Belegzeile hinzufügen",
  },
  description: {
    en: "Exactly one of serialNumberId, serialNo or batchNo must be provided.",
    de: "Genau eines von serialNumberId, serialNo oder batchNo muss übergeben werden.",
  },
  input: z
    .object({
      documentId: z.uuid(),
      documentLineId: z.uuid(),
      serialNumberId: z.uuid().optional(),
      serialNo: z.string().trim().min(1).optional(),
      batchNo: z.string().trim().min(1).optional(),
      qty: z.union([z.string(), z.number()]),
    })
    .refine(
      (value) => [value.serialNumberId, value.serialNo, value.batchNo].filter(Boolean).length === 1,
      { message: "Exactly one of serialNumberId, serialNo or batchNo must be provided" },
    ),
  output: looseRowSchema,
  writesTables: ["documentLineTracking"],
  sideEffects: [],
  idempotent: false,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    await assertLineInDocument(ctx.tenantId, input.documentId, input.documentLineId);
    const [inserted] = await new DataService().create("documentLineTracking", {
      documentLineId: input.documentLineId,
      serialNumberId: input.serialNumberId ?? null,
      serialNo: input.serialNo ?? null,
      batchNo: input.batchNo ?? null,
      qty: String(input.qty),
    });
    return inserted;
  },
});

export const documentLineTrackingRemove = defineCapability({
  module: "sales",
  entityName: "documentLineTracking",
  operation: "remove",
  kind: "archive",
  summary: { en: "Remove a tracking row", de: "Tracking-Zeile entfernen" },
  description: {
    en: "Tracking rows are pre-posting working data; removing one deletes the row (the underlying movements stay untouched).",
    de: "Tracking-Zeilen sind Arbeitsdaten vor der Verbuchung; das Entfernen löscht die Zeile (Bewegungen bleiben unberührt).",
  },
  input: z.object({
    documentId: z.uuid(),
    documentLineId: z.uuid(),
    trackingId: z.uuid(),
  }),
  output: z.object({ success: z.literal(true) }),
  writesTables: ["documentLineTracking"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    await assertLineInDocument(ctx.tenantId, input.documentId, input.documentLineId);
    const tracking = await new DataService().get("documentLineTracking", input.trackingId);
    if (
      !tracking ||
      (tracking as { documentLineId?: string }).documentLineId !== input.documentLineId
    ) {
      throw new CapabilityError("not_found", "Tracking entry not found");
    }
    const result = await new DataService().delete("documentLineTracking", input.trackingId);
    if (!result.deleted)
      throw new CapabilityError("conflict", "Tracking entry could not be removed");
    return { success: true as const };
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
    return new DocumentService().applyDeltaEffect(input.documentLineId, input.qtyDelta, ctx.userId);
  },
});

export const documentLineCapabilities = [
  documentLine.list,
  documentLine.get,
  documentLineCreate,
  documentLine.update,
  documentLineArchive,
  documentLineTracking.list,
  documentLineTracking.get,
  documentLineTracking.create,
  documentLineTracking.update,
  documentLineTrackingRead,
  documentLineTrackingAdd,
  documentLineTrackingRemove,
  documentLineAllocation.list,
  documentLineAllocation.get,
  documentLineAllocation.create,
  documentLineAllocation.update,
  documentLineDelta,
];
