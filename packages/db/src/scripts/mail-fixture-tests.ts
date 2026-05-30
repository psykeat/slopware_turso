import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import "./load-env";
import { and, desc, eq, isNotNull, inArray } from "drizzle-orm";

import { db } from "../index";
import {
  emailAccount,
  emailAccountUserGrant,
  emailAttachment,
  emailIdentity,
  emailJob,
  emailLabel,
  emailMessage,
  emailMessageLabel,
  emailOutbox,
  emailSyncState,
  emailThread,
} from "../schema/app.schema";
import { EmailAccountService } from "../services/email/account-service";
import { encryptEmailCredentials } from "../services/email/credential-crypto";
import { GmailProviderAdapter } from "../services/email/gmail-provider-adapter";
import { GraphProviderAdapter } from "../services/email/graph-provider-adapter";
import { buildMimeMessage } from "../services/email/mime";
import { ProviderReauthRequiredError } from "../services/email/provider-adapter";
import { EmailSendService } from "../services/email/send-service";
import { EmailSyncService } from "../services/email/sync-service";
import { validateWebhookSignal } from "../services/email/webhook";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../");

function ensure(condition: unknown, message: string): asserts condition {
  assert.ok(condition, message);
}

async function withMockFetch<T>(
  handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  run: () => Promise<T>,
) {
  const original = globalThis.fetch;
  globalThis.fetch = handler as typeof fetch;
  try {
    return await run();
  } finally {
    globalThis.fetch = original;
  }
}

function gmailCredentials(accessToken = "gmail-access-token") {
  return encryptEmailCredentials({
    provider: "gmail",
    primaryEmail: "sender@example.com",
    token: {
      access_token: accessToken,
      refresh_token: "gmail-refresh-token",
      token_type: "Bearer",
    },
    obtainedAt: new Date().toISOString(),
  });
}

function graphCredentials(primaryEmail = "sender@example.com", accessToken = "graph-access-token") {
  return encryptEmailCredentials({
    provider: "microsoft",
    primaryEmail,
    token: {
      access_token: accessToken,
      refresh_token: "graph-refresh-token",
      token_type: "Bearer",
    },
    obtainedAt: new Date().toISOString(),
  });
}

async function createAttachmentFixture() {
  const storageKey = "storage/tenant-fixtures/mail-fixture/fixture.txt";
  const path = join(repoRoot, storageKey);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, "fixture attachment\n", "utf8");
  return storageKey;
}

async function createGraphFixtureAccount(context: { tenantId: string; userId: string }) {
  const primaryEmail = `graph-fixture-${randomUUID()}@example.com`;
  const providerAccountId = `graph-fixture-${randomUUID()}`;
  const accountId = randomUUID();
  const identityId = randomUUID();
  await db.insert(emailAccount).values({
    emailAccountId: accountId,
    tenantId: context.tenantId,
    provider: "microsoft",
    providerAccountId,
    displayName: "Graph Fixture",
    primaryEmail,
    status: "connected",
    credentialsEncrypted: graphCredentials(primaryEmail),
    scopes: ["offline_access", "User.Read", "Mail.ReadWrite", "Mail.Send"],
    lastSyncStatus: "idle",
  });
  await db.insert(emailAccountUserGrant).values({
    tenantId: context.tenantId,
    emailAccountId: accountId,
    userId: context.userId,
    canRead: true,
    canSend: true,
    canManage: true,
  });
  await db.insert(emailIdentity).values({
    emailIdentityId: identityId,
    tenantId: context.tenantId,
    emailAccountId: accountId,
    email: primaryEmail,
    displayName: "Graph Fixture",
    providerIdentityId: primaryEmail,
    isPrimary: true,
    canSend: true,
  });
  return {
    emailAccountId: accountId,
    emailIdentityId: identityId,
    primaryEmail,
    providerAccountId,
    cleanup: async () => {
      const messageIds = await db
        .select({ emailMessageId: emailMessage.emailMessageId })
        .from(emailMessage)
        .where(eq(emailMessage.emailAccountId, accountId));
      const ids = messageIds.map((row) => row.emailMessageId);
      if (ids.length > 0) {
        await db
          .delete(emailMessageLabel)
          .where(
            and(
              eq(emailMessageLabel.tenantId, context.tenantId),
              inArray(emailMessageLabel.emailMessageId, ids),
            ),
          );
        await db
          .delete(emailAttachment)
          .where(
            and(
              eq(emailAttachment.tenantId, context.tenantId),
              inArray(emailAttachment.emailMessageId, ids),
            ),
          );
      }
      await db
        .delete(emailJob)
        .where(
          and(eq(emailJob.tenantId, context.tenantId), eq(emailJob.emailAccountId, accountId)),
        );
      await db
        .delete(emailSyncState)
        .where(
          and(
            eq(emailSyncState.tenantId, context.tenantId),
            eq(emailSyncState.emailAccountId, accountId),
          ),
        );
      await db
        .delete(emailOutbox)
        .where(
          and(
            eq(emailOutbox.tenantId, context.tenantId),
            eq(emailOutbox.emailAccountId, accountId),
          ),
        );
      await db
        .delete(emailMessage)
        .where(
          and(
            eq(emailMessage.tenantId, context.tenantId),
            eq(emailMessage.emailAccountId, accountId),
          ),
        );
      await db
        .delete(emailThread)
        .where(
          and(
            eq(emailThread.tenantId, context.tenantId),
            eq(emailThread.emailAccountId, accountId),
          ),
        );
      await db
        .delete(emailLabel)
        .where(
          and(eq(emailLabel.tenantId, context.tenantId), eq(emailLabel.emailAccountId, accountId)),
        );
      await db
        .delete(emailIdentity)
        .where(
          and(
            eq(emailIdentity.tenantId, context.tenantId),
            eq(emailIdentity.emailAccountId, accountId),
          ),
        );
      await db
        .delete(emailAccountUserGrant)
        .where(
          and(
            eq(emailAccountUserGrant.tenantId, context.tenantId),
            eq(emailAccountUserGrant.emailAccountId, accountId),
          ),
        );
      await db
        .delete(emailAccount)
        .where(
          and(
            eq(emailAccount.tenantId, context.tenantId),
            eq(emailAccount.emailAccountId, accountId),
          ),
        );
    },
  };
}

async function resolveMailContext() {
  const rows = await db
    .select({
      tenantId: emailAccount.tenantId,
      userId: emailAccountUserGrant.userId,
    })
    .from(emailAccount)
    .innerJoin(
      emailAccountUserGrant,
      and(
        eq(emailAccountUserGrant.tenantId, emailAccount.tenantId),
        eq(emailAccountUserGrant.emailAccountId, emailAccount.emailAccountId),
      ),
    )
    .where(and(eq(emailAccount.archived, false), eq(emailAccountUserGrant.canRead, true)))
    .orderBy(desc(emailAccount.createdAt))
    .limit(1);
  ensure(rows[0], "No readable email account was found for Graph fixture coverage");
  return rows[0];
}

async function loadJob(jobId: string) {
  const rows = await db
    .select({
      emailJobId: emailJob.emailJobId,
      jobType: emailJob.jobType,
      status: emailJob.status,
      attempts: emailJob.attempts,
      maxAttempts: emailJob.maxAttempts,
      runAfter: emailJob.runAfter,
      lockedAt: emailJob.lockedAt,
      lockedBy: emailJob.lockedBy,
      lastError: emailJob.lastError,
    })
    .from(emailJob)
    .where(eq(emailJob.emailJobId, jobId))
    .limit(1);
  return rows[0] ?? null;
}

async function testMimeGeneration() {
  const storageKey = await createAttachmentFixture();
  const mime = await buildMimeMessage({
    accountId: "account-id",
    identityId: "sender@example.com",
    to: [{ email: "recipient@example.com" }],
    subject: "Fixture subject",
    bodyText: "Hello fixture",
    attachments: [
      {
        fileName: "fixture.txt",
        contentType: "text/plain",
        storageKey,
        inlineContentId: "cid-1",
      },
    ],
  });
  ensure(mime.includes("multipart/mixed"), "Expected multipart MIME output");
  ensure(mime.includes("fixture.txt"), "Expected attachment filename in MIME output");
  ensure(mime.includes("Content-ID: <cid-1>"), "Expected inline attachment content id");
}

async function testGmailMappingAndRecovery() {
  const adapter = new GmailProviderAdapter();
  const creds = gmailCredentials();

  await withMockFetch(
    async (input) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes("/gmail/v1/users/me/labels")) {
        return new Response(
          JSON.stringify({
            labels: [
              { id: "INBOX", name: "INBOX", type: "system", messagesTotal: 1, messagesUnread: 1 },
              {
                id: "STARRED",
                name: "STARRED",
                type: "system",
                messagesTotal: 0,
                messagesUnread: 0,
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (url.includes("/gmail/v1/users/me/threads?")) {
        return new Response(
          JSON.stringify({ threads: [{ id: "thread-1" }], nextPageToken: null }),
          {
            status: 200,
          },
        );
      }
      if (url.includes("/gmail/v1/users/me/threads/thread-1")) {
        return new Response(
          JSON.stringify({
            id: "thread-1",
            messages: [
              {
                id: "message-1",
                threadId: "thread-1",
                labelIds: ["INBOX", "UNREAD"],
                snippet: "hello snippet",
                internalDate: String(Date.now()),
                payload: {
                  headers: [
                    { name: "From", value: "Sender <sender@example.com>" },
                    { name: "To", value: "Recipient <recipient@example.com>" },
                    { name: "Subject", value: "Subject line" },
                    { name: "Date", value: new Date().toUTCString() },
                    { name: "Message-ID", value: "<message-1@example.com>" },
                  ],
                  parts: [
                    {
                      mimeType: "text/plain",
                      body: { data: Buffer.from("body text").toString("base64url") },
                    },
                    {
                      filename: "fixture.txt",
                      mimeType: "text/plain",
                      headers: [{ name: "Content-ID", value: "<cid-2>" }],
                      body: { attachmentId: "att-1", size: 12 },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (url.includes("/gmail/v1/users/me/profile")) {
        return new Response(JSON.stringify({ historyId: "history-1" }), { status: 200 });
      }
      if (url.includes("/gmail/v1/users/me/history")) {
        return new Response("gone", { status: 404 });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    },
    async () => {
      const page = await adapter.fullSyncPage(creds, null);
      ensure(page.threads.length === 1, "Expected one Gmail thread");
      const message = page.threads[0]?.messages[0];
      ensure(message?.from && typeof message.from === "object", "Expected parsed Gmail sender");
      ensure(
        message?.attachments?.[0]?.inlineContentId === "cid-2",
        "Expected normalized inline attachment",
      );

      const recovery = await adapter.incrementalSync(
        creds,
        JSON.stringify({ historyId: "history-1" }),
      );
      ensure(recovery.recoveryRequired === true, "Expected Gmail history expiration recovery");
    },
  );
}

async function testGraphSyncAndWatch() {
  const adapter = new GraphProviderAdapter();
  const creds = graphCredentials();
  const previousState = process.env.MICROSOFT_WEBHOOK_CLIENT_STATE;
  process.env.MICROSOFT_WEBHOOK_CLIENT_STATE = "graph-state";

  await withMockFetch(
    async (input, init) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes("/me/mailFolders")) {
        return new Response(
          JSON.stringify({
            value: [
              { id: "inbox-folder", displayName: "Inbox", totalItemCount: 1, unreadItemCount: 1 },
            ],
          }),
          { status: 200 },
        );
      }
      if (url.includes("/me/messages/delta")) {
        return new Response(
          JSON.stringify({
            value: [
              {
                id: "graph-message-1",
                conversationId: "graph-thread-1",
                subject: "Graph subject",
                bodyPreview: "Graph preview",
                body: { contentType: "text", content: "Graph body" },
                from: { emailAddress: { address: "sender@example.com", name: "Sender" } },
                toRecipients: [
                  { emailAddress: { address: "recipient@example.com", name: "Recipient" } },
                ],
                sentDateTime: new Date().toISOString(),
                receivedDateTime: new Date().toISOString(),
                isRead: false,
                hasAttachments: true,
                internetMessageHeaders: [
                  { name: "Message-ID", value: "<graph-message-1@example.com>" },
                ],
              },
            ],
            "@odata.deltaLink": "https://graph.microsoft.com/v1.0/me/messages/delta?cursor=next",
          }),
          { status: 200 },
        );
      }
      if (url.includes("/attachments?$select=")) {
        return new Response(
          JSON.stringify({
            value: [
              {
                id: "graph-att-1",
                name: "graph.txt",
                contentType: "text/plain",
                size: 18,
                isInline: true,
                contentId: "cid-graph",
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (url.includes("/subscriptions")) {
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        ensure(body.clientState === "graph-state", "Expected configured Graph client state");
        return new Response(JSON.stringify({ id: "sub-1" }), { status: 201 });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    },
    async () => {
      const page = await adapter.incrementalSync(creds, null);
      ensure(page.threads.length === 1, "Expected one Graph thread");
      ensure(
        page.threads[0]?.messages[0]?.attachments?.[0]?.inlineContentId === "cid-graph",
        "Expected normalized Graph attachment",
      );

      const watch = await adapter.renewWatch(
        creds,
        "https://example.invalid/api/email/webhooks/microsoft",
      );
      ensure(watch.expiresAt instanceof Date, "Expected Graph watch expiry");
    },
  );

  process.env.MICROSOFT_WEBHOOK_CLIENT_STATE = previousState;
}

async function testDraftSendTransitions() {
  const adapter = new GmailProviderAdapter();
  const creds = gmailCredentials();
  await withMockFetch(
    async (input, init) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes("/gmail/v1/users/me/drafts/send")) {
        return new Response(JSON.stringify({ id: "message-2", threadId: "thread-2" }), {
          status: 200,
        });
      }
      if (url.includes("/gmail/v1/users/me/drafts") && init?.method === "POST") {
        return new Response(JSON.stringify({ id: "draft-1", message: { id: "message-1" } }), {
          status: 200,
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    },
    async () => {
      const draft = await adapter.createDraft(creds, {
        accountId: "account-1",
        identityId: "sender@example.com",
        to: [{ email: "recipient@example.com" }],
        subject: "Draft subject",
        bodyText: "Draft body",
      });
      ensure(draft.providerDraftId === "draft-1", "Expected provider draft id");
      ensure(draft.providerMessageId === "message-1", "Expected provider draft message id");

      const sent = await adapter.sendDraft(creds, draft.providerDraftId);
      ensure(sent.providerMessageId === "message-2", "Expected Gmail send result");
    },
  );
}

async function testGraphServiceLayerFlows() {
  const context = await resolveMailContext();
  const account = await createGraphFixtureAccount(context);
  const syncService = new EmailSyncService(context.tenantId, context.userId);
  const sendService = new EmailSendService(context.tenantId, context.userId);
  const accountService = new EmailAccountService(context.tenantId, context.userId);
  const attachmentStorageKey = await createAttachmentFixture();
  const previousState = process.env.MICROSOFT_WEBHOOK_CLIENT_STATE;
  process.env.MICROSOFT_WEBHOOK_CLIENT_STATE = "graph-state";

  try {
    await withMockFetch(
      async (input, init) => {
        const url =
          typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        if (url.includes("/me/mailFolders")) {
          return new Response(
            JSON.stringify({
              value: [
                { id: "inbox-folder", displayName: "Inbox", totalItemCount: 1, unreadItemCount: 0 },
              ],
            }),
            { status: 200 },
          );
        }
        if (url.includes("/me/messages/delta")) {
          return new Response(
            JSON.stringify({
              value: [
                {
                  id: "graph-message-1",
                  conversationId: "graph-thread-1",
                  subject: "Graph fixture subject",
                  bodyPreview: "Graph fixture preview",
                  body: { contentType: "text", content: "Graph fixture body" },
                  from: { emailAddress: { address: "sender@example.com", name: "Sender" } },
                  toRecipients: [
                    { emailAddress: { address: account.primaryEmail, name: "Fixture" } },
                  ],
                  sentDateTime: new Date().toISOString(),
                  receivedDateTime: new Date().toISOString(),
                  isRead: false,
                  hasAttachments: true,
                  internetMessageHeaders: [
                    { name: "Message-ID", value: "<graph-message-1@example.com>" },
                  ],
                },
              ],
              "@odata.deltaLink":
                "https://graph.microsoft.com/v1.0/me/messages/delta?cursor=graph-delta-1",
            }),
            { status: 200 },
          );
        }
        if (url.includes("/me/messages/graph-message-1/attachments/graph-att-1")) {
          return new Response(
            JSON.stringify({
              id: "graph-att-1",
              contentType: "text/plain",
              contentBytes: Buffer.from("graph attachment body").toString("base64"),
            }),
            { status: 200 },
          );
        }
        if (url.includes("/me/messages/graph-message-1/attachments")) {
          return new Response(
            JSON.stringify({
              value: [
                {
                  id: "graph-att-1",
                  name: "graph.txt",
                  contentType: "text/plain",
                  size: 18,
                  isInline: true,
                  contentId: "cid-graph",
                },
              ],
            }),
            { status: 200 },
          );
        }
        if (url.endsWith("/me/messages") && init?.method === "POST") {
          return new Response(JSON.stringify({ id: "graph-draft-1" }), { status: 201 });
        }
        if (url.includes("/me/messages/graph-draft-1/send") && init?.method === "POST") {
          return new Response(null, { status: 204 });
        }
        if (url.includes("/subscriptions")) {
          const body = init?.body ? JSON.parse(String(init.body)) : {};
          ensure(
            body.clientState ===
              (process.env.MICROSOFT_WEBHOOK_CLIENT_STATE ?? process.env.EMAIL_WEBHOOK_TOKEN),
            "Expected Graph watch to use the configured client state",
          );
          return new Response(
            JSON.stringify({
              id: "subscription-id",
              expirationDateTime: new Date(Date.now() + 3_600_000).toISOString(),
            }),
            {
              status: 201,
            },
          );
        }
        throw new Error(`Unexpected Graph fetch: ${url}`);
      },
      async () => {
        const initialJob = await syncService.queueAccountJob(
          account.emailAccountId,
          "initial_sync",
        );
        ensure(initialJob.status === "queued", "Initial Graph job should start queued");
        await syncService.runJob(initialJob.emailJobId);
        const initialJobState = await loadJob(initialJob.emailJobId);
        ensure(initialJobState?.status === "done", "Initial Graph job did not complete");
        ensure(initialJobState?.attempts === 1, "Initial Graph job did not claim exactly once");

        const threads = await syncService.listThreads({
          accountId: account.emailAccountId,
          limit: 20,
        });
        ensure(threads.length > 0, "Graph sync did not import any threads");
        const importedThread = await syncService.getThread(threads[0]!.emailThreadId);
        ensure(
          importedThread?.attachments?.length === 1,
          "Graph sync did not import the attachment metadata",
        );

        const attachment = importedThread.attachments?.[0];
        ensure(attachment, "Graph sync did not expose an attachment for fetch coverage");
        const attachmentJob = await syncService.queueAttachmentFetch(attachment.emailAttachmentId);
        ensure(attachmentJob, "Attachment fetch job should have been queued");
        ensure(attachmentJob.status === "queued", "Attachment fetch job should start queued");
        await syncService.runJob(attachmentJob.emailJobId);
        const attachmentJobState = await loadJob(attachmentJob.emailJobId);
        ensure(attachmentJobState?.status === "done", "Attachment fetch job did not complete");
        ensure(
          attachmentJobState?.attempts === 1,
          "Attachment fetch job did not claim exactly once",
        );

        const fetchedAttachment = await syncService.listMessageAttachments(
          attachment.emailMessageId ?? "",
        );
        ensure(fetchedAttachment, "Attachment metadata lookup did not return any rows");
        ensure(
          fetchedAttachment.some(
            (row) => row.emailAttachmentId === attachment.emailAttachmentId && row.fetchedAt,
          ),
          "Attachment fetch job did not mark the attachment as fetched",
        );

        const incrementalJob = await syncService.queueAccountJob(
          account.emailAccountId,
          "incremental_sync",
        );
        ensure(incrementalJob.status === "queued", "Incremental Graph job should start queued");
        await syncService.runJob(incrementalJob.emailJobId);
        const incrementalJobState = await loadJob(incrementalJob.emailJobId);
        ensure(incrementalJobState?.status === "done", "Incremental Graph job did not complete");
        ensure(
          incrementalJobState?.attempts === 1,
          "Incremental Graph job did not claim exactly once",
        );

        const watchJob = await syncService.queueAccountJob(
          account.emailAccountId,
          "watch_renewal",
          {
            callbackUrl: "https://example.invalid/api/email/webhooks/microsoft",
          },
        );
        ensure(watchJob.status === "queued", "Watch renewal job should start queued");
        await syncService.runJob(watchJob.emailJobId);
        const watchJobState = await loadJob(watchJob.emailJobId);
        ensure(watchJobState?.status === "done", "Watch renewal job did not complete");
        ensure(watchJobState?.attempts === 1, "Watch renewal job did not claim exactly once");

        const identities = await accountService.listIdentities(account.emailAccountId);
        const identity = identities.find((item) => item.canSend) ?? identities[0];
        ensure(identity, "Graph fixture account is missing a send-capable identity");

        const draft = await sendService.saveDraft({
          accountId: account.emailAccountId,
          identityId: identity.emailIdentityId,
          to: [{ email: account.primaryEmail }],
          subject: "Graph fixture draft",
          bodyText: "Graph fixture body",
          attachments: [
            {
              fileName: "fixture.txt",
              contentType: "text/plain",
              storageKey: attachmentStorageKey,
            },
          ],
        });
        const providerDraft = await sendService.createProviderDraft(draft.outbox.emailOutboxId);
        ensure(
          providerDraft.providerDraftId === "graph-draft-1",
          "Expected Graph provider draft id",
        );

        const sendJob = await sendService.queueDraft(draft.outbox.emailOutboxId);
        ensure(sendJob.status === "queued", "Send job should start queued");
        await syncService.runJob(sendJob.emailJobId);
        const sendJobState = await loadJob(sendJob.emailJobId);
        ensure(sendJobState?.status === "done", "Send job did not complete");
        ensure(sendJobState?.attempts === 1, "Send job did not claim exactly once");

        const outbox = await sendService.listOutbox({
          accountId: account.emailAccountId,
          limit: 10,
        });
        ensure(
          outbox.some((row) => row.status === "sent"),
          "Graph send job did not complete",
        );
      },
    );
  } finally {
    process.env.MICROSOFT_WEBHOOK_CLIENT_STATE = previousState;
    await account.cleanup();
  }
}

async function testReauthAndWebhookValidation() {
  const previousSecret = process.env.EMAIL_WEBHOOK_TOKEN;
  const previousGmailSecret = process.env.GMAIL_WEBHOOK_TOKEN;
  process.env.EMAIL_WEBHOOK_TOKEN = "fixture-token";
  process.env.GMAIL_WEBHOOK_TOKEN = "fixture-token";
  const goodRequest = new Request("https://example.invalid/api/email/webhooks/google", {
    method: "POST",
    headers: { "x-email-webhook-token": "fixture-token" },
    body: JSON.stringify({ accountId: "account-1" }),
  });
  const badRequest = new Request("https://example.invalid/api/email/webhooks/google", {
    method: "POST",
    headers: { "x-email-webhook-token": "nope" },
    body: JSON.stringify({ accountId: "account-1" }),
  });
  ensure(
    validateWebhookSignal(goodRequest, "google", { accountId: "account-1" }).ok,
    "Expected valid webhook token",
  );
  ensure(
    !validateWebhookSignal(badRequest, "google", { accountId: "account-1" }).ok,
    "Expected invalid webhook token rejection",
  );

  const previousMicrosoftSecret = process.env.MICROSOFT_WEBHOOK_CLIENT_STATE;
  process.env.MICROSOFT_WEBHOOK_CLIENT_STATE = "fixture-microsoft-token";
  try {
    const microsoftBody = {
      value: [{ accountId: "account-1", clientState: "fixture-microsoft-token" }],
    };
    const microsoftRequest = new Request("https://example.invalid/api/email/webhooks/microsoft", {
      method: "POST",
      headers: { "client-state": "fixture-microsoft-token" },
      body: JSON.stringify(microsoftBody),
    });
    ensure(
      validateWebhookSignal(microsoftRequest, "microsoft", microsoftBody).ok,
      "Expected valid Microsoft webhook token",
    );
    ensure(
      !validateWebhookSignal(
        new Request("https://example.invalid/api/email/webhooks/microsoft", {
          method: "POST",
          headers: { "client-state": "wrong" },
          body: JSON.stringify(microsoftBody),
        }),
        "microsoft",
        microsoftBody,
      ).ok,
      "Expected invalid Microsoft webhook token rejection",
    );
  } finally {
    if (previousMicrosoftSecret === undefined) {
      delete process.env.MICROSOFT_WEBHOOK_CLIENT_STATE;
    } else {
      process.env.MICROSOFT_WEBHOOK_CLIENT_STATE = previousMicrosoftSecret;
    }
  }

  const adapter = new GmailProviderAdapter();
  const creds = gmailCredentials("");
  await withMockFetch(
    async (input) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes("/oauth2.googleapis.com/token")) {
        return new Response(
          JSON.stringify({ error: "invalid_grant", error_description: "expired" }),
          {
            status: 400,
          },
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    },
    async () => {
      let thrown: unknown = null;
      try {
        await adapter.fullSyncPage(creds, null);
      } catch (error) {
        thrown = error;
      }
      ensure(
        thrown instanceof ProviderReauthRequiredError,
        "Expected reauth-required error on token refresh failure",
      );
    },
  );

  process.env.EMAIL_WEBHOOK_TOKEN = previousSecret;
  process.env.GMAIL_WEBHOOK_TOKEN = previousGmailSecret;
}

async function main() {
  process.chdir(repoRoot);
  await testMimeGeneration();
  await testGmailMappingAndRecovery();
  await testGraphSyncAndWatch();
  await testDraftSendTransitions();
  await testGraphServiceLayerFlows();
  await testReauthAndWebhookValidation();
  console.log(
    JSON.stringify(
      {
        mime: "ok",
        gmail: "ok",
        graph: "ok",
        draftSend: "ok",
        graphService: "ok",
        negativePaths: "ok",
      },
      null,
      2,
    ),
  );
  await rm(join(repoRoot, "storage/tenant-fixtures"), { recursive: true, force: true });
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
