import "@tanstack/react-start/server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { and, asc, desc, eq, isNull, lte, or } from "drizzle-orm";

import { db } from "../index";
import { commerceWebhookEvent, salesChannel } from "../schema/app.schema";
import {
  CommerceSyncService,
  Shopware6Adapter,
  type CommerceSyncAdapter,
  type SalesChannelConfig,
} from "./commerce-sync";
import { decryptSecret } from "./secret-crypto";

/** Raised when a webhook delivery cannot be matched to a known sales channel. */
export class CommerceWebhookLookupError extends Error {
  constructor(
    message: string,
    public status = 404,
  ) {
    super(message);
    this.name = "CommerceWebhookLookupError";
  }
}

/** Raised when a webhook body is malformed or its signature is invalid. */
export class CommerceWebhookValidationError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "CommerceWebhookValidationError";
  }
}

/**
 * Events we subscribe to in the Shopware App-System. `checkout.order.placed`
 * triggers an inbound order import; the others are acknowledged but not yet
 * acted on (stock and customer master flow ERP -> shop, not the reverse).
 */
const ORDER_PLACED_EVENT = "checkout.order.placed";
const ACKNOWLEDGED_EVENTS = new Set(["product.stock.changed", "customer.register"]);

const MAX_ATTEMPTS = 5;
const RETRY_BASE_MS = 60_000;
const RETRY_CAP_MS = 30 * 60_000;

function backoffUntil(attemptCount: number): Date {
  const delay = Math.min(RETRY_BASE_MS * 2 ** Math.max(0, attemptCount - 1), RETRY_CAP_MS);
  return new Date(Date.now() + delay);
}

/** Normalize an API/shop URL for equality comparison (drop trailing slash, lowercase host). */
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}${u.pathname.replace(/\/$/, "")}`.toLowerCase();
  } catch {
    return url.replace(/\/$/, "").toLowerCase();
  }
}

/** HMAC-SHA256 hex of the raw body keyed by the app secret, compared in constant time. */
export function verifyShopwareSignature(
  rawBody: string,
  signature: string | null | undefined,
  appSecret: string,
): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

interface ParsedShopwareWebhook {
  shopUrl: string | null;
  eventName: string;
  payload: Record<string, unknown>;
}

/**
 * Flatten the Shopware App-System webhook envelope:
 * `{ source: { url }, data: { event, payload }, timestamp }`.
 */
export function parseShopwareWebhook(rawBody: string): ParsedShopwareWebhook {
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    throw new CommerceWebhookValidationError("Webhook body must be valid JSON");
  }
  const source =
    body.source && typeof body.source === "object" ? (body.source as Record<string, unknown>) : {};
  const data =
    body.data && typeof body.data === "object" ? (body.data as Record<string, unknown>) : {};
  const eventName =
    typeof data.event === "string"
      ? data.event
      : typeof body.event === "string"
        ? body.event
        : "";
  if (!eventName) throw new CommerceWebhookValidationError("Webhook is missing an event name");
  const payload =
    data.payload && typeof data.payload === "object"
      ? (data.payload as Record<string, unknown>)
      : {};
  return {
    shopUrl: typeof source.url === "string" ? source.url : null,
    eventName,
    payload,
  };
}

export interface WebhookChannelCandidate {
  tenantId: string;
  channel: SalesChannelConfig;
  appSecret: string;
}

/**
 * Cross-tenant lookup: every active Shopware channel whose `apiUrl` matches the
 * incoming `source.url` and that has a webhook app secret configured. The route
 * is unauthenticated, so the shop URL is the only routing key we have — and a
 * single URL can map to several channels (e.g. multiple tenants on one shop), so
 * the caller disambiguates by which secret verifies the signature.
 */
export async function findWebhookChannelCandidates(
  shopUrl: string | null,
): Promise<WebhookChannelCandidate[]> {
  if (!shopUrl) throw new CommerceWebhookLookupError("Webhook is missing source.url");
  const target = normalizeUrl(shopUrl);
  const rows = await db
    .select()
    .from(salesChannel)
    .where(and(eq(salesChannel.platform, "shopware6"), eq(salesChannel.isActive, true)));

  const candidates: WebhookChannelCandidate[] = [];
  for (const row of rows) {
    if (normalizeUrl(row.apiUrl) !== target) continue;
    const credentials =
      row.credentials && typeof row.credentials === "object"
        ? (row.credentials as Record<string, unknown>)
        : {};
    const rawSecret = credentials.appSecret ?? credentials.app_secret;
    if (typeof rawSecret !== "string" || !rawSecret) continue;
    candidates.push({
      tenantId: row.tenantId,
      appSecret: decryptSecret(rawSecret),
      channel: {
        salesChannelId: row.salesChannelId,
        platform: row.platform,
        apiUrl: row.apiUrl,
        credentials: row.credentials,
      },
    });
  }
  return candidates;
}

export interface WebhookIngestResult {
  tenantId: string;
  salesChannelId: string;
  eventId: string | null;
  eventName: string;
  duplicate: boolean;
}

/**
 * Validate and durably persist a Shopware webhook delivery. Pure ingestion: it
 * resolves the channel by shop URL, verifies the signature with that channel's
 * app secret, and inserts a pending event row (deduplicated on the signature so
 * Shopware redeliveries are idempotent). Processing is a separate step.
 */
export async function ingestShopwareWebhook(input: {
  rawBody: string;
  signature: string | null | undefined;
}): Promise<WebhookIngestResult> {
  const parsed = parseShopwareWebhook(input.rawBody);
  const candidates = await findWebhookChannelCandidates(parsed.shopUrl);
  if (candidates.length === 0) {
    throw new CommerceWebhookLookupError(
      `No active sales channel with a webhook secret for shop ${parsed.shopUrl}`,
    );
  }

  // The signature both authenticates the delivery and selects the channel when
  // several share a shop URL.
  const resolved = candidates.find((candidate) =>
    verifyShopwareSignature(input.rawBody, input.signature, candidate.appSecret),
  );
  if (!resolved) {
    throw new CommerceWebhookValidationError("Invalid webhook signature", 401);
  }

  const [inserted] = await db
    .insert(commerceWebhookEvent)
    .values({
      tenantId: resolved.tenantId,
      salesChannelId: resolved.channel.salesChannelId,
      eventName: parsed.eventName,
      dedupeKey: input.signature as string,
      payload: parsed.payload,
      status: "pending",
    })
    .onConflictDoNothing({
      target: [
        commerceWebhookEvent.tenantId,
        commerceWebhookEvent.salesChannelId,
        commerceWebhookEvent.dedupeKey,
      ],
    })
    .returning({ eventId: commerceWebhookEvent.eventId });

  return {
    tenantId: resolved.tenantId,
    salesChannelId: resolved.channel.salesChannelId,
    eventId: inserted?.eventId ?? null,
    eventName: parsed.eventName,
    duplicate: !inserted,
  };
}

export interface WebhookProcessResult {
  processed: number;
  ignored: number;
  failed: number;
  attempted: number;
}

export class CommerceWebhookService {
  constructor(
    private readonly tenantId: string,
    private readonly userId: string | null = null,
    private readonly adapterFactory: (channel: SalesChannelConfig) => CommerceSyncAdapter = () =>
      new Shopware6Adapter(),
  ) {}

  /** Drain pending (and due-for-retry) events for a channel, handling each by type. */
  async processPending(salesChannelId: string, limit = 50): Promise<WebhookProcessResult> {
    const now = new Date();
    const events = await db
      .select()
      .from(commerceWebhookEvent)
      .where(
        and(
          eq(commerceWebhookEvent.tenantId, this.tenantId),
          eq(commerceWebhookEvent.salesChannelId, salesChannelId),
          eq(commerceWebhookEvent.status, "pending"),
          or(
            isNull(commerceWebhookEvent.nextRetryAt),
            lte(commerceWebhookEvent.nextRetryAt, now),
          ),
        ),
      )
      .orderBy(asc(commerceWebhookEvent.receivedAt))
      .limit(limit);

    let processed = 0;
    let ignored = 0;
    let failed = 0;

    for (const event of events) {
      try {
        const outcome = await this.handleEvent(salesChannelId, event.eventName);
        await db
          .update(commerceWebhookEvent)
          .set({
            status: outcome,
            attemptCount: event.attemptCount + 1,
            errorMessage: null,
            nextRetryAt: null,
            processedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(commerceWebhookEvent.eventId, event.eventId));
        if (outcome === "ignored") ignored++;
        else processed++;
      } catch (error) {
        failed++;
        const attemptCount = event.attemptCount + 1;
        const message = error instanceof Error ? error.message : "Unknown webhook error";
        const exhausted = attemptCount >= MAX_ATTEMPTS;
        await db
          .update(commerceWebhookEvent)
          .set({
            status: exhausted ? "failed" : "pending",
            attemptCount,
            errorMessage: message,
            nextRetryAt: exhausted ? null : backoffUntil(attemptCount),
            updatedAt: new Date(),
          })
          .where(eq(commerceWebhookEvent.eventId, event.eventId));
      }
    }

    return { processed, ignored, failed, attempted: events.length };
  }

  /**
   * Map an event type to an action. `checkout.order.placed` triggers an inbound
   * order import (delta-based + idempotent, so re-running is safe). Other
   * subscribed events are acknowledged without action for now.
   */
  private async handleEvent(
    salesChannelId: string,
    eventName: string,
  ): Promise<"processed" | "ignored"> {
    if (eventName === ORDER_PLACED_EVENT) {
      const sync = new CommerceSyncService(this.tenantId, this.userId, this.adapterFactory);
      await sync.start({
        salesChannelId,
        direction: "pull",
        mode: "single",
        entities: ["document"],
      });
      return "processed";
    }
    if (ACKNOWLEDGED_EVENTS.has(eventName)) return "ignored";
    // Unknown event: acknowledge so it does not retry forever.
    return "ignored";
  }

  /** Recent webhook events for monitoring, newest first. */
  async listEvents(input: {
    salesChannelId?: string;
    status?: "pending" | "processing" | "processed" | "ignored" | "failed";
    limit?: number;
  }) {
    const conditions = [eq(commerceWebhookEvent.tenantId, this.tenantId)];
    if (input.salesChannelId) {
      conditions.push(eq(commerceWebhookEvent.salesChannelId, input.salesChannelId));
    }
    if (input.status) conditions.push(eq(commerceWebhookEvent.status, input.status));

    const rows = await db
      .select()
      .from(commerceWebhookEvent)
      .where(and(...conditions))
      .orderBy(desc(commerceWebhookEvent.receivedAt))
      .limit(Math.min(input.limit ?? 100, 500));
    return { events: rows };
  }
}
