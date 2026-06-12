import { z } from "zod";

import { ImportService } from "../../services/import-service";
import { defineCapability } from "../core/define";
import { CapabilityError, type ExecutionContext } from "../core/types";

const looseRowSchema = z.looseObject({});

function service(ctx: ExecutionContext): ImportService {
  return new ImportService(ctx.tenantId, ctx.userId ?? "system");
}

export const importBatchList = defineCapability({
  module: "import",
  entityName: "importBatch",
  operation: "list",
  kind: "read",
  summary: { en: "List import batches", de: "Import-Batches auflisten" },
  input: z.object({
    profileId: z.uuid().optional(),
    status: z.string().optional(),
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
    const items = await service(ctx).listBatches({
      profileId: input.profileId,
      status: input.status,
    });
    return { items: items as z.output<typeof looseRowSchema>[] };
  },
});

export const importBatchGet = defineCapability({
  module: "import",
  entityName: "importBatch",
  operation: "get",
  kind: "read",
  summary: { en: "Get an import batch with rows", de: "Import-Batch mit Zeilen lesen" },
  input: z.object({ batchId: z.uuid() }),
  output: z.object({ batch: looseRowSchema, rows: z.array(looseRowSchema) }),
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const result = await service(ctx).getBatch(input.batchId);
    return result as { batch: z.output<typeof looseRowSchema>; rows: z.output<typeof looseRowSchema>[] };
  },
});

export const importBatchApprove = defineCapability({
  module: "import",
  entityName: "importBatch",
  operation: "approve",
  kind: "process",
  summary: { en: "Approve an import batch", de: "Import-Batch freigeben" },
  description: {
    en: "Marks a pending/validating batch as approved so it can be posted.",
    de: "Markiert einen Batch im Status pending/validating als freigegeben, damit er gebucht werden kann.",
  },
  input: z.object({ batchId: z.uuid() }),
  output: z.object({ ok: z.literal(true) }),
  writesTables: ["importBatch"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "confirm", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    try {
      await service(ctx).approveBatch(input.batchId);
    } catch (error) {
      if (error instanceof Error && /cannot be approved/i.test(error.message)) {
        throw new CapabilityError("conflict", error.message);
      }
      throw error;
    }
    return { ok: true as const };
  },
});

export const importBatchPost = defineCapability({
  module: "import",
  entityName: "importBatch",
  operation: "post",
  kind: "process",
  summary: { en: "Post an import batch", de: "Import-Batch buchen" },
  description: {
    en: "Writes the approved batch rows into their target entities. The written tables depend on the import profile.",
    de: "Schreibt die freigegebenen Batch-Zeilen in ihre Ziel-Entitäten. Die geschriebenen Tabellen hängen vom Import-Profil ab.",
  },
  input: z.object({ batchId: z.uuid() }),
  output: z.object({ posted: z.number().int(), failed: z.number().int() }),
  writesTables: ["importBatch"],
  sideEffects: ["writes imported rows into profile target entities"],
  idempotent: false,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "confirm", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    try {
      return await service(ctx).postBatch(input.batchId);
    } catch (error) {
      if (
        error instanceof Error &&
        (/cannot be posted/i.test(error.message) || /requires approval/i.test(error.message))
      ) {
        throw new CapabilityError("conflict", error.message);
      }
      throw error;
    }
  },
});

const mappingRowSchema = z.object({
  sourceField: z.string().min(1),
  targetTable: z.string().min(1),
  targetColumn: z.string().min(1),
  transform: z.record(z.string(), z.unknown()).optional(),
  defaultValue: z.unknown().optional(),
});

export const importBatchUpload = defineCapability({
  module: "import",
  entityName: "importBatch",
  operation: "upload",
  kind: "create",
  summary: { en: "Upload a CSV as an import batch", de: "CSV als Import-Batch hochladen" },
  description: {
    en: "Parses the CSV against the active mapping version of the connector/profile pair and stages the rows as a pending batch.",
    de: "Parst die CSV gegen die aktive Mapping-Version des Connector/Profil-Paars und legt die Zeilen als pending Batch ab.",
  },
  input: z.object({
    csvText: z.string().min(1),
    profileId: z.uuid(),
    tenantConnectorId: z.uuid(),
    delimiter: z.string().length(1).optional(),
  }),
  output: z.object({
    batchId: z.uuid(),
    rowCount: z.number().int(),
    status: z.string(),
  }),
  writesTables: ["importBatch"],
  sideEffects: ["stages parsed CSV rows for review"],
  idempotent: false,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) =>
    service(ctx).uploadCSV({
      csvText: input.csvText,
      profileId: input.profileId,
      tenantConnectorId: input.tenantConnectorId,
      delimiter: input.delimiter,
    }),
});

export const importProfileList = defineCapability({
  module: "import",
  entityName: "importProfile",
  operation: "list",
  kind: "read",
  summary: { en: "List import profiles", de: "Import-Profile auflisten" },
  input: z.object({}),
  output: z.object({ items: z.array(looseRowSchema) }),
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx) => ({
    items: (await service(ctx).listProfiles()) as z.output<typeof looseRowSchema>[],
  }),
});

export const importProfileCreate = defineCapability({
  module: "import",
  entityName: "importProfile",
  operation: "create",
  kind: "create",
  summary: { en: "Create an import profile", de: "Import-Profil anlegen" },
  input: z.object({
    slug: z.string().min(1),
    label: z.string().min(1),
    targetEntity: z.string().min(1),
    targetCommandKey: z.string().min(1),
    requiresApproval: z.boolean().default(true),
  }),
  output: looseRowSchema,
  writesTables: ["importProfile"],
  sideEffects: [],
  idempotent: false,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => service(ctx).createProfile(input),
});

export const importProfileUpdate = defineCapability({
  module: "import",
  entityName: "importProfile",
  operation: "update",
  kind: "update",
  summary: { en: "Update an import profile", de: "Import-Profil ändern" },
  input: z.object({
    profileId: z.uuid(),
    patch: z.object({
      slug: z.string().min(1).optional(),
      label: z.string().min(1).optional(),
      targetEntity: z.string().min(1).optional(),
      targetCommandKey: z.string().min(1).optional(),
      requiresApproval: z.boolean().optional(),
      archived: z.boolean().optional(),
    }),
  }),
  output: looseRowSchema,
  writesTables: ["importProfile"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const updated = await service(ctx).updateProfile(input.profileId, input.patch);
    if (!updated) throw new CapabilityError("not_found", "Import profile not found");
    return updated;
  },
});

export const importProfileMappingsGet = defineCapability({
  module: "import",
  entityName: "importProfile",
  operation: "mappings",
  kind: "read",
  summary: { en: "Get connector mappings for a profile", de: "Connector-Mappings eines Profils lesen" },
  input: z.object({
    profileId: z.uuid(),
    tenantConnectorId: z.uuid(),
  }),
  output: z.object({ items: z.array(looseRowSchema) }),
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => ({
    items: (await service(ctx).getMappings(
      input.tenantConnectorId,
      input.profileId,
    )) as z.output<typeof looseRowSchema>[],
  }),
});

export const importProfileSaveMappings = defineCapability({
  module: "import",
  entityName: "importProfile",
  operation: "saveMappings",
  kind: "update",
  summary: { en: "Replace connector mappings for a profile", de: "Connector-Mappings eines Profils ersetzen" },
  input: z.object({
    profileId: z.uuid(),
    tenantConnectorId: z.uuid(),
    rows: z.array(mappingRowSchema).default([]),
  }),
  output: z.object({ ok: z.literal(true) }),
  writesTables: ["tenantConnectorMapping"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    await service(ctx).saveMappings(input.tenantConnectorId, input.profileId, input.rows);
    return { ok: true as const };
  },
});

export const importProfileActivateMapping = defineCapability({
  module: "import",
  entityName: "importProfile",
  operation: "activateMapping",
  kind: "process",
  summary: { en: "Activate the current mapping as a version", de: "Aktuelles Mapping als Version aktivieren" },
  input: z.object({
    profileId: z.uuid(),
    tenantConnectorId: z.uuid(),
  }),
  output: z.object({ versionId: z.uuid(), versionNo: z.number().int() }),
  writesTables: ["importProfileMappingVersion", "tenantConnectorMapping"],
  sideEffects: [],
  idempotent: false,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) =>
    service(ctx).activateMapping(input.tenantConnectorId, input.profileId),
});

export const importConnectorList = defineCapability({
  module: "import",
  entityName: "tenantConnector",
  operation: "list",
  kind: "read",
  summary: { en: "List tenant connectors", de: "Tenant-Connectoren auflisten" },
  input: z.object({}),
  output: z.object({ items: z.array(looseRowSchema) }),
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx) => ({
    items: (await service(ctx).listConnectors()) as z.output<typeof looseRowSchema>[],
  }),
});

export const importCapabilities = [
  importBatchList,
  importBatchGet,
  importBatchApprove,
  importBatchPost,
  importBatchUpload,
  importProfileList,
  importProfileCreate,
  importProfileUpdate,
  importProfileMappingsGet,
  importProfileSaveMappings,
  importProfileActivateMapping,
  importConnectorList,
];
