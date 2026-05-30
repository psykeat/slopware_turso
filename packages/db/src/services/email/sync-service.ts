import { and, desc, eq, inArray, isNull } from "drizzle-orm";

import { db } from "../../index";
import {
  emailAccount,
  emailAttachment,
  emailLabel,
  emailMessage,
  emailMessageLabel,
  emailSyncState,
  emailThread,
} from "../../schema/app.schema";
import { EmailAccountService } from "./account-service";
import { createEmailProviderAdapter } from "./adapters";
import { EmailJobService } from "./job-service";
import { type EmailProviderAdapter, ProviderReauthRequiredError } from "./provider-adapter";
import { EmailSendService } from "./send-service";
import type { EmailJobType, ProviderLabel, ProviderThread, SyncPage } from "./types";

function asDate(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

export class EmailSyncService {
  private accountService: EmailAccountService;
  private jobService: EmailJobService;

  constructor(
    private tenantId: string,
    private userId: string,
  ) {
    this.accountService = new EmailAccountService(tenantId, userId);
    this.jobService = new EmailJobService(tenantId);
  }

  async queueAccountJob(
    accountId: string,
    jobType: EmailJobType,
    payload: Record<string, unknown> = {},
  ) {
    await this.accountService.assertGrant(accountId, "read");
    const idempotencyKey = `${jobType}:${accountId}:${JSON.stringify(payload)}`;
    await db
      .update(emailAccount)
      .set({ lastSyncStatus: "queued", updatedAt: new Date() })
      .where(
        and(eq(emailAccount.tenantId, this.tenantId), eq(emailAccount.emailAccountId, accountId)),
      );
    return await this.jobService.enqueue({
      jobType,
      emailAccountId: accountId,
      idempotencyKey,
      payload,
    });
  }

  async listThreads(
    options: {
      accountId?: string | null;
      labelId?: string | null;
      limit?: number;
    } = {},
  ) {
    const accounts = await new EmailAccountService(this.tenantId, this.userId).listAccounts();
    const accountIds = accounts.map((account) => account.emailAccountId);
    if (options.accountId) {
      await this.accountService.assertGrant(options.accountId, "read");
    }
    if (accountIds.length === 0) return [];

    let threadIdsWithLabel: string[] | null = null;
    if (options.labelId) {
      const rows = await db
        .selectDistinct({
          emailThreadId: emailMessage.emailThreadId,
        })
        .from(emailMessage)
        .innerJoin(
          emailMessageLabel,
          and(
            eq(emailMessageLabel.tenantId, this.tenantId),
            eq(emailMessageLabel.emailMessageId, emailMessage.emailMessageId),
          ),
        )
        .where(
          and(
            eq(emailMessage.tenantId, this.tenantId),
            eq(emailMessageLabel.emailLabelId, options.labelId),
          ),
        );
      threadIdsWithLabel = rows.map((row) => row.emailThreadId);
      if (threadIdsWithLabel.length === 0) return [];
    }

    const conditions = [
      eq(emailThread.tenantId, this.tenantId),
      eq(emailThread.archived, false),
      options.accountId
        ? eq(emailThread.emailAccountId, options.accountId)
        : inArray(emailThread.emailAccountId, accountIds),
    ];
    if (threadIdsWithLabel) {
      conditions.push(inArray(emailThread.emailThreadId, threadIdsWithLabel));
    }

    return await db
      .select()
      .from(emailThread)
      .where(and(...conditions))
      .orderBy(desc(emailThread.lastMessageAt), desc(emailThread.createdAt))
      .limit(options.limit ?? 50);
  }

  async listLabels(accountId: string) {
    await this.accountService.assertGrant(accountId, "read");
    return await db
      .select()
      .from(emailLabel)
      .where(
        and(
          eq(emailLabel.tenantId, this.tenantId),
          eq(emailLabel.emailAccountId, accountId),
          eq(emailLabel.archived, false),
        ),
      )
      .orderBy(emailLabel.kind, emailLabel.name);
  }

  async refreshLabels(accountId: string) {
    const account = await this.accountService.getAccountForProvider(accountId, "read");
    if (!account) return null;

    const adapter = createEmailProviderAdapter(account.provider as any);
    const labels = await adapter.listLabels(account.credentialsEncrypted);
    await this.persistUpdatedCredentials(account.emailAccountId, adapter);
    await db.transaction(async (tx) => {
      for (const label of labels) {
        await this.mergeLabel(tx, account.emailAccountId, label);
      }
    });

    return await this.listLabels(account.emailAccountId);
  }

  async listSyncState(accountId: string) {
    await this.accountService.assertGrant(accountId, "read");
    return await db
      .select()
      .from(emailSyncState)
      .where(
        and(
          eq(emailSyncState.tenantId, this.tenantId),
          eq(emailSyncState.emailAccountId, accountId),
        ),
      )
      .orderBy(emailSyncState.scope);
  }

  async getThread(threadId: string) {
    const [thread] = await db
      .select()
      .from(emailThread)
      .where(
        and(
          eq(emailThread.tenantId, this.tenantId),
          eq(emailThread.emailThreadId, threadId),
          eq(emailThread.archived, false),
        ),
      )
      .limit(1);
    if (!thread) return null;

    await this.accountService.assertGrant(thread.emailAccountId, "read");
    const messages = await db
      .select()
      .from(emailMessage)
      .where(
        and(eq(emailMessage.tenantId, this.tenantId), eq(emailMessage.emailThreadId, threadId)),
      )
      .orderBy(emailMessage.receivedAt, emailMessage.sentAt, emailMessage.createdAt);
    const messageIds = messages.map((message) => message.emailMessageId);
    const attachments = messageIds.length
      ? await db
          .select()
          .from(emailAttachment)
          .where(
            and(
              eq(emailAttachment.tenantId, this.tenantId),
              inArray(emailAttachment.emailMessageId, messageIds),
            ),
          )
      : [];
    const labels = messageIds.length
      ? await db
          .select({
            emailMessageId: emailMessageLabel.emailMessageId,
            emailLabelId: emailLabel.emailLabelId,
            providerLabelId: emailLabel.providerLabelId,
            name: emailLabel.name,
            kind: emailLabel.kind,
          })
          .from(emailMessageLabel)
          .innerJoin(
            emailLabel,
            and(
              eq(emailLabel.tenantId, this.tenantId),
              eq(emailLabel.emailLabelId, emailMessageLabel.emailLabelId),
            ),
          )
          .where(
            and(
              eq(emailMessageLabel.tenantId, this.tenantId),
              inArray(emailMessageLabel.emailMessageId, messageIds),
            ),
          )
      : [];
    return { ...thread, messages, attachments, labels };
  }

  async listMessageAttachments(messageId: string) {
    const [message] = await db
      .select({
        emailAccountId: emailMessage.emailAccountId,
      })
      .from(emailMessage)
      .where(
        and(eq(emailMessage.tenantId, this.tenantId), eq(emailMessage.emailMessageId, messageId)),
      )
      .limit(1);
    if (!message) return null;

    await this.accountService.assertGrant(message.emailAccountId, "read");
    return await db
      .select()
      .from(emailAttachment)
      .where(
        and(
          eq(emailAttachment.tenantId, this.tenantId),
          eq(emailAttachment.emailMessageId, messageId),
        ),
      )
      .orderBy(emailAttachment.createdAt);
  }

  async queueAttachmentFetch(attachmentId: string) {
    const row = await this.getAttachmentContext(attachmentId);
    if (!row) return null;
    await this.accountService.assertGrant(row.message.emailAccountId, "read");
    if (!row.attachment.providerAttachmentId) {
      throw new Error("Attachment has no provider attachment id");
    }

    return await this.jobService.enqueue({
      jobType: "fetch_attachment",
      emailAccountId: row.message.emailAccountId,
      idempotencyKey: `fetch_attachment:${attachmentId}`,
      payload: {
        attachmentId,
        messageId: row.message.emailMessageId,
        providerMessageId: row.message.providerMessageId,
        providerAttachmentId: row.attachment.providerAttachmentId,
      },
    });
  }

  async fetchAttachmentContent(attachmentId: string) {
    const row = await this.getAttachmentContext(attachmentId);
    if (!row) return null;
    await this.accountService.assertGrant(row.message.emailAccountId, "read");
    if (!row.attachment.providerAttachmentId) {
      throw new Error("Attachment has no provider attachment id");
    }

    const account = await this.accountService.getAccountForProvider(
      row.message.emailAccountId,
      "read",
    );
    if (!account) return null;
    const adapter = createEmailProviderAdapter(account.provider as any);
    const content = await adapter.fetchAttachment(
      account.credentialsEncrypted,
      row.message.providerMessageId,
      row.attachment.providerAttachmentId,
    );
    await this.persistUpdatedCredentials(account.emailAccountId, adapter);

    await db
      .update(emailAttachment)
      .set({ fetchedAt: new Date() })
      .where(
        and(
          eq(emailAttachment.tenantId, this.tenantId),
          eq(emailAttachment.emailAttachmentId, attachmentId),
        ),
      );

    return {
      attachment: row.attachment,
      contentType: content.contentType ?? row.attachment.contentType ?? "application/octet-stream",
      bytes: content.bytes,
    };
  }

  async markRead(threadId: string, read: boolean) {
    const thread = await this.getThread(threadId);
    if (!thread) return null;
    await this.accountService.assertGrant(thread.emailAccountId, "read");
    const account = await this.accountService.getAccountForProvider(thread.emailAccountId, "read");
    if (!account) return null;
    const adapter = createEmailProviderAdapter(account.provider as any);
    for (const message of thread.messages) {
      await adapter.markRead(account.credentialsEncrypted, message.providerMessageId, read);
    }
    await this.persistUpdatedCredentials(account.emailAccountId, adapter);
    await db.transaction(async (tx) => {
      await tx
        .update(emailThread)
        .set({ isRead: read, updatedAt: new Date() })
        .where(
          and(eq(emailThread.tenantId, this.tenantId), eq(emailThread.emailThreadId, threadId)),
        );
      await tx
        .update(emailMessage)
        .set({ isRead: read, updatedAt: new Date() })
        .where(
          and(eq(emailMessage.tenantId, this.tenantId), eq(emailMessage.emailThreadId, threadId)),
        );
    });
    return { ok: true };
  }

  async applyLabel(threadId: string, labelId: string) {
    const thread = await this.getThread(threadId);
    if (!thread) return null;
    await this.accountService.assertGrant(thread.emailAccountId, "read");

    const [label] = await db
      .select()
      .from(emailLabel)
      .where(
        and(
          eq(emailLabel.tenantId, this.tenantId),
          eq(emailLabel.emailAccountId, thread.emailAccountId),
          eq(emailLabel.emailLabelId, labelId),
          eq(emailLabel.archived, false),
        ),
      )
      .limit(1);
    if (!label) return null;

    const account = await this.accountService.getAccountForProvider(thread.emailAccountId, "read");
    if (!account) return null;
    const adapter = createEmailProviderAdapter(account.provider as any);
    for (const message of thread.messages) {
      await adapter.modifyLabels(account.credentialsEncrypted, message.providerMessageId, {
        addProviderLabelIds: [label.providerLabelId],
      });
    }
    await this.persistUpdatedCredentials(account.emailAccountId, adapter);

    const messages = await db
      .select({ emailMessageId: emailMessage.emailMessageId })
      .from(emailMessage)
      .where(
        and(eq(emailMessage.tenantId, this.tenantId), eq(emailMessage.emailThreadId, threadId)),
      );

    for (const message of messages) {
      await db
        .insert(emailMessageLabel)
        .values({
          tenantId: this.tenantId,
          emailMessageId: message.emailMessageId,
          emailLabelId: labelId,
        })
        .onConflictDoNothing();
    }
    return { ok: true };
  }

  async archiveThread(threadId: string) {
    const thread = await this.getThread(threadId);
    if (!thread) return null;
    await this.accountService.assertGrant(thread.emailAccountId, "read");
    const account = await this.accountService.getAccountForProvider(thread.emailAccountId, "read");
    if (!account) return null;
    const adapter = createEmailProviderAdapter(account.provider as any);
    for (const message of thread.messages) {
      await adapter.modifyLabels(account.credentialsEncrypted, message.providerMessageId, {
        removeProviderLabelIds: ["INBOX"],
      });
    }
    await this.persistUpdatedCredentials(account.emailAccountId, adapter);
    await db
      .update(emailThread)
      .set({ archived: true, updatedAt: new Date() })
      .where(and(eq(emailThread.tenantId, this.tenantId), eq(emailThread.emailThreadId, threadId)));
    return { ok: true };
  }

  async runJob(jobId: string) {
    const workerId = `sync:${jobId}`;
    const job = await this.jobService.claim(jobId, workerId);
    if (!job) return null;
    if (!job.emailAccountId) {
      await this.jobService.fail(
        jobId,
        new Error("Job is missing an email account id"),
        undefined,
        workerId,
      );
      return null;
    }

    const account = await this.accountService.getAccountForProvider(
      job.emailAccountId,
      job.jobType === "send" ? "send" : "read",
    );
    if (!account) {
      await this.jobService.fail(
        jobId,
        new Error("Email account is unavailable"),
        undefined,
        workerId,
      );
      return null;
    }
    const adapter = createEmailProviderAdapter(account.provider as any);
    const now = new Date();
    let syncStatus: "ok" | "recovery_required" = "ok";
    let syncError: string | null = null;
    let recoveryRequired = false;

    try {
      await db
        .update(emailAccount)
        .set({ lastSyncStatus: "syncing", updatedAt: new Date() })
        .where(
          and(
            eq(emailAccount.tenantId, this.tenantId),
            eq(emailAccount.emailAccountId, account.emailAccountId),
          ),
        );

      if (job.jobType === "initial_sync" || job.jobType === "reconcile") {
        const cursor =
          typeof (job.payload as any).cursor === "string" ? (job.payload as any).cursor : null;
        const page = await adapter.fullSyncPage(account.credentialsEncrypted, cursor);
        await this.persistUpdatedCredentials(account.emailAccountId, adapter);
        await this.mergeSyncPage(account.emailAccountId, page, "mailbox");
        if (page.hasMore && page.nextCursor) {
          await this.jobService.enqueue({
            jobType: job.jobType,
            emailAccountId: account.emailAccountId,
            idempotencyKey: `${job.jobType}:${account.emailAccountId}:mailbox:${page.nextCursor}`,
            payload: { scope: "mailbox", cursor: page.nextCursor },
          });
        }
      } else if (job.jobType === "incremental_sync") {
        const [state] = await db
          .select()
          .from(emailSyncState)
          .where(
            and(
              eq(emailSyncState.tenantId, this.tenantId),
              eq(emailSyncState.emailAccountId, account.emailAccountId),
              eq(emailSyncState.scope, "mailbox"),
            ),
          )
          .limit(1);
        const payloadCursor =
          typeof (job.payload as any).cursor === "string" ? (job.payload as any).cursor : null;
        const page = await adapter.incrementalSync(
          account.credentialsEncrypted,
          payloadCursor ?? state?.cursor,
        );
        await this.persistUpdatedCredentials(account.emailAccountId, adapter);
        if (page.recoveryRequired) {
          recoveryRequired = true;
          syncStatus = "recovery_required";
          syncError = "Provider incremental cursor expired";
          await db
            .insert(emailSyncState)
            .values({
              tenantId: this.tenantId,
              emailAccountId: account.emailAccountId,
              scope: "mailbox",
              cursor: state?.cursor ?? null,
              status: "recovery_required",
              lastError: syncError,
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: [
                emailSyncState.tenantId,
                emailSyncState.emailAccountId,
                emailSyncState.scope,
              ],
              set: {
                status: "recovery_required",
                lastError: syncError,
                updatedAt: now,
              },
            });
          await db
            .update(emailAccount)
            .set({
              lastSyncStatus: syncStatus,
              lastSyncAt: now,
              lastSyncError: syncError,
              updatedAt: now,
            })
            .where(
              and(
                eq(emailAccount.tenantId, this.tenantId),
                eq(emailAccount.emailAccountId, account.emailAccountId),
              ),
            );
          await this.jobService.enqueue({
            jobType: "reconcile",
            emailAccountId: account.emailAccountId,
            idempotencyKey: `reconcile:${account.emailAccountId}:mailbox`,
            payload: { scope: "mailbox", reason: "cursor_expired" },
          });
        } else {
          await this.mergeSyncPage(account.emailAccountId, page, "mailbox");
          if (page.hasMore && page.nextCursor) {
            await this.jobService.enqueue({
              jobType: "incremental_sync",
              emailAccountId: account.emailAccountId,
              idempotencyKey: `incremental_sync:${account.emailAccountId}:mailbox:${page.nextCursor}`,
              payload: { scope: "mailbox", cursor: page.nextCursor },
            });
          }
        }
      } else if (job.jobType === "watch_renewal") {
        const callbackUrl =
          typeof (job.payload as any).callbackUrl === "string"
            ? (job.payload as any).callbackUrl
            : "";
        const result = await adapter.renewWatch(account.credentialsEncrypted, callbackUrl);
        await this.persistUpdatedCredentials(account.emailAccountId, adapter);
        await db
          .update(emailAccount)
          .set({ watchExpiresAt: result.expiresAt, updatedAt: new Date() })
          .where(
            and(
              eq(emailAccount.tenantId, this.tenantId),
              eq(emailAccount.emailAccountId, account.emailAccountId),
            ),
          );
      } else if (job.jobType === "send") {
        const outboxId =
          typeof (job.payload as any).outboxId === "string" ? (job.payload as any).outboxId : null;
        if (!outboxId) throw new Error("send job missing outboxId");
        const sendService = new EmailSendService(this.tenantId, this.userId);
        try {
          await sendService.markSending(outboxId);
          await sendService.sendDraft(outboxId);
        } catch (error) {
          await sendService.markFailed(outboxId, error);
          throw error;
        }
      } else if (job.jobType === "fetch_attachment") {
        const attachmentId =
          typeof (job.payload as any).attachmentId === "string"
            ? (job.payload as any).attachmentId
            : null;
        if (!attachmentId) throw new Error("fetch_attachment job missing attachmentId");
        await this.fetchAttachmentContent(attachmentId);
      }

      await db
        .update(emailAccount)
        .set({
          lastSyncStatus: syncStatus,
          lastSyncAt: now,
          lastSyncError: syncError,
          updatedAt: now,
        })
        .where(
          and(
            eq(emailAccount.tenantId, this.tenantId),
            eq(emailAccount.emailAccountId, account.emailAccountId),
          ),
        );
      const completedJob = await this.jobService.complete(jobId, workerId);
      return { ok: true, recoveryRequired, job: completedJob };
    } catch (error) {
      const isReauth = error instanceof ProviderReauthRequiredError;
      await db
        .update(emailAccount)
        .set({
          ...(isReauth ? { status: "reauth_required" } : {}),
          lastSyncStatus: "error",
          lastSyncAt: now,
          lastSyncError: error instanceof Error ? error.message : String(error),
          updatedAt: now,
        })
        .where(
          and(
            eq(emailAccount.tenantId, this.tenantId),
            eq(emailAccount.emailAccountId, account.emailAccountId),
          ),
        );
      await this.jobService.fail(jobId, error, undefined, workerId);
      throw error;
    }
  }

  private async mergeSyncPage(accountId: string, page: SyncPage, scope: string) {
    await db.transaction(async (tx) => {
      for (const label of page.labels ?? []) {
        await this.mergeLabel(tx, accountId, label);
      }
      for (const thread of page.threads) {
        await this.mergeThread(tx, accountId, thread);
      }
      await tx
        .insert(emailSyncState)
        .values({
          tenantId: this.tenantId,
          emailAccountId: accountId,
          scope,
          cursor: page.nextCursor,
          status: "ok",
          lastSyncedAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [emailSyncState.tenantId, emailSyncState.emailAccountId, emailSyncState.scope],
          set: {
            cursor: page.nextCursor,
            status: "ok",
            lastSyncedAt: new Date(),
            updatedAt: new Date(),
            lastError: null,
          },
        });
    });
  }

  private async mergeLabel(tx: any, accountId: string, label: ProviderLabel) {
    await tx
      .insert(emailLabel)
      .values({
        tenantId: this.tenantId,
        emailAccountId: accountId,
        providerLabelId: label.providerLabelId,
        name: label.name,
        kind: label.kind,
        color: label.color,
        parentProviderLabelId: label.parentProviderLabelId,
        messageCount: label.messageCount ?? 0,
        unreadCount: label.unreadCount ?? 0,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [emailLabel.tenantId, emailLabel.emailAccountId, emailLabel.providerLabelId],
        set: {
          name: label.name,
          kind: label.kind,
          color: label.color,
          parentProviderLabelId: label.parentProviderLabelId,
          messageCount: label.messageCount ?? 0,
          unreadCount: label.unreadCount ?? 0,
          archived: false,
          updatedAt: new Date(),
        },
      });
  }

  private async getAttachmentContext(attachmentId: string) {
    const [row] = await db
      .select({
        attachment: emailAttachment,
        message: emailMessage,
      })
      .from(emailAttachment)
      .innerJoin(
        emailMessage,
        and(
          eq(emailMessage.tenantId, this.tenantId),
          eq(emailMessage.emailMessageId, emailAttachment.emailMessageId),
        ),
      )
      .where(
        and(
          eq(emailAttachment.tenantId, this.tenantId),
          eq(emailAttachment.emailAttachmentId, attachmentId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  private async persistUpdatedCredentials(accountId: string, adapter: EmailProviderAdapter) {
    const credentialsEncrypted = adapter.consumeUpdatedCredentials?.();
    if (!credentialsEncrypted) return;
    await db
      .update(emailAccount)
      .set({ credentialsEncrypted, status: "connected", updatedAt: new Date() })
      .where(
        and(eq(emailAccount.tenantId, this.tenantId), eq(emailAccount.emailAccountId, accountId)),
      );
  }

  private async mergeThread(tx: any, accountId: string, thread: ProviderThread) {
    const [threadRow] = await tx
      .insert(emailThread)
      .values({
        tenantId: this.tenantId,
        emailAccountId: accountId,
        providerThreadId: thread.providerThreadId,
        subject: thread.subject,
        snippet: thread.snippet,
        lastMessageAt: asDate(thread.lastMessageAt),
        isRead: thread.isRead ?? false,
        isStarred: thread.isStarred ?? false,
        messageCount: thread.messages.length,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [emailThread.tenantId, emailThread.emailAccountId, emailThread.providerThreadId],
        set: {
          subject: thread.subject,
          snippet: thread.snippet,
          lastMessageAt: asDate(thread.lastMessageAt),
          isRead: thread.isRead ?? false,
          isStarred: thread.isStarred ?? false,
          messageCount: thread.messages.length,
          updatedAt: new Date(),
        },
      })
      .returning();

    for (const message of thread.messages) {
      const [messageRow] = await tx
        .insert(emailMessage)
        .values({
          tenantId: this.tenantId,
          emailAccountId: accountId,
          emailThreadId: threadRow.emailThreadId,
          providerMessageId: message.providerMessageId,
          providerDraftId: message.providerDraftId,
          internetMessageId: message.internetMessageId,
          direction: message.direction,
          fromJson: message.from,
          toJson: message.to,
          ccJson: message.cc ?? [],
          bccJson: message.bcc ?? [],
          subject: message.subject,
          snippet: message.snippet,
          bodyHtml: message.bodyHtml,
          bodyText: message.bodyText,
          sentAt: asDate(message.sentAt),
          receivedAt: asDate(message.receivedAt),
          isRead: message.isRead ?? false,
          hasAttachments: message.hasAttachments ?? false,
          rawHeaders: message.rawHeaders ?? {},
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [
            emailMessage.tenantId,
            emailMessage.emailAccountId,
            emailMessage.providerMessageId,
          ],
          set: {
            providerDraftId: message.providerDraftId,
            internetMessageId: message.internetMessageId,
            direction: message.direction,
            fromJson: message.from,
            toJson: message.to,
            ccJson: message.cc ?? [],
            bccJson: message.bcc ?? [],
            subject: message.subject,
            snippet: message.snippet,
            bodyHtml: message.bodyHtml,
            bodyText: message.bodyText,
            sentAt: asDate(message.sentAt),
            receivedAt: asDate(message.receivedAt),
            isRead: message.isRead ?? false,
            hasAttachments: message.hasAttachments ?? false,
            rawHeaders: message.rawHeaders ?? {},
            updatedAt: new Date(),
          },
        })
        .returning();

      for (const attachment of message.attachments ?? []) {
        const values = {
          tenantId: this.tenantId,
          emailMessageId: messageRow.emailMessageId,
          providerAttachmentId: attachment.providerAttachmentId ?? null,
          fileName: attachment.fileName,
          contentType: attachment.contentType ?? null,
          sizeBytes: attachment.sizeBytes ?? null,
          storageKey: attachment.storageKey ?? null,
          inlineContentId: attachment.inlineContentId ?? null,
          fetchedAt: attachment.storageKey ? new Date() : null,
        };
        const insert = tx.insert(emailAttachment).values(values);
        if (attachment.providerAttachmentId) {
          await insert.onConflictDoUpdate({
            target: [
              emailAttachment.tenantId,
              emailAttachment.emailMessageId,
              emailAttachment.providerAttachmentId,
            ],
            set: {
              fileName: attachment.fileName,
              contentType: attachment.contentType ?? null,
              sizeBytes: attachment.sizeBytes ?? null,
              storageKey: attachment.storageKey ?? null,
              inlineContentId: attachment.inlineContentId ?? null,
              fetchedAt: attachment.storageKey ? new Date() : null,
            },
          });
        } else {
          await tx
            .delete(emailAttachment)
            .where(
              and(
                eq(emailAttachment.tenantId, this.tenantId),
                eq(emailAttachment.emailMessageId, messageRow.emailMessageId),
                eq(emailAttachment.fileName, attachment.fileName),
                isNull(emailAttachment.providerAttachmentId),
              ),
            );
          await insert;
        }
      }

      if (message.providerLabelIds?.length) {
        const labels = await tx
          .select({ emailLabelId: emailLabel.emailLabelId })
          .from(emailLabel)
          .where(
            and(
              eq(emailLabel.tenantId, this.tenantId),
              eq(emailLabel.emailAccountId, accountId),
              inArray(emailLabel.providerLabelId, message.providerLabelIds),
            ),
          );

        for (const label of labels) {
          await tx
            .insert(emailMessageLabel)
            .values({
              tenantId: this.tenantId,
              emailMessageId: messageRow.emailMessageId,
              emailLabelId: label.emailLabelId,
            })
            .onConflictDoNothing();
        }
      }
    }
  }
}
