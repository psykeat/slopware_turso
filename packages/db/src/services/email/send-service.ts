import { randomUUID } from "node:crypto";

import { and, desc, eq } from "drizzle-orm";

import { db } from "../../index";
import {
  emailAccount,
  emailAttachment,
  emailIdentity,
  emailMessage,
  emailOutbox,
  emailThread,
} from "../../schema/app.schema";
import { EmailAccountService, EmailAuthorizationError } from "./account-service";
import { createEmailProviderAdapter } from "./adapters";
import { EmailJobService } from "./job-service";
import { type EmailProviderAdapter, ProviderReauthRequiredError } from "./provider-adapter";
import type { EmailDraftInput } from "./types";

export class EmailSendService {
  private accountService: EmailAccountService;
  private jobService: EmailJobService;

  constructor(
    private tenantId: string,
    private userId: string,
  ) {
    this.accountService = new EmailAccountService(tenantId, userId);
    this.jobService = new EmailJobService(tenantId);
  }

  async saveDraft(input: EmailDraftInput) {
    const account = await this.accountService.getAccountForProvider(input.accountId, "send");
    if (!account) throw new EmailAuthorizationError();

    const identity = await this.getSendIdentity(input.identityId, input.accountId);
    const providerThreadId = `draft:${randomUUID()}`;
    const providerMessageId = `draft-message:${randomUUID()}`;

    const [result] = await db.transaction(async (tx) => {
      const [thread] = await tx
        .insert(emailThread)
        .values({
          tenantId: this.tenantId,
          emailAccountId: input.accountId,
          providerThreadId,
          subject: input.subject,
          snippet:
            input.bodyText?.slice(0, 240) ?? input.bodyHtml?.replace(/<[^>]+>/g, "").slice(0, 240),
          lastMessageAt: new Date(),
          isRead: true,
          messageCount: 1,
          relatedDocumentId: input.relatedDocumentId ?? null,
          relatedAddressId: input.relatedAddressId ?? null,
        })
        .returning();

      const [message] = await tx
        .insert(emailMessage)
        .values({
          tenantId: this.tenantId,
          emailAccountId: input.accountId,
          emailThreadId: thread.emailThreadId,
          providerMessageId,
          direction: "draft",
          fromJson: { email: identity.email, name: identity.displayName },
          toJson: input.to,
          ccJson: input.cc ?? [],
          bccJson: input.bcc ?? [],
          subject: input.subject,
          bodyHtml: input.bodyHtml,
          bodyText: input.bodyText,
          isRead: true,
          hasAttachments: Boolean(input.attachments?.length),
        })
        .returning();

      const [outbox] = await tx
        .insert(emailOutbox)
        .values({
          tenantId: this.tenantId,
          emailAccountId: input.accountId,
          emailIdentityId: input.identityId,
          emailMessageId: message.emailMessageId,
          status: "draft",
          payload: input as any,

          createdBy: this.userId,
        })
        .returning();

      for (const attachment of input.attachments ?? []) {
        await tx.insert(emailAttachment).values({
          tenantId: this.tenantId,
          emailMessageId: message.emailMessageId,
          providerAttachmentId: attachment.providerAttachmentId ?? null,
          fileName: attachment.fileName,
          contentType: attachment.contentType ?? null,
          sizeBytes: attachment.sizeBytes ?? null,
          storageKey: attachment.storageKey ?? null,
          inlineContentId: attachment.inlineContentId ?? null,
          fetchedAt: attachment.storageKey ? new Date() : null,
        });
      }

      return [{ thread, message, outbox }];
    });

    return result;
  }

  async listOutbox(
    options: { accountId?: string | null; status?: string | null; limit?: number } = {},
  ) {
    if (options.accountId) {
      await this.accountService.assertGrant(options.accountId, "send");
    }

    const conditions = [eq(emailOutbox.tenantId, this.tenantId)];
    if (options.accountId) conditions.push(eq(emailOutbox.emailAccountId, options.accountId));
    if (options.status) conditions.push(eq(emailOutbox.status, options.status));

    return await db
      .select()
      .from(emailOutbox)
      .where(and(...conditions))
      .orderBy(desc(emailOutbox.updatedAt), desc(emailOutbox.createdAt))
      .limit(options.limit ?? 50);
  }

  async getDraft(outboxId: string) {
    const outbox = await this.getOutbox(outboxId);
    await this.accountService.assertGrant(outbox.emailAccountId, "send");
    return outbox;
  }

  async queueDraft(outboxId: string) {
    const outbox = await this.getOutbox(outboxId);
    await this.accountService.assertGrant(outbox.emailAccountId, "send");
    await db
      .update(emailOutbox)
      .set({ status: "queued", updatedAt: new Date() })
      .where(and(eq(emailOutbox.tenantId, this.tenantId), eq(emailOutbox.emailOutboxId, outboxId)));
    return await this.jobService.enqueue({
      jobType: "send",
      emailAccountId: outbox.emailAccountId,
      idempotencyKey: `send:${outboxId}`,
      payload: { outboxId },
    });
  }

  async createProviderDraft(outboxId: string) {
    const outbox = await this.getOutbox(outboxId);
    if (outbox.providerDraftId) return { providerDraftId: outbox.providerDraftId };

    const account = await this.accountService.getAccountForProvider(outbox.emailAccountId, "send");
    if (!account) throw new EmailAuthorizationError();

    const adapter = createEmailProviderAdapter(account.provider as any);
    const payload = await this.providerDraftPayload(outbox);
    let draft;
    try {
      draft = await adapter.createDraft(account.credentialsEncrypted, payload);
      await this.persistUpdatedCredentials(account.emailAccountId, adapter);
    } catch (error) {
      await this.markAccountProviderError(account.emailAccountId, error);
      throw error;
    }

    await db.transaction(async (tx) => {
      await tx
        .update(emailOutbox)
        .set({ providerDraftId: draft.providerDraftId, updatedAt: new Date() })
        .where(
          and(eq(emailOutbox.tenantId, this.tenantId), eq(emailOutbox.emailOutboxId, outboxId)),
        );

      if (outbox.emailMessageId) {
        await tx
          .update(emailMessage)
          .set({
            providerDraftId: draft.providerDraftId,
            ...(draft.providerMessageId ? { providerMessageId: draft.providerMessageId } : {}),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(emailMessage.tenantId, this.tenantId),
              eq(emailMessage.emailMessageId, outbox.emailMessageId),
            ),
          );
      }
    });

    return draft;
  }

  async sendDraft(outboxId: string) {
    const outbox = await this.getOutbox(outboxId);
    const account = await this.accountService.getAccountForProvider(outbox.emailAccountId, "send");
    if (!account) throw new EmailAuthorizationError();

    const adapter = createEmailProviderAdapter(account.provider as any);
    const payload = await this.providerDraftPayload(outbox);
    await db
      .update(emailOutbox)
      .set({ status: "sending", lastError: null, updatedAt: new Date() })
      .where(and(eq(emailOutbox.tenantId, this.tenantId), eq(emailOutbox.emailOutboxId, outboxId)));

    let sent;
    try {
      sent = outbox.providerDraftId
        ? await adapter.sendDraft(account.credentialsEncrypted, outbox.providerDraftId)
        : await adapter.sendMessage(account.credentialsEncrypted, payload);
      await this.persistUpdatedCredentials(account.emailAccountId, adapter);
    } catch (error) {
      await this.markAccountProviderError(account.emailAccountId, error);
      await db
        .update(emailOutbox)
        .set({
          status: "failed",
          lastError: error instanceof Error ? error.message : String(error),
          updatedAt: new Date(),
        })
        .where(
          and(eq(emailOutbox.tenantId, this.tenantId), eq(emailOutbox.emailOutboxId, outboxId)),
        );
      throw error;
    }

    await db.transaction(async (tx) => {
      await tx
        .update(emailOutbox)
        .set({
          status: "sent",
          sentAt: sent.sentAt ? new Date(sent.sentAt) : new Date(),
          lastError: null,
          updatedAt: new Date(),
        })
        .where(
          and(eq(emailOutbox.tenantId, this.tenantId), eq(emailOutbox.emailOutboxId, outboxId)),
        );

      if (outbox.emailMessageId) {
        if (account.provider === "microsoft") {
          // Delete attachments linked to this draft message
          await tx
            .delete(emailAttachment)
            .where(
              and(
                eq(emailAttachment.tenantId, this.tenantId),
                eq(emailAttachment.emailMessageId, outbox.emailMessageId),
              ),
            );

          // Get the thread ID of this draft message to clean it up too
          const [msgRow] = await tx
            .select({ emailThreadId: emailMessage.emailThreadId })
            .from(emailMessage)
            .where(
              and(
                eq(emailMessage.tenantId, this.tenantId),
                eq(emailMessage.emailMessageId, outbox.emailMessageId),
              ),
            )
            .limit(1);

          // Update outbox row to remove the foreign key reference so we can delete the message
          await tx
            .update(emailOutbox)
            .set({ emailMessageId: null })
            .where(
              and(eq(emailOutbox.tenantId, this.tenantId), eq(emailOutbox.emailOutboxId, outboxId)),
            );

          // Delete the draft message
          await tx
            .delete(emailMessage)
            .where(
              and(
                eq(emailMessage.tenantId, this.tenantId),
                eq(emailMessage.emailMessageId, outbox.emailMessageId),
              ),
            );

          if (msgRow?.emailThreadId) {
            // Check if the thread has any other messages left. If not, delete the thread.
            const otherMsgs = await tx
              .select()
              .from(emailMessage)
              .where(
                and(
                  eq(emailMessage.tenantId, this.tenantId),
                  eq(emailMessage.emailThreadId, msgRow.emailThreadId),
                ),
              )
              .limit(1);

            if (otherMsgs.length === 0) {
              await tx
                .delete(emailThread)
                .where(
                  and(
                    eq(emailThread.tenantId, this.tenantId),
                    eq(emailThread.emailThreadId, msgRow.emailThreadId),
                  ),
                );
            }
          }
        } else {
          await tx
            .update(emailMessage)
            .set({
              providerMessageId: sent.providerMessageId,
              direction: "outbound",
              sentAt: sent.sentAt ? new Date(sent.sentAt) : new Date(),
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(emailMessage.tenantId, this.tenantId),
                eq(emailMessage.emailMessageId, outbox.emailMessageId),
              ),
            );
        }
      }
    });

    return sent;
  }

  async markSending(outboxId: string) {
    const outbox = await this.getOutbox(outboxId);
    await this.accountService.assertGrant(outbox.emailAccountId, "send");
    await db
      .update(emailOutbox)
      .set({ status: "sending", lastError: null, updatedAt: new Date() })
      .where(and(eq(emailOutbox.tenantId, this.tenantId), eq(emailOutbox.emailOutboxId, outboxId)));
    return outbox;
  }

  async markFailed(outboxId: string, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const outbox = await this.getOutbox(outboxId);
    await this.accountService.assertGrant(outbox.emailAccountId, "send");
    await db
      .update(emailOutbox)
      .set({ status: "failed", lastError: message, updatedAt: new Date() })
      .where(and(eq(emailOutbox.tenantId, this.tenantId), eq(emailOutbox.emailOutboxId, outboxId)));
    return outbox;
  }

  async reply(
    messageId: string,
    input: Omit<EmailDraftInput, "accountId" | "identityId"> & { identityId: string },
  ) {
    const [source] = await db
      .select({
        accountId: emailMessage.emailAccountId,
        subject: emailMessage.subject,
      })
      .from(emailMessage)
      .where(
        and(eq(emailMessage.tenantId, this.tenantId), eq(emailMessage.emailMessageId, messageId)),
      )
      .limit(1);
    if (!source) return null;
    return await this.saveDraft({
      ...input,
      accountId: source.accountId,
      identityId: input.identityId,
      subject: input.subject || `Re: ${source.subject ?? ""}`,
    });
  }

  async forward(
    messageId: string,
    input: Omit<EmailDraftInput, "accountId" | "identityId"> & { identityId: string },
  ) {
    const [source] = await db
      .select({
        accountId: emailMessage.emailAccountId,
        subject: emailMessage.subject,
        bodyHtml: emailMessage.bodyHtml,
        bodyText: emailMessage.bodyText,
      })
      .from(emailMessage)
      .where(
        and(eq(emailMessage.tenantId, this.tenantId), eq(emailMessage.emailMessageId, messageId)),
      )
      .limit(1);
    if (!source) return null;
    return await this.saveDraft({
      ...input,
      accountId: source.accountId,
      identityId: input.identityId,
      subject: input.subject || `Fwd: ${source.subject ?? ""}`,
      bodyHtml: input.bodyHtml ?? source.bodyHtml,
      bodyText: input.bodyText ?? source.bodyText,
    });
  }

  private async getSendIdentity(identityId: string, accountId: string) {
    const [identity] = await db
      .select()
      .from(emailIdentity)
      .where(
        and(
          eq(emailIdentity.tenantId, this.tenantId),
          eq(emailIdentity.emailAccountId, accountId),
          eq(emailIdentity.emailIdentityId, identityId),
          eq(emailIdentity.canSend, true),
          eq(emailIdentity.archived, false),
        ),
      )
      .limit(1);
    if (!identity) throw new EmailAuthorizationError("Sending identity is not allowed");
    return identity;
  }

  private async getOutbox(outboxId: string) {
    const [outbox] = await db
      .select()
      .from(emailOutbox)
      .innerJoin(
        emailAccount,
        and(
          eq(emailAccount.tenantId, this.tenantId),
          eq(emailAccount.emailAccountId, emailOutbox.emailAccountId),
        ),
      )
      .where(and(eq(emailOutbox.tenantId, this.tenantId), eq(emailOutbox.emailOutboxId, outboxId)))
      .limit(1);
    if (!outbox) throw new Error("Draft not found");
    return outbox.email_outbox;
  }

  private async providerDraftPayload(outbox: typeof emailOutbox.$inferSelect) {
    const payload = outbox.payload as unknown as EmailDraftInput;
    const identity = await this.getSendIdentity(outbox.emailIdentityId, outbox.emailAccountId);
    return { ...payload, identityId: identity.email };
  }

  private async markAccountProviderError(accountId: string, error: unknown) {
    const isReauth = error instanceof ProviderReauthRequiredError;
    await db
      .update(emailAccount)
      .set({
        ...(isReauth ? { status: "reauth_required" } : {}),
        lastSyncError: error instanceof Error ? error.message : String(error),
        updatedAt: new Date(),
      })
      .where(
        and(eq(emailAccount.tenantId, this.tenantId), eq(emailAccount.emailAccountId, accountId)),
      );
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
}
