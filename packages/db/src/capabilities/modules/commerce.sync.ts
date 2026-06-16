import { z } from "zod";

import { CommerceSyncService } from "../../services/commerce-sync";
import { defineCapability } from "../core/define";
import { CapabilityError, type ExecutionContext } from "../core/types";

const commerceSyncDlqItemSchema = z.looseObject({
  itemId: z.uuid(),
  runId: z.uuid(),
  salesChannelId: z.uuid(),
  entityType: z.string(),
  internalId: z.uuid(),
  errorMessage: z.string(),
  attemptCount: z.number().int(),
  status: z.string(),
  lastAttemptedAt: z.union([z.date(), z.string()]),
  nextRetryAt: z.union([z.date(), z.string()]).nullable(),
});

const commerceSyncEntitySchema = z.enum(["address", "article"]);
const commerceSyncRunRowSchema = z.looseObject({
  runId: z.uuid(),
  salesChannelId: z.uuid(),
  status: z.string(),
  direction: z.string(),
  mode: z.string(),
  dryRun: z.boolean(),
  totalItems: z.number().int(),
  succeededItems: z.number().int(),
  failedItems: z.number().int(),
});
const commerceSyncStepRowSchema = z.looseObject({
  stepId: z.uuid(),
  runId: z.uuid(),
  entityType: z.string(),
  phase: z.string(),
  status: z.string(),
  plannedItems: z.number().int(),
  succeededItems: z.number().int(),
  failedItems: z.number().int(),
});

function service(ctx: ExecutionContext) {
  return new CommerceSyncService(ctx.tenantId, ctx.userId);
}

function mapServiceError(error: unknown): never {
  if (error instanceof Error) {
    if (/not found/i.test(error.message)) {
      throw new CapabilityError("not_found", error.message);
    }
    if (/only push|unsupported commerce platform/i.test(error.message)) {
      throw new CapabilityError("validation", error.message);
    }
    throw new CapabilityError("conflict", error.message);
  }
  throw error;
}

export const commerceSyncStart = defineCapability({
  module: "commerce",
  entityName: "commerceSyncRun",
  operation: "start",
  kind: "process",
  summary: {
    en: "Start a commerce sync run",
    de: "Shop-Abgleich starten",
  },
  description: {
    en: "Runs the first modular outbound commerce sync slice. V1 supports push sync for addresses and articles.",
    de: "Fuehrt den ersten modularen ausgehenden Shop-Abgleich aus. V1 unterstuetzt Push fuer Adressen und Artikel.",
  },
  input: z.object({
    salesChannelId: z.uuid(),
    direction: z.enum(["push", "pull", "bidirectional"]).default("push"),
    mode: z.enum(["single", "full"]).default("single"),
    entities: z.array(commerceSyncEntitySchema).min(1).default(["article"]),
    dryRun: z.boolean().optional(),
    batchSize: z.number().int().min(1).max(500).optional(),
  }),
  output: z.object({
    run: commerceSyncRunRowSchema,
    steps: z.array(commerceSyncStepRowSchema),
  }),
  writesTables: ["commerceSyncRun", "commerceSyncRunStep", "externalSyncMapping"],
  sideEffects: ["pushes selected entities to the configured commerce platform unless dryRun is true"],
  idempotent: false,
  supportsDryRun: true,
  minRole: "tenant_user",
  exposure: { llm: "confirm", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    try {
      return await service(ctx).start({
        salesChannelId: input.salesChannelId,
        direction: input.direction,
        mode: input.mode,
        entities: input.entities,
        dryRun: input.dryRun ?? ctx.dryRun,
        batchSize: input.batchSize,
      });
    } catch (error) {
      mapServiceError(error);
    }
  },
});

export const commerceSyncGet = defineCapability({
  module: "commerce",
  entityName: "commerceSyncRun",
  operation: "get",
  kind: "read",
  summary: {
    en: "Get a commerce sync run",
    de: "Shop-Abgleich lesen",
  },
  input: z.object({ runId: z.uuid() }),
  output: z.object({
    run: commerceSyncRunRowSchema,
    steps: z.array(commerceSyncStepRowSchema),
  }),
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const result = await service(ctx).get(input.runId);
    if (!result) throw new CapabilityError("not_found", "Commerce sync run not found");
    return result;
  },
});

export const commerceSyncCancel = defineCapability({
  module: "commerce",
  entityName: "commerceSyncRun",
  operation: "cancel",
  kind: "process",
  summary: {
    en: "Cancel a commerce sync run",
    de: "Shop-Abgleich abbrechen",
  },
  input: z.object({ runId: z.uuid() }),
  output: z.object({ run: commerceSyncRunRowSchema }),
  writesTables: ["commerceSyncRun"],
  sideEffects: ["marks the run for cancellation"],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "confirm", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const run = await service(ctx).cancel(input.runId);
    if (!run) throw new CapabilityError("not_found", "Commerce sync run not found");
    return { run };
  },
});

export const commerceSyncDeadLetterList = defineCapability({
  module: "commerce",
  entityName: "commerceSyncDeadLetter",
  operation: "list",
  kind: "read",
  summary: {
    en: "List commerce sync dead letter items",
    de: "Fehlgeschlagene Shop-Sync-Eintraege auflisten",
  },
  description: {
    en: "Returns pending, resolved, or abandoned items from the commerce sync dead letter queue.",
    de: "Gibt ausstehende, aufgeloeste oder aufgegebene Eintraege aus der Shop-Sync-Warteschlange zurueck.",
  },
  input: z.object({
    salesChannelId: z.uuid().optional(),
    status: z.enum(["pending", "resolved", "abandoned"]).optional(),
  }),
  output: z.object({ items: z.array(commerceSyncDlqItemSchema) }),
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    return service(ctx).listDeadLetter(input.salesChannelId, input.status);
  },
});

export const commerceSyncDeadLetterRetry = defineCapability({
  module: "commerce",
  entityName: "commerceSyncDeadLetter",
  operation: "retry",
  kind: "process",
  summary: {
    en: "Retry pending commerce sync dead letter items",
    de: "Fehlgeschlagene Shop-Sync-Eintraege erneut versuchen",
  },
  description: {
    en: "Re-attempts all pending dead letter items whose next_retry_at has passed for a given sales channel.",
    de: "Versucht alle faelligen ausstehenden DLQ-Eintraege fuer einen Verkaufskanal erneut.",
  },
  input: z.object({ salesChannelId: z.uuid() }),
  output: z.object({
    attempted: z.number().int(),
    resolved: z.number().int(),
    stillFailed: z.number().int(),
    abandoned: z.number().int(),
  }),
  writesTables: ["commerceSyncDeadLetter", "externalSyncMapping"],
  sideEffects: ["pushes pending dead letter items to the configured commerce platform"],
  idempotent: false,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "confirm", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    try {
      return await service(ctx).retryDeadLetter(input.salesChannelId);
    } catch (error) {
      mapServiceError(error);
    }
  },
});

export const commerceSyncCapabilities = [
  commerceSyncStart,
  commerceSyncGet,
  commerceSyncCancel,
  commerceSyncDeadLetterList,
  commerceSyncDeadLetterRetry,
];
