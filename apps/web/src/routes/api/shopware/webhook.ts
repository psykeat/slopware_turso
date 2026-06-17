import {
  CommerceWebhookLookupError,
  CommerceWebhookService,
  CommerceWebhookValidationError,
  ingestShopwareWebhook,
} from "@repo/db/services/commerce-webhook";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/shopware/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => handleWebhook(request),
    },
  },
});

function json(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("content-type", "application/json");
  return new Response(JSON.stringify(data), { ...init, headers });
}

function jsonError(status: number, message: string) {
  return json({ error: { message } }, { status });
}

/**
 * Shopware App-System webhook receiver. Mirrors the email webhook pattern:
 * verify the signature, durably enqueue the event, then best-effort drain the
 * queue. Ingestion is the reliable step — Shopware redeliveries are
 * deduplicated, and processing failures are retried from the queue, so we still
 * answer 200 once an event is safely persisted.
 */
async function handleWebhook(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("shopware-shop-signature");

  let result;
  try {
    result = await ingestShopwareWebhook({ rawBody, signature });
  } catch (error) {
    if (
      error instanceof CommerceWebhookValidationError ||
      error instanceof CommerceWebhookLookupError
    ) {
      return jsonError(error.status, error.message);
    }
    throw error;
  }

  // Best-effort synchronous drain. Any failure here is recorded on the event row
  // (with retry backoff), so it does not affect the acknowledgement we send back.
  try {
    await new CommerceWebhookService(result.tenantId).processPending(result.salesChannelId);
  } catch (error) {
    console.error("Shopware webhook processing failed:", error);
  }

  return json({ ok: true, event: result.eventName, duplicate: result.duplicate });
}
