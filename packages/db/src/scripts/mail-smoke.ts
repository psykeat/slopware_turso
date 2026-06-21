import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import "./load-env";
import { and, desc, eq, isNotNull } from "drizzle-orm";

import { db } from "../index";
import {
  emailAccount,
  emailAccountUserGrant,
  emailAttachment,
  emailMessage,
  emailMessageLabel,
  emailOutbox,
} from "../schema/app.schema";
import { EmailAccountService } from "../services/email/account-service";
import { createEmailProviderAdapter } from "../services/email/adapters";
import { EmailJobService } from "../services/email/job-service";
import { EmailSendService } from "../services/email/send-service";
import { EmailSyncService } from "../services/email/sync-service";

type SmokeAccount = {
  tenantId: string;
  userId: string;
  emailAccountId: string;
  provider: "gmail" | "microsoft";
  displayName: string;
  primaryEmail: string;
};

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../");

function log(step: string, details?: unknown) {
  if (details === undefined) {
    console.log(step);
    return;
  }
  console.log(`${step}:`, typeof details === "string" ? details : JSON.stringify(details, null, 2));
}

function ensure(condition: unknown, message: string): asserts condition {
  assert.ok(condition, message);
}

async function resolveAccountContext(): Promise<SmokeAccount> {
  const accountId = process.env.MAIL_SMOKE_ACCOUNT_ID ?? null;
  const rows = accountId
    ? await db
        .select({
          tenantId: emailAccount.tenantId,
          userId: emailAccountUserGrant.userId,
          emailAccountId: emailAccount.emailAccountId,
          provider: emailAccount.provider,
          displayName: emailAccount.displayName,
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
            eq(emailAccountUserGrant.canRead, true),
            eq(emailAccount.emailAccountId, accountId),
          ),
        )
        .orderBy(desc(emailAccount.createdAt))
        .limit(1)
    : await db
        .select({
          tenantId: emailAccount.tenantId,
          userId: emailAccountUserGrant.userId,
          emailAccountId: emailAccount.emailAccountId,
          provider: emailAccount.provider,
          displayName: emailAccount.displayName,
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
        .where(and(eq(emailAccount.archived, false), eq(emailAccountUserGrant.canRead, true)))
        .orderBy(desc(emailAccount.createdAt))
        .limit(1);

  const row = rows[0];
  ensure(row, "No readable email account was found for smoke verification");
  ensure(row.provider === "gmail" || row.provider === "microsoft", "Unsupported provider");
  ensure(Boolean(row.userId), "Email account grant is missing a user");

  return {
    tenantId: row.tenantId,
    userId: row.userId,
    emailAccountId: row.emailAccountId,
    provider: row.provider,
    displayName: row.displayName ?? row.primaryEmail ?? "mail",
    primaryEmail: row.primaryEmail ?? "",
  };
}

async function createAttachmentFixture(account: SmokeAccount, draftTag: string) {
  const storageKey = `storage/${account.tenantId}/mail-smoke/${draftTag}/${randomUUID()}.txt`;
  const path = join(repoRoot, storageKey);
  await mkdir(dirname(path), { recursive: true });
  const content = `slopware mail smoke ${draftTag}\n${new Date().toISOString()}\n`;
  await writeFile(path, content, "utf8");
  return { storageKey, path, content };
}

async function findProviderAttachment(tenantId: string, accountId: string) {
  const rows = await db
    .select({
      emailAttachmentId: emailAttachment.emailAttachmentId,
      providerAttachmentId: emailAttachment.providerAttachmentId,
      fileName: emailAttachment.fileName,
      contentType: emailAttachment.contentType,
      sizeBytes: emailAttachment.sizeBytes,
      emailMessageId: emailAttachment.emailMessageId,
      emailThreadId: emailMessage.emailThreadId,
      providerMessageId: emailMessage.providerMessageId,
      subject: emailMessage.subject,
    })
    .from(emailAttachment)
    .innerJoin(
      emailMessage,
      and(
        eq(emailMessage.tenantId, emailAttachment.tenantId),
        eq(emailMessage.emailMessageId, emailAttachment.emailMessageId),
      ),
    )
    .where(
      and(
        eq(emailAttachment.tenantId, tenantId),
        eq(emailMessage.emailAccountId, accountId),
        isNotNull(emailAttachment.providerAttachmentId),
      ),
    )
    .orderBy(desc(emailAttachment.createdAt));

  return rows[0] ?? null;
}

async function loadProviderAccount(account: SmokeAccount) {
  const rows = await db
    .select({
      credentialsEncrypted: emailAccount.credentialsEncrypted,
      provider: emailAccount.provider,
    })
    .from(emailAccount)
    .where(
      and(
        eq(emailAccount.tenantId, account.tenantId),
        eq(emailAccount.emailAccountId, account.emailAccountId),
      ),
    )
    .limit(1);
  const row = rows[0];
  ensure(row, "Unable to load provider credentials for smoke verification");
  return row;
}

async function verifyProviderLabelRoundTrip(
  account: SmokeAccount,
  providerMessageId: string,
  labelId: string,
) {
  const providerAccount = await loadProviderAccount(account);
  const adapter = createEmailProviderAdapter(providerAccount.provider as "gmail" | "microsoft");
  const credentialsEncrypted = providerAccount.credentialsEncrypted;

  await adapter.modifyLabels(credentialsEncrypted, providerMessageId, {
    addProviderLabelIds: [labelId],
  });

  const page = await adapter.fullSyncPage(credentialsEncrypted, null);
  const threadedMessage = page.threads
    .flatMap((thread) => thread.messages)
    .find((message) => message.providerMessageId === providerMessageId);
  ensure(threadedMessage, "Provider label round-trip did not return the target message");
  ensure(
    threadedMessage.providerLabelIds?.includes(labelId) ?? false,
    "Provider label round-trip did not persist the added label",
  );

  await adapter.modifyLabels(credentialsEncrypted, providerMessageId, {
    removeProviderLabelIds: [labelId],
  });
}

async function main() {
  process.chdir(repoRoot);

  const account = await resolveAccountContext();
  const accountService = new EmailAccountService(account.tenantId, account.userId);
  const jobService = new EmailJobService(account.tenantId);
  const syncService = new EmailSyncService(account.tenantId, account.userId);
  const sendService = new EmailSendService(account.tenantId, account.userId);

  log("Selected account", {
    tenantId: account.tenantId,
    emailAccountId: account.emailAccountId,
    provider: account.provider,
    displayName: account.displayName,
    primaryEmail: account.primaryEmail,
  });

  const beforeThreads = await syncService.listThreads({
    accountId: account.emailAccountId,
    limit: 500,
  });
  const beforeSyncState = await syncService.listSyncState(account.emailAccountId);

  log("Step 1", "initial sync");
  const initialJob = await syncService.queueAccountJob(account.emailAccountId, "initial_sync");
  ensure(initialJob.status === "queued", "Initial sync job was not queued");
  ensure(initialJob.attempts === 0, "Initial sync job should not be claimed before execution");
  await syncService.runJob(initialJob.emailJobId);
  const initialJobState = await jobService.get(initialJob.emailJobId);
  ensure(initialJobState?.status === "done", "Initial sync job did not complete");
  ensure(initialJobState?.attempts === 1, "Initial sync job did not claim exactly once");
  ensure(initialJobState?.lockedAt === null, "Initial sync job lock was not cleared");

  const afterInitialThreads = await syncService.listThreads({
    accountId: account.emailAccountId,
    limit: 500,
  });
  const nonDraftThreads = afterInitialThreads.filter(
    (thread) => !thread.providerThreadId.startsWith("draft:"),
  );
  ensure(nonDraftThreads.length > 0, "Initial sync did not import any provider threads");

  const initialSyncState = await syncService.listSyncState(account.emailAccountId);
  ensure(initialSyncState.length > 0, "Initial sync did not persist sync state");

  log("Step 1", "incremental sync");
  const incrementalJob = await syncService.queueAccountJob(
    account.emailAccountId,
    "incremental_sync",
  );
  ensure(incrementalJob.status === "queued", "Incremental sync job was not queued");
  await syncService.runJob(incrementalJob.emailJobId);
  const incrementalJobState = await jobService.get(incrementalJob.emailJobId);
  ensure(incrementalJobState?.status === "done", "Incremental sync job did not complete");
  ensure(incrementalJobState?.attempts === 1, "Incremental sync job did not claim exactly once");

  const afterIncrementalState = await syncService.listSyncState(account.emailAccountId);
  ensure(afterIncrementalState.length > 0, "Incremental sync did not persist sync state");
  ensure(
    afterIncrementalState.some(
      (state) => state.status === "ok" || state.status === "recovery_required",
    ),
    "Incremental sync did not reach a usable status",
  );

  log("Step 2", "draft save, provider draft, queue, send");
  const identities = await accountService.listIdentities(account.emailAccountId);
  const identity =
    identities.find((item) => item.canSend) ??
    identities.find((item) => item.isPrimary) ??
    identities[0];
  ensure(identity, "No send-capable identity is available for the selected account");

  const attachmentTag = `mail-smoke-${randomUUID()}`;
  const attachment = await createAttachmentFixture(account, attachmentTag);
  const attachmentMeta = {
    fileName: `${attachmentTag}.txt`,
    contentType: "text/plain",
    storageKey: attachment.storageKey,
    sizeBytes: Buffer.byteLength(attachment.content),
  };

  const draft = await sendService.saveDraft({
    accountId: account.emailAccountId,
    identityId: identity.emailIdentityId,
    to: [{ email: account.primaryEmail || identity.email }],
    subject: `Smoke draft ${attachmentTag}`,
    bodyText: `smoke draft ${attachmentTag}`,
    attachments: [attachmentMeta],
  });

  ensure(draft.outbox.status === "draft", "Draft save did not create a draft outbox row");

  const providerDraft = await sendService.createProviderDraft(draft.outbox.emailOutboxId);
  ensure(Boolean(providerDraft.providerDraftId), "Provider draft creation did not return an id");

  const queuedDraft = await sendService.queueDraft(draft.outbox.emailOutboxId);
  await syncService.runJob(queuedDraft.emailJobId);
  const sendJobState = await jobService.get(queuedDraft.emailJobId);
  ensure(sendJobState?.status === "done", "Send job did not complete");
  ensure(sendJobState?.attempts === 1, "Send job did not claim exactly once");

  const sentOutbox = (
    await db
      .select()
      .from(emailOutbox)
      .where(eq(emailOutbox.emailOutboxId, draft.outbox.emailOutboxId))
      .limit(1)
  )[0];
  ensure(sentOutbox?.status === "sent", "Outbox did not transition to sent");

  const sentMessage = (
    await db
      .select()
      .from(emailMessage)
      .where(eq(emailMessage.emailMessageId, draft.message.emailMessageId))
      .limit(1)
  )[0];
  ensure(sentMessage?.direction === "outbound", "Draft message did not transition to outbound");
  ensure(Boolean(sentMessage?.providerMessageId), "Sent message is missing a provider message id");

  log("Step 3", "read and label mutations");
  const targetThread =
    nonDraftThreads[0] ??
    (await syncService.listThreads({ accountId: account.emailAccountId, limit: 500 })).find(
      (thread) => !thread.providerThreadId.startsWith("draft:"),
    );
  ensure(targetThread, "No provider thread exists to validate read and label mutations");

  const labels = await syncService.refreshLabels(account.emailAccountId);
  ensure(labels && labels.length > 0, "Provider labels were not available for mutation testing");
  const targetLabel = labels.find((label) => label.kind !== "system") ?? labels[0];
  ensure(targetLabel, "No label could be selected for mutation testing");

  await syncService.markRead(targetThread.emailThreadId, false);
  const unreadThread = await syncService.getThread(targetThread.emailThreadId);
  const unreadMessages = unreadThread?.messages as Array<{ isRead: boolean }> | undefined;
  ensure(
    unreadMessages?.every((message) => message.isRead === false),
    "markRead(false) did not persist locally",
  );

  await syncService.markRead(targetThread.emailThreadId, true);
  const readThread = await syncService.getThread(targetThread.emailThreadId);
  const readMessages = readThread?.messages as Array<{ isRead: boolean }> | undefined;
  ensure(
    readMessages?.every((message) => message.isRead === true),
    "markRead(true) did not persist locally",
  );

  await syncService.applyLabel(targetThread.emailThreadId, targetLabel.emailLabelId);
  const labeledThread = await syncService.getThread(targetThread.emailThreadId);
  const labeledMessages = labeledThread?.messages as Array<{ emailMessageId: string }> | undefined;
  const labeledMessageIds = new Set(labeledMessages?.map((message) => message.emailMessageId));
  const labelsOnThread = await db
    .select({
      emailMessageId: emailMessageLabel.emailMessageId,
      emailLabelId: emailMessageLabel.emailLabelId,
    })
    .from(emailMessageLabel)
    .where(
      and(
        eq(emailMessageLabel.tenantId, account.tenantId),
        eq(emailMessageLabel.emailLabelId, targetLabel.emailLabelId),
      ),
    );
  log("Step 3", {
    labelApplied: targetLabel.name,
    labelRows: labelsOnThread.filter((row) => labeledMessageIds?.has(row.emailMessageId)).length,
  });

  ensure(
    sentMessage?.providerMessageId,
    "No provider message id available for label round-trip verification",
  );
  await verifyProviderLabelRoundTrip(
    account,
    sentMessage.providerMessageId,
    targetLabel.providerLabelId,
  );
  log("Step 3", "provider label round-trip verified");

  log("Step 4", "attachment queue and direct download");
  const attachmentAfterSync = await findProviderAttachment(
    account.tenantId,
    account.emailAccountId,
  );
  ensure(attachmentAfterSync, "No provider attachment was imported after send and sync");

  const attachmentJob = await syncService.queueAttachmentFetch(
    attachmentAfterSync.emailAttachmentId,
  );
  ensure(attachmentJob, "Attachment fetch job was not queued");
  await syncService.runJob(attachmentJob.emailJobId);
  const attachmentJobState = await jobService.get(attachmentJob.emailJobId);
  ensure(attachmentJobState?.status === "done", "Attachment fetch job did not complete");
  ensure(attachmentJobState?.attempts === 1, "Attachment fetch job did not claim exactly once");

  const fetched = await syncService.fetchAttachmentContent(attachmentAfterSync.emailAttachmentId);
  ensure(fetched, "Direct attachment download did not return a result");
  ensure(fetched.bytes.byteLength > 0, "Direct attachment download returned no bytes");
  ensure(Boolean(fetched.contentType), "Direct attachment download did not return a content type");

  const finalState = await syncService.listSyncState(account.emailAccountId);
  const finalOutbox = (
    await db
      .select()
      .from(emailOutbox)
      .where(eq(emailOutbox.emailOutboxId, draft.outbox.emailOutboxId))
      .limit(1)
  )[0];

  console.log(
    JSON.stringify(
      {
        account,
        beforeThreads: beforeThreads.length,
        afterInitialThreads: afterInitialThreads.length,
        syncStateBefore: beforeSyncState.length,
        syncStateAfter: finalState.length,
        outboxStatus: finalOutbox?.status ?? null,
        jobStatuses: {
          initial: initialJobState?.status ?? null,
          incremental: incrementalJobState?.status ?? null,
          send: sendJobState?.status ?? null,
          attachment: attachmentJobState?.status ?? null,
        },
        attachmentId: attachmentAfterSync.emailAttachmentId,
        attachmentBytes: fetched.bytes.byteLength,
        attachmentContentType: fetched.contentType,
      },
      null,
      2,
    ),
  );

  await rm(attachment.path, { force: true });
  process.exit(0);
}

main().catch(async (error) => {
  console.error(error);
  try {
    const account = await resolveAccountContext().catch(() => null);
    if (account) {
      const attachmentRoot = join(repoRoot, "storage", account.tenantId, "mail-smoke");
      await rm(attachmentRoot, { recursive: true, force: true });
    }
  } catch {
    // Ignore cleanup failures on error.
  }
  process.exit(1);
});
