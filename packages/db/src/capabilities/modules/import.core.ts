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
    return result as {
      batch: z.output<typeof looseRowSchema>;
      rows: z.output<typeof looseRowSchema>[];
    };
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

export const importBuerowareBootstrap = defineCapability({
  module: "import",
  entityName: "bueroware",
  operation: "bootstrap",
  kind: "create",
  summary: {
    en: "Bootstrap a Büroware mapping from Satzbeschreibung.csv",
    de: "Büroware-Mapping aus Satzbeschreibung.csv erzeugen",
  },
  input: z.object({
    profileId: z.uuid(),
    tenantConnectorId: z.uuid(),
    schemaCsvText: z.string().min(1),
    targetFileName: z.string().min(1),
    delimiter: z.string().length(1).optional(),
  }),
  output: z.object({
    versionId: z.uuid(),
    versionNo: z.number().int(),
    fieldCount: z.number().int(),
  }),
  writesTables: ["importProfileMappingVersion", "importFieldMapping"],
  sideEffects: [],
  idempotent: false,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => service(ctx).bootstrapBuerowareMapping(input),
});

export const importBuerowareQueueFile = defineCapability({
  module: "import",
  entityName: "bueroware",
  operation: "queueFile",
  kind: "create",
  summary: {
    en: "Queue a Büroware SEDB file already stored on disk",
    de: "Bereits gespeicherte Büroware-SEDB-Datei einreihen",
  },
  input: z.object({
    layoutId: z.uuid().optional(),
    profileId: z.uuid().optional(),
    mappingVersionId: z.uuid().optional(),
    sourceFileName: z.string().min(1).optional(),
    filePath: z.string().min(1),
    isDryRun: z.boolean().optional(),
  }),
  output: z.object({
    batchId: z.uuid(),
    status: z.string(),
    needsLayoutSelection: z.boolean().optional(),
  }),
  writesTables: ["importBatch"],
  sideEffects: ["queues a stored import file for asynchronous processing"],
  idempotent: false,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "confirm", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => service(ctx).queueBuerowareFile(input),
});

export const importBuerowareSelectLayout = defineCapability({
  module: "import",
  entityName: "bueroware",
  operation: "selectLayout",
  kind: "update",
  summary: {
    en: "Select the data area (layout) for a pending Büroware batch",
    de: "Datenbereich (Layout) für einen wartenden Büroware-Batch wählen",
  },
  input: z.object({
    batchId: z.uuid(),
    layoutId: z.uuid(),
    profileId: z.uuid().optional(),
    mappingVersionId: z.uuid().optional(),
  }),
  output: z.object({ batchId: z.uuid(), status: z.string() }),
  writesTables: ["importBatch"],
  sideEffects: ["binds a data area and mapping to a batch and queues it"],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "confirm", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => service(ctx).selectBuerowareLayout(input),
});

export const importBuerowareLoadCatalog = defineCapability({
  module: "import",
  entityName: "bueroware",
  operation: "loadCatalog",
  kind: "create",
  summary: {
    en: "Load the central Büroware Satzbeschreibung catalog",
    de: "Zentralen Büroware-Satzbeschreibungskatalog laden",
  },
  description: {
    en: "Parses the whole Satzbeschreibung.csv into the central record-layout/field catalog (one layout per data area) and generates the central default field mapping per layout.",
    de: "Parst die komplette Satzbeschreibung.csv in den zentralen Layout-/Feldkatalog (ein Layout pro Datenbereich) und erzeugt je Layout die zentrale Default-Feldzuweisung.",
  },
  input: z.object({
    schemaCsvText: z.string().min(1),
    delimiter: z.string().length(1).optional(),
  }),
  output: z.object({
    catalogVersion: z.number().int(),
    layouts: z.array(
      z.object({
        layoutId: z.uuid(),
        fileName: z.string(),
        dataArea: z.string(),
        qualifier: z.string().nullable(),
        targetEntity: z.string().nullable(),
        fieldCount: z.number().int(),
        mappedFieldCount: z.number().int(),
      }),
    ),
  }),
  writesTables: [
    "buerowareRecordLayout",
    "buerowareRecordField",
    "importProfileMappingVersion",
    "importFieldMapping",
  ],
  sideEffects: ["replaces the active central Büroware catalog and default mappings"],
  idempotent: false,
  supportsDryRun: false,
  minRole: "tenant_admin",
  exposure: { llm: "hidden", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => service(ctx).loadBuerowareCatalog(input),
});

const layoutSchema = z.object({
  layoutId: z.uuid(),
  fileName: z.string(),
  dataArea: z.string(),
  qualifier: z.string().nullable(),
  defaultTargetEntity: z.string().nullable(),
  catalogVersion: z.number().int(),
  isActive: z.boolean(),
  fieldCount: z.number().int(),
});

export const importBuerowareListLayouts = defineCapability({
  module: "import",
  entityName: "bueroware",
  operation: "listLayouts",
  kind: "read",
  summary: {
    en: "List the data areas (layouts) for a Büroware file",
    de: "Datenbereiche (Layouts) einer Büroware-Datei auflisten",
  },
  input: z.object({ fileName: z.string().min(1) }),
  output: z.object({ items: z.array(layoutSchema) }),
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => ({
    items: (await service(ctx).listLayoutsForFile(input.fileName)) as z.output<
      typeof layoutSchema
    >[],
  }),
});

export const importBuerowareGetLayoutFields = defineCapability({
  module: "import",
  entityName: "bueroware",
  operation: "getLayoutFields",
  kind: "read",
  summary: {
    en: "Get catalog fields and resolved assignment for a layout",
    de: "Katalogfelder und aufgelöste Zuweisung eines Layouts lesen",
  },
  input: z.object({
    layoutId: z.uuid(),
    mappingVersionId: z.uuid().optional(),
    templateProfileId: z.uuid().optional(),
  }),
  output: looseRowSchema,
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) =>
    (await service(ctx).getLayoutFields(input.layoutId, {
      mappingVersionId: input.mappingVersionId,
      templateProfileId: input.templateProfileId,
    })) as z.output<typeof looseRowSchema>,
});

export const importBuerowareListTemplates = defineCapability({
  module: "import",
  entityName: "bueroware",
  operation: "listTemplates",
  kind: "read",
  summary: {
    en: "List tenant import templates for a layout",
    de: "Tenant-Importvorlagen für ein Layout auflisten",
  },
  input: z.object({ layoutId: z.uuid() }),
  output: z.object({ items: z.array(looseRowSchema) }),
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => ({
    items: (await service(ctx).listBuerowareTemplates(input.layoutId)) as z.output<
      typeof looseRowSchema
    >[],
  }),
});

export const importBuerowareSaveTemplate = defineCapability({
  module: "import",
  entityName: "bueroware",
  operation: "saveTemplate",
  kind: "create",
  summary: {
    en: "Save a tenant import template for a layout",
    de: "Tenant-Importvorlage für ein Layout speichern",
  },
  input: z.object({
    layoutId: z.uuid(),
    label: z.string().min(1),
    slug: z.string().min(1).optional(),
    fields: z
      .array(
        z.object({
          buerowareFieldId: z.string().min(1),
          targetField: z.string().min(1),
          targetEntity: z.string().min(1).optional(),
          referenceEntity: z.string().min(1).nullable().optional(),
        }),
      )
      .default([]),
  }),
  output: z.object({
    profileId: z.uuid(),
    versionId: z.uuid(),
    fieldCount: z.number().int(),
  }),
  writesTables: ["importProfile", "importProfileMappingVersion", "importFieldMapping"],
  sideEffects: ["creates or updates a tenant import template"],
  idempotent: false,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => service(ctx).saveBuerowareTemplate(input),
});

export const importBuerowareRunNextJob = defineCapability({
  module: "import",
  entityName: "bueroware",
  operation: "runNextJob",
  kind: "process",
  summary: {
    en: "Run the next queued Büroware import job",
    de: "Nächsten Büroware-Importjob ausführen",
  },
  input: z.object({}),
  output: z.object({
    batchId: z.uuid().optional(),
    status: z.string(),
  }),
  writesTables: ["importBatch", "importRow"],
  sideEffects: ["streams one queued import file into staging rows and validates it"],
  idempotent: false,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "confirm", http: true },
  schemaVersion: 1,
  handler: async (ctx) => {
    const result = await service(ctx).runNextBuerowareImportJob();
    return result ?? { status: "idle" };
  },
});

export const importBuerowareReconcile = defineCapability({
  module: "import",
  entityName: "bueroware",
  operation: "reconcile",
  kind: "process",
  summary: {
    en: "Reconcile pending Büroware import references",
    de: "Offene Büroware-Importreferenzen erneut auflösen",
  },
  input: z.object({}),
  output: z.object({
    posted: z.number().int(),
    failed: z.number().int(),
    pendingReferences: z.number().int(),
  }),
  writesTables: ["importBatch", "importRow"],
  sideEffects: ["posts rows whose missing references can now be resolved"],
  idempotent: false,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "confirm", http: true },
  schemaVersion: 1,
  handler: async (ctx) => service(ctx).reconcilePendingRows(),
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
  summary: {
    en: "Get connector mappings for a profile",
    de: "Connector-Mappings eines Profils lesen",
  },
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
    items: (await service(ctx).getMappings(input.tenantConnectorId, input.profileId)) as z.output<
      typeof looseRowSchema
    >[],
  }),
});

export const importProfileSaveMappings = defineCapability({
  module: "import",
  entityName: "importProfile",
  operation: "saveMappings",
  kind: "update",
  summary: {
    en: "Replace connector mappings for a profile",
    de: "Connector-Mappings eines Profils ersetzen",
  },
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
  summary: {
    en: "Activate the current mapping as a version",
    de: "Aktuelles Mapping als Version aktivieren",
  },
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
  importBuerowareBootstrap,
  importBuerowareQueueFile,
  importBuerowareSelectLayout,
  importBuerowareLoadCatalog,
  importBuerowareListLayouts,
  importBuerowareGetLayoutFields,
  importBuerowareListTemplates,
  importBuerowareSaveTemplate,
  importBuerowareRunNextJob,
  importBuerowareReconcile,
  importProfileList,
  importProfileCreate,
  importProfileUpdate,
  importProfileMappingsGet,
  importProfileSaveMappings,
  importProfileActivateMapping,
  importConnectorList,
];
