import type {
  EmailDraftInput,
  EmailProvider,
  IncrementalSyncResult,
  ProviderDraftResult,
  ProviderLabel,
  ProviderSendResult,
  SyncPage,
} from "./types";

export interface ProviderContact {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
}

export interface EmailProviderConnection {
  provider: EmailProvider;
  providerAccountId: string;
  displayName: string;
  primaryEmail: string;
  encryptedCredentials: string;
  scopes: string[];
  identities?: Array<{
    providerIdentityId?: string | null;
    email: string;
    displayName?: string | null;
    isPrimary?: boolean;
    canSend?: boolean;
  }>;
}

export interface EmailProviderAdapter {
  readonly provider: EmailProvider;
  connect(input: Record<string, unknown>): Promise<EmailProviderConnection>;
  listLabels(credentialsEncrypted: string): Promise<ProviderLabel[]>;
  fullSyncPage(credentialsEncrypted: string, cursor?: string | null): Promise<SyncPage>;
  incrementalSync(
    credentialsEncrypted: string,
    cursor?: string | null,
  ): Promise<IncrementalSyncResult>;
  renewWatch(
    credentialsEncrypted: string,
    callbackUrl: string,
  ): Promise<{ expiresAt: Date; subscriptionId?: string | null; channelToken?: string | null }>;
  createDraft(credentialsEncrypted: string, draft: EmailDraftInput): Promise<ProviderDraftResult>;
  sendDraft(credentialsEncrypted: string, providerDraftId: string): Promise<ProviderSendResult>;
  sendMessage(credentialsEncrypted: string, draft: EmailDraftInput): Promise<ProviderSendResult>;
  modifyLabels(
    credentialsEncrypted: string,
    providerMessageId: string,
    changes: { addProviderLabelIds?: string[]; removeProviderLabelIds?: string[] },
  ): Promise<void>;
  markRead(credentialsEncrypted: string, providerMessageId: string, read: boolean): Promise<void>;
  moveToTrash(credentialsEncrypted: string, providerMessageId: string): Promise<void>;
  fetchAttachment(
    credentialsEncrypted: string,
    providerMessageId: string,
    providerAttachmentId: string,
  ): Promise<{ contentType?: string | null; bytes: Uint8Array }>;
  syncContacts(credentialsEncrypted: string): Promise<ProviderContact[]>;
  consumeUpdatedCredentials?(): string | null;
}

export class ProviderConfigurationError extends Error {
  constructor(provider: EmailProvider, operation: string) {
    super(`${provider} adapter is not configured for ${operation}`);
    this.name = "ProviderConfigurationError";
  }
}

export class ProviderOAuthError extends Error {
  constructor(provider: EmailProvider, message: string) {
    super(`${provider} OAuth failed: ${message}`);
    this.name = "ProviderOAuthError";
  }
}

export class ProviderReauthRequiredError extends Error {
  constructor(provider: EmailProvider, message: string) {
    super(`${provider} reauthorization required: ${message}`);
    this.name = "ProviderReauthRequiredError";
  }
}
