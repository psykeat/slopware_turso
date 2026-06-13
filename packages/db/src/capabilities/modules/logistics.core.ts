import { z } from "zod";

import { DataService } from "../../services/data";
import { LogisticsService } from "../../services/logistics-service";
import { defineCapability } from "../core/define";
import { listInputSchema, listOutputSchema, looseRowSchema, runEntityList } from "../core/list";
import { CapabilityError } from "../core/types";

const looseShipmentSchema = z.looseObject({});

const idInputSchema = z.object({ id: z.uuid() });

const patchInputSchema = z.object({
  id: z.uuid(),
  patch: z
    .record(z.string(), z.unknown())
    .refine((patch) => Object.keys(patch).length > 0, { message: "patch must not be empty" }),
});

function makeCrudCapabilities(entityName: string, tableName: string, orderBy: string) {
  const list = defineCapability({
    module: "logistics",
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
    handler: async (ctx, input) =>
      runEntityList(ctx.tenantId, tableName, input.filters, input, orderBy),
  });

  const get = defineCapability({
    module: "logistics",
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
  });

  const create = defineCapability({
    module: "logistics",
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
  });

  const update = defineCapability({
    module: "logistics",
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
  });

  return [list, get, create, update];
}

export const inventoryItemCapabilities = makeCrudCapabilities("inventoryItem", "inventoryItem", "sku:asc");
export const inventoryBalanceCapabilities = makeCrudCapabilities(
  "inventoryBalance",
  "inventoryBalance",
  "createdAt:desc",
);
export const serialNumberCapabilities = makeCrudCapabilities(
  "serialNumber",
  "serialNumber",
  "serialNo:asc",
);

export const inventoryMovementList = defineCapability({
  module: "logistics",
  entityName: "inventoryMovement",
  operation: "list",
  kind: "read",
  summary: { en: "List inventory movements", de: "Lagerbewegungen auflisten" },
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
    const rows = await new DataService(ctx.tenantId).list("inventoryMovement", input.filters, {
      search: input.search,
      limit: input.limit,
      offset: input.offset,
      orderBy: "movementDate:desc",
    });
    return { items: rows as z.output<typeof looseRowSchema>[] };
  },
});

export const inventoryMovementGet = defineCapability({
  module: "logistics",
  entityName: "inventoryMovement",
  operation: "get",
  kind: "read",
  summary: { en: "Get an inventory movement", de: "Lagerbewegung lesen" },
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
    const row = await new DataService(ctx.tenantId).get("inventoryMovement", input.id);
    if (!row) throw new CapabilityError("not_found", "Inventory movement not found");
    return row;
  },
});

const shipmentListInputSchema = z.object({
  filters: z.record(z.string(), z.string()).default({}),
  search: z.string().trim().min(1).optional(),
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
});

export const documentShipmentList = defineCapability({
  module: "logistics",
  entityName: "documentShipment",
  operation: "list",
  kind: "read",
  summary: { en: "List document shipments", de: "Belegsendungen auflisten" },
  input: shipmentListInputSchema,
  output: z.object({ items: z.array(looseRowSchema) }),
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const rows = await new DataService(ctx.tenantId).list("documentShipment", input.filters, {
      search: input.search,
      limit: input.limit,
      offset: input.offset,
      orderBy: "createdAt:desc",
    });
    return { items: rows as z.output<typeof looseRowSchema>[] };
  },
});

export const documentShipmentGet = defineCapability({
  module: "logistics",
  entityName: "documentShipment",
  operation: "get",
  kind: "read",
  summary: { en: "Get a document shipment", de: "Belegsendung lesen" },
  input: z.object({ documentId: z.uuid() }),
  output: z.object({
    shipment: looseShipmentSchema.nullable(),
    packages: z.array(looseRowSchema),
  }),
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const result = await new LogisticsService().getShipmentWithPackages(ctx.tenantId, input.documentId);
    return result ?? { shipment: null, packages: [] };
  },
});

export const documentShipmentUpdate = defineCapability({
  module: "logistics",
  entityName: "documentShipment",
  operation: "update",
  kind: "update",
  summary: { en: "Update a document shipment", de: "Belegsendung ändern" },
  input: z.object({
    documentId: z.uuid(),
    patch: z.record(z.string(), z.unknown()),
  }),
  output: looseShipmentSchema,
  writesTables: ["documentShipment", "documentShipmentPackage"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const updated = await new LogisticsService().updateShipment(ctx.tenantId, input.documentId, input.patch);
    if (!updated) throw new CapabilityError("not_found", "Document shipment not found");
    return updated;
  },
});

export const documentShipmentSavePackages = defineCapability({
  module: "logistics",
  entityName: "documentShipment",
  operation: "savePackages",
  kind: "process",
  summary: { en: "Replace shipment packages", de: "Sendungspakete ersetzen" },
  input: z.object({
    documentShipmentId: z.uuid(),
    packageLines: z.array(
      z.object({
        seq: z.number().int().min(1),
        weightKg: z.union([z.string(), z.number()]),
      }),
    ),
  }),
  output: z.array(looseRowSchema),
  writesTables: ["documentShipmentPackage"],
  sideEffects: ["replaces all package rows for the shipment"],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) =>
    new LogisticsService().savePackages(
      ctx.tenantId,
      input.documentShipmentId,
      input.packageLines as Array<{ seq: number; weightKg: string }>,
    ),
});

export const documentShipmentExportCsv = defineCapability({
  module: "logistics",
  entityName: "documentShipment",
  operation: "exportCsv",
  kind: "process",
  summary: { en: "Export shipments as CSV", de: "Sendungen als CSV exportieren" },
  input: z.object({ documentIds: z.array(z.uuid()).min(1) }),
  output: z.string(),
  writesTables: ["documentShipment"],
  sideEffects: ["marks shipments as exported"],
  idempotent: false,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => new LogisticsService().exportShipmentsCSV(ctx.tenantId, input.documentIds),
});

export const documentShipmentImportTrackingCsv = defineCapability({
  module: "logistics",
  entityName: "documentShipment",
  operation: "importTrackingCsv",
  kind: "process",
  summary: { en: "Import tracking CSV", de: "Tracking-CSV importieren" },
  input: z.object({ csvContent: z.string().min(1) }),
  output: z.object({ updatedCount: z.number().int() }),
  writesTables: ["documentShipment"],
  sideEffects: ["updates tracking IDs and statuses"],
  idempotent: false,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => new LogisticsService().importTrackingCSV(ctx.tenantId, input.csvContent),
});

export const documentShipmentPackageList = defineCapability({
  module: "logistics",
  entityName: "documentShipmentPackage",
  operation: "list",
  kind: "read",
  summary: { en: "List shipment packages", de: "Sendungspakete auflisten" },
  input: z.object({
    documentShipmentId: z.uuid().optional(),
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
    if (input.documentShipmentId) filters.documentShipmentId = input.documentShipmentId;
    const rows = await new DataService(ctx.tenantId).list("documentShipmentPackage", filters, {
      search: input.search,
      limit: input.limit,
      offset: input.offset,
      orderBy: "seq:asc",
    });
    return { items: rows as z.output<typeof looseRowSchema>[] };
  },
});

export const documentShipmentPackageGet = defineCapability({
  module: "logistics",
  entityName: "documentShipmentPackage",
  operation: "get",
  kind: "read",
  summary: { en: "Get a shipment package", de: "Sendungspaket lesen" },
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
    const row = await new DataService(ctx.tenantId).get("documentShipmentPackage", input.id);
    if (!row) throw new CapabilityError("not_found", "Shipment package not found");
    return row;
  },
});

export const documentShipmentPackageUpdate = defineCapability({
  module: "logistics",
  entityName: "documentShipmentPackage",
  operation: "update",
  kind: "update",
  summary: { en: "Update a shipment package", de: "Sendungspaket ändern" },
  input: patchInputSchema,
  output: looseRowSchema,
  writesTables: ["documentShipmentPackage"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const [updated] = await new DataService(ctx.tenantId).patch(
      "documentShipmentPackage",
      input.id,
      input.patch,
    );
    if (!updated) throw new CapabilityError("not_found", "Shipment package not found");
    return updated;
  },
});

export const logisticsCapabilities = [
  ...inventoryItemCapabilities,
  ...inventoryBalanceCapabilities,
  ...serialNumberCapabilities,
  inventoryMovementList,
  inventoryMovementGet,
  documentShipmentList,
  documentShipmentGet,
  documentShipmentUpdate,
  documentShipmentSavePackages,
  documentShipmentExportCsv,
  documentShipmentImportTrackingCsv,
  documentShipmentPackageList,
  documentShipmentPackageGet,
  documentShipmentPackageUpdate,
];
