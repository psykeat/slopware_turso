import { z } from "zod";

import { CommerceWebhookService } from "../../services/commerce-webhook";
import { defineCapability } from "../core/define";
import { type ExecutionContext } from "../core/types";

const webhookEventStatusSchema = z.enum([
  "pending",
  "processing",
  "processed",
  "ignored",
  "failed",
]);

const webhookEventRowSchema = z.looseObject({
  eventId: z.uuid(),
  salesChannelId: z.uuid(),
  eventName: z.string(),
  status: webhookEventStatusSchema,
  attemptCount: z.number().int(),
  errorMessage: z.string().nullable(),
  receivedAt: z.union([z.date(), z.string()]),
  processedAt: z.union([z.date(), z.string()]).nullable(),
});

function service(ctx: ExecutionContext) {
  return new CommerceWebhookService(ctx.tenantId, ctx.userId);
}

export const commerceWebhookEventList = defineCapability({
  module: "commerce",
  entityName: "commerceWebhookEvent",
  operation: "list",
  kind: "read",
  summary: {
    en: "List inbound shop webhook events",
    de: "Eingehende Shop-Webhook-Ereignisse auflisten",
  },
  description: {
    en: "Returns recent inbound webhook events (e.g. Shopware App-System), newest first, optionally filtered by sales channel and status.",
    de: "Gibt die letzten eingehenden Webhook-Ereignisse (z. B. Shopware App-System) zurueck, neueste zuerst, optional gefiltert nach Verkaufskanal und Status.",
  },
  input: z.object({
    salesChannelId: z.uuid().optional(),
    status: webhookEventStatusSchema.optional(),
    limit: z.number().int().min(1).max(500).optional(),
  }),
  output: z.object({ events: z.array(webhookEventRowSchema) }),
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    return service(ctx).listEvents(input);
  },
});

export const commerceWebhookEventProcess = defineCapability({
  module: "commerce",
  entityName: "commerceWebhookEvent",
  operation: "process",
  kind: "process",
  summary: {
    en: "Process pending shop webhook events",
    de: "Ausstehende Shop-Webhook-Ereignisse verarbeiten",
  },
  description: {
    en: "Drains pending (and due-for-retry) webhook events for a sales channel. checkout.order.placed triggers an inbound order import; other subscribed events are acknowledged.",
    de: "Verarbeitet ausstehende (und faellige) Webhook-Ereignisse fuer einen Verkaufskanal. checkout.order.placed loest einen Bestell-Import aus; andere abonnierte Ereignisse werden bestaetigt.",
  },
  input: z.object({ salesChannelId: z.uuid(), limit: z.number().int().min(1).max(200).optional() }),
  output: z.object({
    processed: z.number().int(),
    ignored: z.number().int(),
    failed: z.number().int(),
    attempted: z.number().int(),
  }),
  writesTables: ["commerceWebhookEvent", "commerceSyncRun", "commerceSyncRunStep", "externalSyncMapping"],
  sideEffects: ["may pull orders from the configured commerce platform"],
  idempotent: false,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "confirm", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    return service(ctx).processPending(input.salesChannelId, input.limit);
  },
});

export const commerceWebhookCapabilities = [
  commerceWebhookEventList,
  commerceWebhookEventProcess,
];
