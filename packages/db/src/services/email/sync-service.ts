import { and, desc, eq, inArray, isNull, or, ilike, sql } from "drizzle-orm";

import { db } from "../../index";
import {
  addressContact,
  addressContactIdentity,
  emailAccount,
  emailAttachment,
  emailLabel,
  emailMessage,
  emailMessageLabel,
  emailSyncState,
  emailThread,
} from "../../schema/sqlite.schema";
import { EmailAccountService } from "./account-service";
import { createEmailProviderAdapter } from "./adapters";
import { EmailJobService, activityTierPriority } from "./job-service";
import { type EmailProviderAdapter, ProviderReauthRequiredError } from "./provider-adapter";
import { EmailSendService } from "./send-service";
import { EmailSubscriptionService } from "./subscription-service";
import type { EmailJobType, ProviderLabel, ProviderThread, SyncPage } from "./types";

const TIER_INTERVALS_MINUTES: Record<string, number> = {
  hot: 5,
  warm: 30,
  cold: 360,
  dormant: 1440,
};

function asDate(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

function extractEmailAddress(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const angledMatch = trimmed.match(/<([^<>]+)>/);
    if (angledMatch?.[1]) {
      const candidate = angledMatch[1].trim();
      return candidate.includes("@") ? candidate.toLowerCase() : null;
    }

    const plainMatch = trimmed.match(/([^\s<>]+@[^\s<>]+)/);
    if (plainMatch?.[1]) {
      return plainMatch[1].trim().toLowerCase();
    }

    return trimmed.includes("@") ? trimmed.toLowerCase() : null;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return (
      extractEmailAddress(record.email) ??
      extractEmailAddress(record.address) ??
      extractEmailAddress(record.value) ??
      null
    );
  }

  return null;
}

export class EmailSyncService {
  private accountService: EmailAccountService;
  private jobService: EmailJobService;

  constructor(
    private tenantId: string,
    private userId: string,
  ) {
    this.accountService = new EmailAccountService(tenantId, userId);
    this.jobService = new EmailJobService(tenantId, {
      executor: ({ jobType, emailAccountId, payload }) =>
        this.executeJob(jobType, emailAccountId, payload),
    });
  }

  async markUserActivity(accountId: string) {
    const now = new Date();
    await db
      .update(emailAccount)
      .set({ activityTier: "hot", lastUserActivityAt: now, updatedAt: now })
      .where(eq(emailAccount.emailAccountId, accountId));
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
      .where(eq(emailAccount.emailAccountId, accountId));
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
      folder?: string | null;
      search?: string | null;
      limit?: number;
      offset?: number;
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
          eq(emailMessageLabel.emailMessageId, emailMessage.emailMessageId),
        )
        .where(eq(emailMessageLabel.emailLabelId, options.labelId));
      threadIdsWithLabel = rows.map((row) => row.emailThreadId);
      if (threadIdsWithLabel.length === 0) return [];
    }

    const conditions = [
      options.folder === "trash"
        ? eq(emailThread.inTrash, true)
        : and(
            eq(emailThread.inTrash, false),
            options.folder === "archive"
              ? eq(emailThread.archived, true)
              : eq(emailThread.archived, false),
          ),
      options.accountId
        ? eq(emailThread.emailAccountId, options.accountId)
        : inArray(emailThread.emailAccountId, accountIds),
    ];
    if (threadIdsWithLabel) {
      conditions.push(inArray(emailThread.emailThreadId, threadIdsWithLabel));
    }

    if (options.folder === "drafts") {
      const draftLabelRows = await db
        .select({ emailLabelId: emailLabel.emailLabelId })
        .from(emailLabel)
        .where(
          and(
            options.accountId ? eq(emailLabel.emailAccountId, options.accountId) : undefined,
            or(
              ilike(emailLabel.name, "draft%"),
              ilike(emailLabel.name, "entwurf%"),
              ilike(emailLabel.name, "entwürfe%"),
              ilike(emailLabel.providerLabelId, "draft%"),
            ),
          ),
        );
      const draftLabelIds = draftLabelRows.map((r) => r.emailLabelId);

      const draftConditions = [eq(emailMessage.direction, "draft")];
      if (draftLabelIds.length > 0) {
        draftConditions.push(inArray(emailMessageLabel.emailLabelId, draftLabelIds));
      }

      const rows = await db
        .selectDistinct({
          emailThreadId: emailMessage.emailThreadId,
        })
        .from(emailMessage)
        .leftJoin(
          emailMessageLabel,
          eq(emailMessageLabel.emailMessageId, emailMessage.emailMessageId),
        )
        .where(
          and(
            options.accountId ? eq(emailMessage.emailAccountId, options.accountId) : undefined,
            or(...draftConditions),
          ),
        );
      const draftThreadIds = rows.map((r) => r.emailThreadId);
      if (draftThreadIds.length === 0) return [];
      conditions.push(inArray(emailThread.emailThreadId, draftThreadIds));
    } else if (options.folder === "sent") {
      const sentLabelRows = await db
        .select({ emailLabelId: emailLabel.emailLabelId })
        .from(emailLabel)
        .where(
          and(
            options.accountId ? eq(emailLabel.emailAccountId, options.accountId) : undefined,
            or(
              ilike(emailLabel.name, "sent%"),
              ilike(emailLabel.name, "gesendet%"),
              ilike(emailLabel.providerLabelId, "sent%"),
            ),
          ),
        );
      const sentLabelIds = sentLabelRows.map((r) => r.emailLabelId);

      const sentConditions = [eq(emailMessage.direction, "outbound")];
      if (sentLabelIds.length > 0) {
        sentConditions.push(inArray(emailMessageLabel.emailLabelId, sentLabelIds));
      }

      const rows = await db
        .selectDistinct({
          emailThreadId: emailMessage.emailThreadId,
        })
        .from(emailMessage)
        .leftJoin(
          emailMessageLabel,
          eq(emailMessageLabel.emailMessageId, emailMessage.emailMessageId),
        )
        .where(
          and(
            options.accountId ? eq(emailMessage.emailAccountId, options.accountId) : undefined,
            or(...sentConditions),
          ),
        );
      const sentThreadIds = rows.map((r) => r.emailThreadId);
      if (sentThreadIds.length === 0) return [];
      conditions.push(inArray(emailThread.emailThreadId, sentThreadIds));
    } else if (options.folder === "inbox") {
      const inboxLabelRows = await db
        .select({ emailLabelId: emailLabel.emailLabelId })
        .from(emailLabel)
        .where(
          and(
            options.accountId ? eq(emailLabel.emailAccountId, options.accountId) : undefined,
            or(
              ilike(emailLabel.name, "inbox"),
              ilike(emailLabel.name, "posteingang"),
              ilike(emailLabel.providerLabelId, "inbox"),
            ),
          ),
        );
      const inboxLabelIds = inboxLabelRows.map((r) => r.emailLabelId);

      const inboxConditions = [eq(emailMessage.direction, "inbound")];
      if (inboxLabelIds.length > 0) {
        inboxConditions.push(inArray(emailMessageLabel.emailLabelId, inboxLabelIds));
      }

      const rows = await db
        .selectDistinct({
          emailThreadId: emailMessage.emailThreadId,
        })
        .from(emailMessage)
        .leftJoin(
          emailMessageLabel,
          eq(emailMessageLabel.emailMessageId, emailMessage.emailMessageId),
        )
        .where(
          and(
            options.accountId ? eq(emailMessage.emailAccountId, options.accountId) : undefined,
            or(...inboxConditions),
          ),
        );
      const inboxThreadIds = rows.map((r) => r.emailThreadId);
      if (inboxThreadIds.length === 0) return [];
      conditions.push(inArray(emailThread.emailThreadId, inboxThreadIds));
    }

    if (options.search) {
      conditions.push(
        or(
          ilike(emailThread.subject, `%${options.search}%`),
          ilike(emailThread.snippet, `%${options.search}%`),
        ),
      );
    }

    const query = db
      .select()
      .from(emailThread)
      .where(and(...conditions))
      .orderBy(desc(emailThread.lastMessageAt), desc(emailThread.createdAt))
      .limit(options.limit ?? 50);

    if (options.offset !== undefined) {
      query.offset(options.offset);
    }

    const threads = await query;
    if (threads.length === 0) return [];

    const threadIds = threads.map((t) => t.emailThreadId);

    // Fetch messages to derive senders and attachment indicators
    const messages = await db
      .select({
        emailThreadId: emailMessage.emailThreadId,
        fromJson: emailMessage.fromJson,
        direction: emailMessage.direction,
        hasAttachments: emailMessage.hasAttachments,
      })
      .from(emailMessage)
      .where(inArray(emailMessage.emailThreadId, threadIds))
      .orderBy(emailMessage.receivedAt, emailMessage.sentAt, emailMessage.createdAt);

    // Fetch distinct labels for these threads
    const threadLabels = await db
      .select({
        emailThreadId: emailMessage.emailThreadId,
        emailLabelId: emailLabel.emailLabelId,
        providerLabelId: emailLabel.providerLabelId,
        name: emailLabel.name,
        color: emailLabel.color,
        kind: emailLabel.kind,
      })
      .from(emailMessageLabel)
      .innerJoin(emailMessage, eq(emailMessage.emailMessageId, emailMessageLabel.emailMessageId))
      .innerJoin(emailLabel, eq(emailLabel.emailLabelId, emailMessageLabel.emailLabelId))
      .where(inArray(emailMessage.emailThreadId, threadIds));

    const getSenderName = (fromJson: any, direction: string) => {
      if (direction === "outbound" || direction === "draft") return "me";
      if (!fromJson || typeof fromJson !== "object") return "Unknown";
      const name = fromJson.name || fromJson.displayName;
      if (name && typeof name === "string") return name.trim();
      const email = fromJson.email;
      if (email && typeof email === "string") return email;
      return "Unknown";
    };

    // Build Maps once — O(n) instead of O(threads × messages/labels) filter-in-map
    const messagesByThread = new Map<string, typeof messages>();
    for (const msg of messages) {
      const bucket = messagesByThread.get(msg.emailThreadId) ?? [];
      bucket.push(msg);
      messagesByThread.set(msg.emailThreadId, bucket);
    }

    const labelsByThread = new Map<string, Map<string, (typeof threadLabels)[number]>>();
    for (const lbl of threadLabels) {
      let byId = labelsByThread.get(lbl.emailThreadId);
      if (!byId) {
        byId = new Map();
        labelsByThread.set(lbl.emailThreadId, byId);
      }
      if (!byId.has(lbl.emailLabelId)) byId.set(lbl.emailLabelId, lbl);
    }

    return threads.map((t) => {
      const threadMessages = messagesByThread.get(t.emailThreadId) ?? [];
      const senders: string[] = [];
      let hasAttachments = false;

      for (const msg of threadMessages) {
        const name = getSenderName(msg.fromJson, msg.direction);
        if (!senders.includes(name)) {
          senders.push(name);
        }
        if (msg.hasAttachments) {
          hasAttachments = true;
        }
      }

      const senderDisplay = senders.join(", ") || "Unknown";

      const labels = Array.from(labelsByThread.get(t.emailThreadId)?.values() ?? []).map((lbl) => ({
        emailLabelId: lbl.emailLabelId,
        providerLabelId: lbl.providerLabelId,
        name: lbl.name,
        color: lbl.color,
        kind: lbl.kind,
      }));

      return {
        ...t,
        senderDisplay,
        hasAttachments,
        labels,
      };
    });
  }

  async listLabels(accountId: string) {
    await this.accountService.assertGrant(accountId, "read");
    return await db
      .select()
      .from(emailLabel)
      .where(and(eq(emailLabel.emailAccountId, accountId), eq(emailLabel.archived, false)))
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
      .where(eq(emailSyncState.emailAccountId, accountId))
      .orderBy(emailSyncState.scope);
  }

  async getThread(threadId: string) {
    const [thread] = await db
      .select()
      .from(emailThread)
      .where(and(eq(emailThread.emailThreadId, threadId), eq(emailThread.archived, false)))
      .limit(1);
    if (!thread) return null;

    await this.accountService.assertGrant(thread.emailAccountId, "read");
    const messages = await db
      .select()
      .from(emailMessage)
      .where(eq(emailMessage.emailThreadId, threadId))
      .orderBy(emailMessage.receivedAt, emailMessage.sentAt, emailMessage.createdAt);
    const messageIds = messages.map((message) => message.emailMessageId);
    const attachments = messageIds.length
      ? await db
          .select()
          .from(emailAttachment)
          .where(inArray(emailAttachment.emailMessageId, messageIds))
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
          .innerJoin(emailLabel, eq(emailLabel.emailLabelId, emailMessageLabel.emailLabelId))
          .where(inArray(emailMessageLabel.emailMessageId, messageIds))
      : [];
    return { ...thread, messages, attachments, labels };
  }

  async listMessageAttachments(messageId: string) {
    const [message] = await db
      .select({
        emailAccountId: emailMessage.emailAccountId,
      })
      .from(emailMessage)
      .where(eq(emailMessage.emailMessageId, messageId))
      .limit(1);
    if (!message) return null;

    await this.accountService.assertGrant(message.emailAccountId, "read");
    return await db
      .select()
      .from(emailAttachment)
      .where(eq(emailAttachment.emailMessageId, messageId))
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
      .where(eq(emailAttachment.emailAttachmentId, attachmentId));

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
        .where(eq(emailThread.emailThreadId, threadId));
      await tx
        .update(emailMessage)
        .set({ isRead: read, updatedAt: new Date() })
        .where(eq(emailMessage.emailThreadId, threadId));
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
      .where(eq(emailMessage.emailThreadId, threadId));

    for (const message of messages) {
      await db
        .insert(emailMessageLabel)
        .values({
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
      .where(eq(emailThread.emailThreadId, threadId));
    return { ok: true };
  }

  async linkThread(
    threadId: string,
    link: { addressId?: string | null; documentId?: string | null },
  ) {
    const [thread] = await db
      .select()
      .from(emailThread)
      .where(eq(emailThread.emailThreadId, threadId))
      .limit(1);
    if (!thread) return null;
    await this.accountService.assertGrant(thread.emailAccountId, "read");

    const patch: Partial<typeof emailThread.$inferInsert> = { updatedAt: new Date() };
    if (link.addressId !== undefined) patch.relatedAddressId = link.addressId;
    if (link.documentId !== undefined) patch.relatedDocumentId = link.documentId;

    const [updated] = await db
      .update(emailThread)
      .set(patch)
      .where(eq(emailThread.emailThreadId, threadId))
      .returning();
    return updated ?? null;
  }

  async syncContactsForAccount(accountId: string) {
    const [account] = await db
      .select({
        emailAccountId: emailAccount.emailAccountId,
        provider: emailAccount.provider,
        credentialsEncrypted: emailAccount.credentialsEncrypted,
      })
      .from(emailAccount)
      .where(
        and(eq(emailAccount.tenantId, this.tenantId), eq(emailAccount.emailAccountId, accountId)),
      )
      .limit(1);
    if (!account) throw new Error("Account not found");

    const adapter = createEmailProviderAdapter(account.provider as any);
    const contacts = await adapter.syncContacts(account.credentialsEncrypted);
    await this.persistUpdatedCredentials(account.emailAccountId, adapter);

    for (const contact of contacts) {
      if (!contact.email) continue;
      const normalizedEmail = contact.email.toLowerCase();

      await db.transaction(async (tx) => {
        const [existingIdentity] = await tx
          .select({
            identityId: addressContactIdentity.identityId,
            contactId: addressContactIdentity.contactId,
          })
          .from(addressContactIdentity)
          .where(eq(addressContactIdentity.normalizedValue, normalizedEmail))
          .limit(1);

        if (existingIdentity) {
          await tx
            .update(addressContactIdentity)
            .set({
              value: contact.email,
              sourceObjectId: contact.id,
              sourceAccountId: accountId,
              updatedAt: new Date(),
            })
            .where(eq(addressContactIdentity.identityId, existingIdentity.identityId));
          return;
        }

        const [existingContact] = await tx
          .select({ contactId: addressContact.contactId })
          .from(addressContact)
          .where(sql`lower(${addressContact.email}) = ${normalizedEmail}`)
          .limit(1);

        let contactId = existingContact?.contactId;

        if (!contactId) {
          const [newContact] = await tx
            .insert(addressContact)
            .values({
              tenantId: this.tenantId,
              email: contact.email,
              firstName: contact.firstName,
              lastName:
                contact.lastName || contact.displayName || contact.email.split("@")[0] || "Unknown",
              displayName: contact.displayName,
              isPrimary: false,
              archived: false,
            })
            .returning({ contactId: addressContact.contactId });
          if (!newContact) return;
          contactId = newContact.contactId;
        }

        await tx.insert(addressContactIdentity).values({
          tenantId: this.tenantId,
          contactId: contactId,
          sourceSystem: account.provider,
          sourceAccountId: accountId,
          sourceObjectId: contact.id,
          identityType: "email",
          value: contact.email,
          normalizedValue: normalizedEmail,
          isPrimary: false,
          isVerified: true,
        });
      });
    }
  }

  async trashThread(threadId: string) {
    const thread = await this.getThread(threadId);
    if (!thread) return null;
    await this.accountService.assertGrant(thread.emailAccountId, "read");

    // Sicherheits-Check: Verhindere Löschen, wenn mit ERP-Daten verknüpft
    if (thread.relatedDocumentId || thread.relatedAddressId) {
      throw new Error(
        "Dieser Thread ist mit ERP-Daten verknüpft und kann nicht gelöscht werden. Lösen Sie zuerst die Verknüpfung im Inspector.",
      );
    }

    const account = await this.accountService.getAccountForProvider(
      thread.emailAccountId,
      "manage",
    );
    if (!account) return null;
    const adapter = createEmailProviderAdapter(account.provider as any);
    for (const message of thread.messages) {
      await adapter.moveToTrash(account.credentialsEncrypted, message.providerMessageId);
    }
    await this.persistUpdatedCredentials(account.emailAccountId, adapter);
    await db
      .update(emailThread)
      .set({ archived: false, inTrash: true, updatedAt: new Date() })
      .where(eq(emailThread.emailThreadId, threadId));
    return { ok: true };
  }

  async executeJob(jobType: string, emailAccountId: string, payload: any) {
    const account = await this.accountService.getAccountForProvider(
      emailAccountId,
      jobType === "send" ? "send" : "read",
    );
    if (!account) {
      throw new Error("Email account is unavailable");
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
        .where(eq(emailAccount.emailAccountId, account.emailAccountId));

      if (jobType === "initial_sync" || jobType === "reconcile") {
        const cursor = typeof (payload as any).cursor === "string" ? (payload as any).cursor : null;
        const page = await adapter.fullSyncPage(account.credentialsEncrypted, cursor);
        await this.persistUpdatedCredentials(account.emailAccountId, adapter);
        await this.mergeSyncPage(account.emailAccountId, page, "mailbox");
        if (page.hasMore && page.nextCursor) {
          await this.jobService.enqueue({
            jobType: jobType as any,
            emailAccountId: account.emailAccountId,
            idempotencyKey: `${jobType}:${account.emailAccountId}:mailbox:${page.nextCursor}`,
            payload: { scope: "mailbox", cursor: page.nextCursor },
          });
        }
      } else if (jobType === "incremental_sync") {
        const [state] = await db
          .select()
          .from(emailSyncState)
          .where(
            and(
              eq(emailSyncState.emailAccountId, account.emailAccountId),
              eq(emailSyncState.scope, "mailbox"),
            ),
          )
          .limit(1);
        const payloadCursor =
          typeof (payload as any).cursor === "string" ? (payload as any).cursor : null;
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
            .where(eq(emailAccount.emailAccountId, account.emailAccountId));
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
          } else {
            await this.scheduleNextIncrementalSync(account.emailAccountId);
          }
        }
      } else if (jobType === "watch_renewal") {
        const callbackUrl =
          typeof (payload as any).callbackUrl === "string" ? (payload as any).callbackUrl : "";
        const channelToken =
          typeof (payload as any).channelToken === "string" ? (payload as any).channelToken : null;
        const result = await adapter.renewWatch(account.credentialsEncrypted, callbackUrl);
        await this.persistUpdatedCredentials(account.emailAccountId, adapter);
        await db
          .update(emailAccount)
          .set({ watchExpiresAt: result.expiresAt, updatedAt: new Date() })
          .where(eq(emailAccount.emailAccountId, account.emailAccountId));
        const subscriptionService = new EmailSubscriptionService(this.tenantId);
        await subscriptionService.registerSubscription({
          emailAccountId: account.emailAccountId,
          resource: "mail",
          providerSubscriptionId: result.subscriptionId ?? null,
          channelToken: channelToken ?? result.channelToken ?? null,
          expiresAt: result.expiresAt ?? null,
        });
      } else if (jobType === "send") {
        const outboxId =
          typeof (payload as any).outboxId === "string" ? (payload as any).outboxId : null;
        if (!outboxId) throw new Error("send job missing outboxId");
        const sendService = new EmailSendService(this.tenantId, this.userId);
        try {
          await sendService.markSending(outboxId);
          await sendService.sendDraft(outboxId);
        } catch (error) {
          await sendService.markFailed(outboxId, error);
          throw error;
        }
      } else if (jobType === "fetch_attachment") {
        const attachmentId =
          typeof (payload as any).attachmentId === "string" ? (payload as any).attachmentId : null;
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
        .where(eq(emailAccount.emailAccountId, account.emailAccountId));
      return { ok: true, recoveryRequired };
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
        .where(eq(emailAccount.emailAccountId, account.emailAccountId));
      throw error;
    }
  }

  async runJob(jobId: string, timeoutMs = 300_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const state = await this.jobService.get(jobId);
      if (!state) return null;
      if (state.status === "done" || state.status === "failed") {
        return { ok: state.status === "done", recoveryRequired: false, job: state };
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    return { ok: false, recoveryRequired: false, job: null, timedOut: true };
  }

  private async scheduleNextIncrementalSync(accountId: string) {
    const [row] = await db
      .select({ activityTier: emailAccount.activityTier, syncPriority: emailAccount.syncPriority })
      .from(emailAccount)
      .where(eq(emailAccount.emailAccountId, accountId))
      .limit(1);

    const rawTier = row?.activityTier ?? "cold";
    const syncPriority = row?.syncPriority ?? "normal";

    // syncPriority floors/ceilings: high accounts never go below warm; low accounts cap at cold
    const effectiveTier =
      syncPriority === "high"
        ? rawTier === "dormant" || rawTier === "cold"
          ? "warm"
          : rawTier
        : syncPriority === "low"
          ? rawTier === "hot"
            ? "warm"
            : rawTier
          : rawTier;

    const intervalMinutes = TIER_INTERVALS_MINUTES[effectiveTier] ?? 360;
    const runAfter = new Date(Date.now() + intervalMinutes * 60 * 1000);
    const priority = activityTierPriority(effectiveTier);

    await this.jobService.enqueue({
      jobType: "incremental_sync",
      emailAccountId: accountId,
      idempotencyKey: `incremental_sync:${accountId}:mailbox:next:${runAfter.toISOString()}`,
      payload: { scope: "mailbox" },
      runAfter,
      priority,
    });
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
      .where(eq(emailAccount.emailAccountId, accountId));
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

    if (!threadRow.relatedAddressId) {
      const matchedAddressId = await this.matchRelatedAddressId(tx, thread.messages);
      if (matchedAddressId) {
        await tx
          .update(emailThread)
          .set({ relatedAddressId: matchedAddressId, updatedAt: new Date() })
          .where(
            and(
              eq(emailThread.tenantId, this.tenantId),
              eq(emailThread.emailThreadId, threadRow.emailThreadId),
              isNull(emailThread.relatedAddressId),
            ),
          );
        threadRow.relatedAddressId = matchedAddressId;
      }
    }

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

  private async matchRelatedAddressId(tx: any, messages: ProviderThread["messages"]) {
    for (const message of messages) {
      if (message.direction !== "inbound") continue;
      const fromEmail = extractEmailAddress(message.from);
      if (!fromEmail) continue;

      const [contact] = await tx
        .select({
          addressId: addressContact.addressId,
        })
        .from(addressContact)
        .where(
          and(
            eq(addressContact.archived, false),
            sql`lower(${addressContact.email}) = ${fromEmail}`,
          ),
        )
        .orderBy(desc(addressContact.isPrimary), desc(addressContact.createdAt))
        .limit(1);

      if (contact?.addressId) return contact.addressId;
    }

    return null;
  }
}
