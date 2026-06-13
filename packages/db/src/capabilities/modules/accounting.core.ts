import { z } from "zod";

import { DataService } from "../../services/data";
import { AccountingExportService } from "../../services/accounting-export-service";
import { defineCapability } from "../core/define";
import { listInputSchema, listOutputSchema, looseRowSchema, runEntityList } from "../core/list";
import { CapabilityError } from "../core/types";

const idInputSchema = z.object({ id: z.uuid() });

const patchInputSchema = z.object({
  id: z.uuid(),
  patch: z
    .record(z.string(), z.unknown())
    .refine((patch) => Object.keys(patch).length > 0, { message: "patch must not be empty" }),
});

function crud(
  entityName: string,
  tableName: string,
  orderBy: string,
  minRole: "tenant_user" | "tenant_admin" = "tenant_user",
) {
  return {
    list: defineCapability({
      module: "accounting",
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
      minRole,
      exposure: { llm: "safe", http: true },
      schemaVersion: 1,
      handler: async (ctx, input) =>
        runEntityList(ctx.tenantId, tableName, input.filters, input, orderBy),
    }),
    get: defineCapability({
      module: "accounting",
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
      minRole,
      exposure: { llm: "safe", http: true },
      schemaVersion: 1,
      handler: async (ctx, input) => {
        const row = await new DataService(ctx.tenantId).get(tableName, input.id);
        if (!row) throw new CapabilityError("not_found", `${entityName} not found`);
        return row;
      },
    }),
    create: defineCapability({
      module: "accounting",
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
      minRole,
      exposure: { llm: "safe", http: true },
      schemaVersion: 1,
      handler: async (ctx, input) => {
        const [created] = await new DataService(ctx.tenantId).create(tableName, input);
        return created;
      },
    }),
    update: defineCapability({
      module: "accounting",
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
      minRole,
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

const glAccount = crud("glAccount", "glAccount", "accountNo:asc");
const accountDeterminationRule = crud("accountDeterminationRule", "accountDeterminationRule", "postingContext:asc");
const journalEntry = crud("journalEntry", "journalEntry", "postingDate:desc");
const journalLine = crud("journalLine", "journalLine", "createdAt:desc");
const accountingExportRow = crud("accountingExportRow", "accountingExportRow", "createdAt:desc", "tenant_admin");

export const glAccountArchive = defineCapability({
  module: "accounting",
  entityName: "glAccount",
  operation: "archive",
  kind: "archive",
  summary: { en: "Archive a GL account", de: "Sachkonto archivieren" },
  input: z.object({ id: z.uuid() }),
  output: z.object({ id: z.uuid(), archived: z.literal(true) }),
  writesTables: ["glAccount"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "confirm", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const [updated] = await new DataService(ctx.tenantId).patch("glAccount", input.id, { archived: true });
    if (!updated) throw new CapabilityError("not_found", "GL account not found");
    return { id: input.id, archived: true as const };
  },
});

const accountingExportService = new AccountingExportService();

export const accountingExportBatchList = defineCapability({
  module: "accounting",
  entityName: "accountingExportBatch",
  operation: "list",
  kind: "read",
  summary: { en: "List accounting export batches", de: "Buchungsexport-Batches auflisten" },
  input: z.object({ companyId: z.uuid().optional() }),
  output: z.array(looseRowSchema),
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_admin",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => accountingExportService.listBatches(ctx.tenantId, input.companyId),
});

export const accountingExportBatchGet = defineCapability({
  module: "accounting",
  entityName: "accountingExportBatch",
  operation: "get",
  kind: "read",
  summary: { en: "Get an accounting export batch", de: "Buchungsexport-Batch lesen" },
  input: z.object({ batchId: z.uuid() }),
  output: z.object({ batch: looseRowSchema, rows: z.array(looseRowSchema) }),
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_admin",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => accountingExportService.getBatch(ctx.tenantId, input.batchId),
});

export const accountingExportBatchCreate = defineCapability({
  module: "accounting",
  entityName: "accountingExportBatch",
  operation: "createBatch",
  kind: "create",
  summary: { en: "Create an accounting export batch", de: "Buchungsexport-Batch anlegen" },
  input: z.object({
    companyId: z.uuid(),
    fiscalPeriodId: z.uuid(),
    createdBy: z.uuid().optional(),
  }),
  output: z.object({ batchId: z.uuid() }),
  writesTables: ["accountingExportBatch"],
  sideEffects: [],
  idempotent: false,
  supportsDryRun: false,
  minRole: "tenant_admin",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) =>
    accountingExportService.createExportBatch(
      ctx.tenantId,
      input.companyId,
      input.fiscalPeriodId,
      input.createdBy,
    ),
});

export const accountingExportBatchBuildRows = defineCapability({
  module: "accounting",
  entityName: "accountingExportBatch",
  operation: "buildRows",
  kind: "process",
  summary: { en: "Build export rows", de: "Exportzeilen erzeugen" },
  input: z.object({ batchId: z.uuid() }),
  output: z.object({ rowCount: z.number().int() }),
  writesTables: ["accountingExportRow", "accountingExportBatch"],
  sideEffects: ["aggregates journal data into export rows"],
  idempotent: false,
  supportsDryRun: false,
  minRole: "tenant_admin",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => accountingExportService.buildExportRows(ctx.tenantId, input.batchId),
});

export const accountingExportBatchMarkExported = defineCapability({
  module: "accounting",
  entityName: "accountingExportBatch",
  operation: "markExported",
  kind: "process",
  summary: { en: "Mark export batch as exported", de: "Export-Batch als exportiert markieren" },
  input: z.object({ batchId: z.uuid() }),
  output: z.object({ success: z.literal(true) }),
  writesTables: ["accountingExportBatch"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_admin",
  exposure: { llm: "confirm", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    await accountingExportService.markBatchExported(ctx.tenantId, input.batchId);
    return { success: true as const };
  },
});

export const accountingExportBatchRebuild = defineCapability({
  module: "accounting",
  entityName: "accountingExportBatch",
  operation: "rebuild",
  kind: "process",
  summary: { en: "Rebuild export rows", de: "Exportzeilen neu erzeugen" },
  input: z.object({ batchId: z.uuid() }),
  output: z.object({ rowCount: z.number().int() }),
  writesTables: ["accountingExportRow", "accountingExportBatch"],
  sideEffects: ["rebuilds persisted export rows"],
  idempotent: false,
  supportsDryRun: false,
  minRole: "tenant_admin",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => accountingExportService.rebuildBatch(ctx.tenantId, input.batchId),
});

export const accountingExportBatchCsv = defineCapability({
  module: "accounting",
  entityName: "accountingExportBatch",
  operation: "csv",
  kind: "read",
  summary: { en: "Generate export CSV", de: "Export-CSV erzeugen" },
  input: z.object({ batchId: z.uuid() }),
  output: z.string(),
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_admin",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => accountingExportService.generateCsv(ctx.tenantId, input.batchId),
});

export const accountingCapabilities = [
  glAccount.list,
  glAccount.get,
  glAccount.create,
  glAccount.update,
  glAccountArchive,
  accountDeterminationRule.list,
  accountDeterminationRule.get,
  accountDeterminationRule.create,
  accountDeterminationRule.update,
  journalEntry.list,
  journalEntry.get,
  journalEntry.create,
  journalEntry.update,
  journalLine.list,
  journalLine.get,
  journalLine.create,
  journalLine.update,
  accountingExportRow.list,
  accountingExportRow.get,
  accountingExportRow.create,
  accountingExportRow.update,
  accountingExportBatchList,
  accountingExportBatchGet,
  accountingExportBatchCreate,
  accountingExportBatchBuildRows,
  accountingExportBatchMarkExported,
  accountingExportBatchRebuild,
  accountingExportBatchCsv,
];
