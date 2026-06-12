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

export const importCapabilities = [
  importBatchList,
  importBatchGet,
  importBatchApprove,
  importBatchPost,
];
