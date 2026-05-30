import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { and, eq } from "drizzle-orm";

import "./load-env";
import { desc } from "drizzle-orm";

import { db } from "../index";
import { emailAccount, emailAccountUserGrant } from "../schema/app.schema";
import { encryptEmailCredentials } from "../services/email/credential-crypto";
import { GraphProviderAdapter } from "../services/email/graph-provider-adapter";
import { EmailJobService } from "../services/email/job-service";
import { EmailSyncService } from "../services/email/sync-service";
import {
  extractWebhookAccountId,
  queueWebhookIncrementalSync,
  validateWebhookSignal,
} from "../services/email/webhook";

type SmokeAccount = {
  tenantId: string;
  userId: string;
  emailAccountId: string;
  provider: "gmail" | "microsoft";
  primaryEmail: string;
};

type AccountSnapshot = {
  credentialsEncrypted: string;
  status: string;
  lastSyncStatus: string;
  lastSyncError: string | null;
  watchExpiresAt: Date | null;
  updatedAt: Date | null;
};

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../");

function ensure(condition: unknown, message: string): asserts condition {
  assert.ok(condition, message);
}

function log(step: string, details?: unknown) {
  if (details === undefined) {
    console.log(step);
    return;
  }
  console.log(`${step}:`, typeof details === "string" ? details : JSON.stringify(details, null, 2));
}

async function resolveAccountContext(): Promise<SmokeAccount> {
  const rows = await db
    .select({
      tenantId: emailAccount.tenantId,
      userId: emailAccountUserGrant.userId,
      emailAccountId: emailAccount.emailAccountId,
      provider: emailAccount.provider,
      primaryEmail: emailAccount.primaryEmail,
    })
    .from(emailAccount)
    .innerJoin(
      emailAccountUserGrant,
      and(
        eq(emailAccountUserGrant.tenantId, emailAccount.tenantId),
        eq(emailAccountUserGrant.emailAccountId, emailAccount.emailAccountId),
      ),
    )
    .where(
      and(
        eq(emailAccount.archived, false),
        eq(emailAccount.provider, "gmail"),
        eq(emailAccountUserGrant.canRead, true),
      ),
    )
    .orderBy(desc(emailAccount.createdAt))
    .limit(1);
  const row = rows[0];
  ensure(row, "No Gmail account was found for resilience verification");
  ensure(Boolean(row.userId), "Email account grant is missing a user");
  return row as SmokeAccount;
}

async function loadAccountSnapshot(accountId: string): Promise<AccountSnapshot> {
  const rows = await db
    .select({
      credentialsEncrypted: emailAccount.credentialsEncrypted,
      status: emailAccount.status,
      lastSyncStatus: emailAccount.lastSyncStatus,
      lastSyncError: emailAccount.lastSyncError,
      watchExpiresAt: emailAccount.watchExpiresAt,
      updatedAt: emailAccount.updatedAt,
    })
    .from(emailAccount)
    .where(eq(emailAccount.emailAccountId, accountId))
    .limit(1);
  const row = rows[0];
  ensure(row, "Unable to load Gmail account snapshot");
  return row;
}

async function restoreAccount(accountId: string, snapshot: AccountSnapshot) {
  await db
    .update(emailAccount)
    .set({
      credentialsEncrypted: snapshot.credentialsEncrypted,
      status: snapshot.status,
      lastSyncStatus: snapshot.lastSyncStatus,
      lastSyncError: snapshot.lastSyncError,
      watchExpiresAt: snapshot.watchExpiresAt,
      updatedAt: snapshot.updatedAt ?? new Date(),
    })
    .where(eq(emailAccount.emailAccountId, accountId));
}

async function withMockFetch<T>(
  implementation: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  run: () => Promise<T>,
) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = implementation as typeof fetch;
  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function main() {
  process.chdir(repoRoot);

  const account = await resolveAccountContext();
  const syncService = new EmailSyncService(account.tenantId, account.userId);
  const jobService = new EmailJobService(account.tenantId);
  const snapshot = await loadAccountSnapshot(account.emailAccountId);
  const previousTopic = process.env.GMAIL_PUBSUB_TOPIC;

  try {
    log("Selected account", {
      tenantId: account.tenantId,
      emailAccountId: account.emailAccountId,
      provider: account.provider,
      primaryEmail: account.primaryEmail,
    });

    log("Webhook", "validate and queue");
    const webhookBody = { accountId: account.emailAccountId };
    const webhookRequest = new Request("https://example.invalid/api/email/webhooks/google", {
      method: "POST",
      headers: {
        "x-email-webhook-token":
          process.env.GMAIL_WEBHOOK_TOKEN ?? process.env.EMAIL_WEBHOOK_TOKEN ?? "",
      },
      body: JSON.stringify(webhookBody),
    });
    ensure(
      validateWebhookSignal(webhookRequest, "google", webhookBody).ok,
      "Webhook validation rejected a valid Gmail token",
    );
    ensure(
      !validateWebhookSignal(
        new Request("https://example.invalid/api/email/webhooks/google", {
          method: "POST",
          headers: { "x-email-webhook-token": "invalid" },
          body: JSON.stringify(webhookBody),
        }),
        "google",
        webhookBody,
      ).ok,
      "Webhook validation accepted an invalid Gmail token",
    );
    ensure(
      extractWebhookAccountId(webhookBody) === account.emailAccountId,
      "Webhook account extraction failed for plain body",
    );
    const queuedWebhookJob = await queueWebhookIncrementalSync("google", webhookBody);
    const storedWebhookJob = await jobService.get(queuedWebhookJob.emailJobId);
    ensure(
      storedWebhookJob?.jobType === "incremental_sync",
      "Webhook queue did not create an incremental sync job",
    );
    ensure(
      storedWebhookJob?.status === "queued",
      "Webhook queue did not persist the queued status",
    );
    ensure(
      storedWebhookJob?.attempts === 0,
      "Webhook queue should not increment attempts before execution",
    );

    const microsoftWebhookBody = {
      value: [
        {
          accountId: account.emailAccountId,
          clientState:
            process.env.MICROSOFT_WEBHOOK_CLIENT_STATE ?? process.env.EMAIL_WEBHOOK_TOKEN,
        },
      ],
    };
    const microsoftWebhookRequest = new Request(
      "https://example.invalid/api/email/webhooks/microsoft",
      {
        method: "POST",
        headers: {
          "client-state":
            process.env.MICROSOFT_WEBHOOK_CLIENT_STATE ?? process.env.EMAIL_WEBHOOK_TOKEN ?? "",
        },
        body: JSON.stringify(microsoftWebhookBody),
      },
    );
    ensure(
      validateWebhookSignal(microsoftWebhookRequest, "microsoft", microsoftWebhookBody).ok,
      "Webhook validation rejected a valid Microsoft token",
    );
    ensure(
      !validateWebhookSignal(
        new Request("https://example.invalid/api/email/webhooks/microsoft", {
          method: "POST",
          headers: { "client-state": "invalid" },
          body: JSON.stringify(microsoftWebhookBody),
        }),
        "microsoft",
        microsoftWebhookBody,
      ).ok,
      "Webhook validation accepted an invalid Microsoft token",
    );
    ensure(
      extractWebhookAccountId(microsoftWebhookBody) === account.emailAccountId,
      "Webhook account extraction failed for Graph-style body",
    );

    log("Watch", "gmail renewal");
    const gmailWatchCreds = encryptEmailCredentials({
      provider: "gmail",
      token: {
        access_token: "watch-access-token",
        refresh_token: "watch-refresh-token",
        token_type: "Bearer",
      },
      obtainedAt: new Date().toISOString(),
    });
    await db
      .update(emailAccount)
      .set({
        credentialsEncrypted: gmailWatchCreds,
        watchExpiresAt: null,
        status: "connected",
        lastSyncStatus: "idle",
        lastSyncError: null,
        updatedAt: new Date(),
      })
      .where(eq(emailAccount.emailAccountId, account.emailAccountId));

    process.env.GMAIL_PUBSUB_TOPIC =
      process.env.GMAIL_PUBSUB_TOPIC ?? "projects/slopware/topics/mail-smoke";
    const watchJob = await syncService.queueAccountJob(account.emailAccountId, "watch_renewal", {
      callbackUrl: "https://example.invalid/api/email/webhooks/google",
    });
    await withMockFetch(
      async (input, init) => {
        const url =
          typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        if (url.includes("/gmail/v1/users/me/watch")) {
          const body = init?.body ? JSON.parse(String(init.body)) : {};
          ensure(
            body.topicName === process.env.GMAIL_PUBSUB_TOPIC,
            "Gmail watch did not use the configured topic",
          );
          return new Response(JSON.stringify({ expiration: String(Date.now() + 3_600_000) }), {
            status: 200,
          });
        }
        return new Response("Unexpected fetch", { status: 500 });
      },
      async () => {
        await syncService.runJob(watchJob.emailJobId);
      },
    );

    const watchedAccount = await loadAccountSnapshot(account.emailAccountId);
    ensure(
      Boolean(watchedAccount.watchExpiresAt),
      "Gmail watch renewal did not update watchExpiresAt",
    );
    const watchJobState = await jobService.get(watchJob.emailJobId);
    ensure(watchJobState?.status === "done", "Gmail watch renewal job did not complete");

    log("Watch", "graph renewal");
    const graphAdapter = new GraphProviderAdapter();
    const graphCreds = encryptEmailCredentials({
      provider: "microsoft",
      primaryEmail: account.primaryEmail,
      token: {
        access_token: "graph-access-token",
        refresh_token: "graph-refresh-token",
        token_type: "Bearer",
      },
      obtainedAt: new Date().toISOString(),
    });
    await withMockFetch(
      async (input, init) => {
        const url =
          typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        if (url.includes("/subscriptions")) {
          const body = init?.body ? JSON.parse(String(init.body)) : {};
          ensure(
            body.clientState ===
              (process.env.MICROSOFT_WEBHOOK_CLIENT_STATE ?? process.env.EMAIL_WEBHOOK_TOKEN),
            "Graph watch did not use the configured client state",
          );
          return new Response(JSON.stringify({ id: "subscription-id" }), { status: 201 });
        }
        return new Response("Unexpected fetch", { status: 500 });
      },
      async () => {
        const result = await graphAdapter.renewWatch(
          graphCreds,
          "https://example.invalid/api/email/webhooks/microsoft",
        );
        ensure(result.expiresAt instanceof Date, "Graph watch did not return an expiry date");
      },
    );

    log("Reauth", "forced refresh failure");
    const reauthCreds = encryptEmailCredentials({
      provider: "gmail",
      token: {
        token_type: "Bearer",
      },
      obtainedAt: new Date().toISOString(),
    });
    await db
      .update(emailAccount)
      .set({
        credentialsEncrypted: reauthCreds,
        status: "connected",
        lastSyncStatus: "idle",
        lastSyncError: null,
        updatedAt: new Date(),
      })
      .where(eq(emailAccount.emailAccountId, account.emailAccountId));

    const reauthJob = await syncService.queueAccountJob(account.emailAccountId, "incremental_sync");
    let reauthError: unknown = null;
    try {
      await withMockFetch(
        async () => new Response("Unexpected fetch", { status: 500 }),
        async () => {
          await syncService.runJob(reauthJob.emailJobId);
        },
      );
    } catch (error) {
      reauthError = error;
    }
    ensure(reauthError instanceof Error, "Reauth flow did not throw an error");
    const reauthJobState = await jobService.get(reauthJob.emailJobId);
    ensure(reauthJobState?.status === "failed", "Reauth job did not transition to failed");
    ensure(reauthJobState?.attempts === 1, "Reauth job did not claim exactly once");
    ensure(Boolean(reauthJobState?.lastError), "Reauth job did not persist its failure reason");
    const reauthAccount = await loadAccountSnapshot(account.emailAccountId);
    ensure(
      reauthAccount.status === "reauth_required",
      "Reauth flow did not mark the account correctly",
    );
    ensure(
      reauthAccount.lastSyncStatus === "error",
      "Reauth flow did not persist the error status",
    );

    console.log(
      JSON.stringify(
        {
          account,
          webhookJobId: queuedWebhookJob.emailJobId,
          webhookJobStatus: storedWebhookJob?.status ?? null,
          gmailWatchExpiresAt: watchedAccount.watchExpiresAt,
          graphWatchExpiresAt: "ok",
          reauthStatus: reauthAccount.status,
          reauthJobStatus: reauthJobState?.status ?? null,
        },
        null,
        2,
      ),
    );
    process.exit(0);
  } finally {
    if (previousTopic === undefined) {
      delete process.env.GMAIL_PUBSUB_TOPIC;
    } else {
      process.env.GMAIL_PUBSUB_TOPIC = previousTopic;
    }
    await restoreAccount(account.emailAccountId, snapshot);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
