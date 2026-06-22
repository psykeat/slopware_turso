import { timingSafeEqual } from "node:crypto";

import { and, db, eq } from "../../index";
import { emailAccount } from "../../schema/sqlite.schema";
import { EmailJobService } from "./job-service";
import { EmailSyncService } from "./sync-service";
import type { EmailProvider } from "./types";

const WEBHOOK_PRIORITY = 1; // webhooks are hot signals

export class EmailWebhookValidationError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "EmailWebhookValidationError";
  }
}

export class EmailWebhookLookupError extends Error {
  constructor(
    message: string,
    public status = 404,
  ) {
    super(message);
    this.name = "EmailWebhookLookupError";
  }
}

function secureEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function normalizeWebhookProvider(provider: EmailProvider | "google" | "microsoft") {
  if (provider === "google") return "gmail" as const;
  if (provider === "microsoft") return "microsoft" as const;
  return provider;
}

export function extractWebhookAccountId(body: Record<string, unknown>) {
  if (typeof body.accountId === "string") return body.accountId;

  const message = body.message;
  if (message && typeof message === "object") {
    const data = (message as Record<string, unknown>).data;
    if (typeof data === "string") {
      try {
        const decoded = JSON.parse(Buffer.from(data, "base64").toString("utf8")) as Record<
          string,
          unknown
        >;
        if (typeof decoded.accountId === "string") return decoded.accountId;
      } catch {
        return null;
      }
    }
  }

  return null;
}

export function validateWebhookSignal(
  request: Request,
  provider: "google" | "microsoft",
  body: Record<string, unknown>,
): { ok: true } | { ok: false; status: number; error: string } {
  const configured =
    provider === "google"
      ? (process.env.GMAIL_WEBHOOK_TOKEN ?? process.env.EMAIL_WEBHOOK_TOKEN)
      : (process.env.MICROSOFT_WEBHOOK_CLIENT_STATE ?? process.env.EMAIL_WEBHOOK_TOKEN);
  if (!configured)
    return { ok: false, status: 501, error: "Webhook validation token is not configured" };

  const headerToken =
    request.headers.get("x-email-webhook-token") ??
    request.headers.get("x-goog-channel-token") ??
    request.headers.get("client-state");

  const bodyToken =
    provider === "microsoft"
      ? typeof body.clientState === "string"
        ? body.clientState
        : Array.isArray(body.value) &&
            body.value[0] &&
            typeof body.value[0] === "object" &&
            typeof (body.value[0] as Record<string, unknown>).clientState === "string"
          ? String((body.value[0] as Record<string, unknown>).clientState)
          : null
      : null;

  const token = headerToken ?? bodyToken;
  if (!token || !secureEquals(token, configured)) {
    return { ok: false, status: 401, error: "Invalid webhook token" };
  }

  return { ok: true };
}

export async function queueWebhookIncrementalSync(
  provider: EmailProvider | "google" | "microsoft",
  body: Record<string, unknown>,
) {
  const normalizedProvider = normalizeWebhookProvider(provider);
  const accountId = extractWebhookAccountId(body);
  if (!accountId) throw new EmailWebhookValidationError("accountId is required");

  const [account] = await db
    .select({
      tenantId: emailAccount.tenantId,
      emailAccountId: emailAccount.emailAccountId,
      provider: emailAccount.provider,
    })
    .from(emailAccount)
    .where(
      and(
        eq(emailAccount.emailAccountId, accountId),
        eq(emailAccount.provider, normalizedProvider),
        eq(emailAccount.archived, false),
      ),
    )
    .limit(1);
  if (!account) throw new EmailWebhookLookupError("Email account not found");

  const now = new Date();
  await db
    .update(emailAccount)
    .set({ activityTier: "hot", lastUserActivityAt: now, updatedAt: now })
    .where(eq(emailAccount.emailAccountId, account.emailAccountId));

  // Bucket into 30-second windows to deduplicate bursts of webhook signals
  // for the same account (e.g. Graph sends one notification per message change).
  const bucket = Math.floor(Date.now() / 30_000);
  const syncService = new EmailSyncService(account.tenantId, "system");
  return await new EmailJobService(account.tenantId, {
    executor: ({ jobType, emailAccountId, payload }) =>
      syncService.executeJob(jobType, emailAccountId, payload),
  }).enqueue({
    jobType: "incremental_sync",
    emailAccountId: account.emailAccountId,
    idempotencyKey: `webhook:${provider}:${account.emailAccountId}:${bucket}`,
    payload: { provider },
    priority: WEBHOOK_PRIORITY,
  });
}
