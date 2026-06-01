export type EmailProvider = "gmail" | "microsoft";
export type EmailDirection = "inbound" | "outbound" | "draft";
export type EmailAccountStatus = "connected" | "reauth_required" | "disabled" | "error";
export type EmailSyncStatus = "idle" | "queued" | "syncing" | "ok" | "error" | "recovery_required";

export type EmailJobType =
  | "initial_sync"
  | "incremental_sync"
  | "watch_renewal"
  | "reconcile"
  | "send"
  | "fetch_attachment";

export interface EmailAddress {
  email: string;
  name?: string | null;
}

export interface EmailDraftInput {
  accountId: string;
  identityId: string;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  subject: string;
  bodyHtml?: string | null;
  bodyText?: string | null;
  /** If set, the created thread will be linked to this document ID */
  relatedDocumentId?: string | null;
  /** If set, the created thread will be linked to this address ID */
  relatedAddressId?: string | null;
  attachments?: Array<{
    fileName: string;
    contentType?: string | null;
    providerAttachmentId?: string | null;
    storageKey?: string | null;
    sizeBytes?: number | null;
    inlineContentId?: string | null;
  }>;
}

export interface ProviderLabel {
  providerLabelId: string;
  name: string;
  kind: "system" | "folder" | "label";
  color?: string | null;
  parentProviderLabelId?: string | null;
  messageCount?: number;
  unreadCount?: number;
}

export interface ProviderMessage {
  providerMessageId: string;
  providerThreadId: string;
  providerDraftId?: string | null;
  internetMessageId?: string | null;
  direction: EmailDirection;
  from: EmailAddress | Record<string, unknown>;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  subject?: string | null;
  snippet?: string | null;
  bodyHtml?: string | null;
  bodyText?: string | null;
  sentAt?: Date | string | null;
  receivedAt?: Date | string | null;
  isRead?: boolean;
  hasAttachments?: boolean;
  rawHeaders?: Record<string, unknown>;
  providerLabelIds?: string[];
  attachments?: Array<{
    providerAttachmentId?: string | null;
    fileName: string;
    contentType?: string | null;
    sizeBytes?: number | null;
    storageKey?: string | null;
    inlineContentId?: string | null;
  }>;
}

export interface ProviderThread {
  providerThreadId: string;
  subject?: string | null;
  snippet?: string | null;
  lastMessageAt?: Date | string | null;
  isRead?: boolean;
  isStarred?: boolean;
  messages: ProviderMessage[];
}

export interface SyncPage {
  threads: ProviderThread[];
  labels?: ProviderLabel[];
  nextCursor?: string | null;
  hasMore?: boolean;
}

export interface IncrementalSyncResult extends SyncPage {
  recoveryRequired?: boolean;
}

export interface ProviderDraftResult {
  providerDraftId: string;
  providerMessageId?: string | null;
}

export interface ProviderSendResult {
  providerMessageId: string;
  providerThreadId?: string | null;
  sentAt?: Date | string | null;
}
