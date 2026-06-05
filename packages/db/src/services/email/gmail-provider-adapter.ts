import { decryptEmailCredentials, encryptEmailCredentials } from "./credential-crypto";
import { buildMimeMessage, decodeBase64Url, rawMessage } from "./mime";
import {
  type EmailProviderAdapter,
  type EmailProviderConnection,
  ProviderConfigurationError,
  ProviderOAuthError,
  ProviderReauthRequiredError,
} from "./provider-adapter";
import type {
  EmailDraftInput,
  IncrementalSyncResult,
  ProviderDraftResult,
  ProviderLabel,
  ProviderSendResult,
  SyncPage,
} from "./types";

const GMAIL_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.labels",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
];

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleUserInfo = {
  sub?: string;
  email?: string;
  name?: string;
};

type GmailSendAs = {
  sendAsEmail?: string;
  displayName?: string;
  isPrimary?: boolean;
  verificationStatus?: string;
};

type GmailCredentialBundle = {
  provider: "gmail";
  token: GoogleTokenResponse;
  obtainedAt?: string;
};

type GmailLabel = {
  id: string;
  name: string;
  type?: string;
  messagesTotal?: number;
  messagesUnread?: number;
  color?: { backgroundColor?: string };
};

type GmailMessagePart = {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: Array<{ name: string; value: string }>;
  body?: { size?: number; data?: string; attachmentId?: string };
  parts?: GmailMessagePart[];
};

type GmailMessage = {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  historyId?: string;
  internalDate?: string;
  payload?: GmailMessagePart;
};

type GmailThread = {
  id: string;
  messages?: GmailMessage[];
};

type GmailHistoryResponse = {
  history?: Array<{
    messagesAdded?: Array<{ message?: { id?: string; threadId?: string } }>;
    labelsAdded?: Array<{ message?: { id?: string; threadId?: string } }>;
    labelsRemoved?: Array<{ message?: { id?: string; threadId?: string } }>;
  }>;
  historyId?: string;
  nextPageToken?: string;
  error?: { message?: string };
};

function jsonCursor(value: string | null | undefined): Record<string, string> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : { historyId: value };
  } catch {
    return { historyId: value };
  }
}

function header(part: GmailMessagePart | undefined, name: string) {
  return part?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? null;
}

function parseAddress(value: string | null) {
  if (!value) return { email: "" };
  const match = value.match(/^(?:"?([^"<]*)"?)?\s*<([^>]+)>$/);
  if (match) return { name: match[1]?.trim() || null, email: match[2].trim() };
  return { email: value.split(",")[0]?.trim() ?? value };
}

function parseAddressList(value: string | null) {
  if (!value) return [];
  return value
    .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
    .map((item) => parseAddress(item.trim()))
    .filter((item) => item.email);
}

function decodePartData(value?: string) {
  if (!value) return null;
  return Buffer.from(value, "base64url").toString("utf8");
}

function walkParts(part: GmailMessagePart | undefined, visit: (part: GmailMessagePart) => void) {
  if (!part) return;
  visit(part);
  for (const child of part.parts ?? []) walkParts(child, visit);
}

function messageBodies(message: GmailMessage) {
  let html: string | null = null;
  let text: string | null = null;
  walkParts(message.payload, (part) => {
    if (part.filename) return;
    if (!html && part.mimeType === "text/html") html = decodePartData(part.body?.data);
    if (!text && part.mimeType === "text/plain") text = decodePartData(part.body?.data);
  });
  return { html, text };
}

function messageAttachments(message: GmailMessage) {
  const attachments: NonNullable<import("./types").ProviderMessage["attachments"]> = [];
  walkParts(message.payload, (part) => {
    if (!part.filename || !part.body?.attachmentId) return;
    attachments.push({
      providerAttachmentId: part.body.attachmentId,
      fileName: part.filename,
      contentType: part.mimeType ?? null,
      sizeBytes: part.body.size ?? null,
      inlineContentId: header(part, "Content-ID")?.replace(/[<>]/g, "") ?? null,
    });
  });
  return attachments;
}

function mapLabelKind(label: GmailLabel): ProviderLabel["kind"] {
  if (label.type === "system") return "system";
  return "label";
}

async function readJsonResponse<T>(res: Response): Promise<T | undefined> {
  const text = await res.text();
  if (!text.trim()) return undefined;
  return JSON.parse(text) as T;
}

function isOutbound(labelIds: string[] | undefined) {
  return Boolean(labelIds?.some((label) => label === "SENT"));
}

function isDraft(labelIds: string[] | undefined) {
  return Boolean(labelIds?.some((label) => label === "DRAFT"));
}

function mapMessage(message: GmailMessage) {
  const bodies = messageBodies(message);
  const subject = header(message.payload, "Subject");
  const dateHeader = header(message.payload, "Date");
  const date = dateHeader
    ? new Date(dateHeader)
    : new Date(Number(message.internalDate ?? Date.now()));
  return {
    providerMessageId: message.id,
    providerThreadId: message.threadId,
    internetMessageId: header(message.payload, "Message-ID"),
    direction: isDraft(message.labelIds)
      ? "draft"
      : isOutbound(message.labelIds)
        ? "outbound"
        : "inbound",
    from: parseAddress(header(message.payload, "From")),
    to: parseAddressList(header(message.payload, "To")),
    cc: parseAddressList(header(message.payload, "Cc")),
    bcc: parseAddressList(header(message.payload, "Bcc")),
    subject,
    snippet: message.snippet ?? null,
    bodyHtml: bodies.html,
    bodyText: bodies.text,
    sentAt: isOutbound(message.labelIds) ? date : null,
    receivedAt: !isOutbound(message.labelIds) ? date : null,
    isRead: !message.labelIds?.includes("UNREAD"),
    hasAttachments: messageAttachments(message).length > 0,
    rawHeaders: Object.fromEntries((message.payload?.headers ?? []).map((h) => [h.name, h.value])),
    providerLabelIds: message.labelIds ?? [],
    attachments: messageAttachments(message),
  } satisfies import("./types").ProviderMessage;
}

export class GmailProviderAdapter implements EmailProviderAdapter {
  readonly provider = "gmail" as const;
  private updatedCredentialsEncrypted: string | null = null;

  consumeUpdatedCredentials() {
    const value = this.updatedCredentialsEncrypted;
    this.updatedCredentialsEncrypted = null;
    return value;
  }

  private async accessToken(credentialsEncrypted: string) {
    const bundle = decryptEmailCredentials<GmailCredentialBundle>(credentialsEncrypted);
    if (bundle.token.access_token) return bundle.token.access_token;
    return await this.refreshAccessToken(bundle);
  }

  private async refreshAccessToken(bundle: GmailCredentialBundle) {
    const clientId = process.env.GMAIL_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET ?? process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = bundle.token.refresh_token;
    if (!clientId || !clientSecret)
      throw new ProviderConfigurationError(this.provider, "OAuth refresh");
    if (!refreshToken)
      throw new ProviderReauthRequiredError(this.provider, "missing refresh token");

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    const token = (await readJsonResponse<GoogleTokenResponse>(res)) ?? {};
    if (!res.ok || token.error || !token.access_token) {
      throw new ProviderReauthRequiredError(
        this.provider,
        token.error_description ?? token.error ?? res.statusText,
      );
    }
    bundle.token = { ...bundle.token, ...token, refresh_token: refreshToken };
    this.updatedCredentialsEncrypted = encryptEmailCredentials(bundle);
    return token.access_token;
  }

  private async request<T>(credentialsEncrypted: string, path: string, init: RequestInit = {}) {
    const token = await this.accessToken(credentialsEncrypted);
    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        ...init.headers,
      },
    });
    if (res.status === 401) {
      const refreshed = await this.refreshAccessToken(
        decryptEmailCredentials<GmailCredentialBundle>(credentialsEncrypted),
      );
      const retry = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
        ...init,
        headers: {
          authorization: `Bearer ${refreshed}`,
          "content-type": "application/json",
          ...init.headers,
        },
      });
      if (!retry.ok) throw new Error(`Gmail API ${retry.status}: ${await retry.text()}`);
      return (await readJsonResponse<T>(retry)) as T;
    }
    if (!res.ok) throw new Error(`Gmail API ${res.status}: ${await res.text()}`);
    return (await readJsonResponse<T>(res)) as T;
  }

  // fallow-ignore-next-line unused-class-member
  async connect(input: Record<string, unknown>): Promise<EmailProviderConnection> {
    const clientId = process.env.GMAIL_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET ?? process.env.GOOGLE_CLIENT_SECRET;
    const code = typeof input.code === "string" ? input.code : "";
    const redirectUri = typeof input.redirectUri === "string" ? input.redirectUri : "";

    if (!clientId || !clientSecret)
      throw new ProviderConfigurationError(this.provider, "OAuth connect");
    if (!code || !redirectUri)
      throw new ProviderOAuthError(this.provider, "missing authorization code");

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });
    const token = (await readJsonResponse<GoogleTokenResponse>(tokenRes)) ?? {};
    if (!tokenRes.ok || token.error || !token.access_token) {
      throw new ProviderOAuthError(
        this.provider,
        token.error_description ?? token.error ?? tokenRes.statusText,
      );
    }

    const userInfoResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { authorization: `Bearer ${token.access_token}` },
    });
    const userInfo = (await readJsonResponse<GoogleUserInfo>(userInfoResponse)) ?? {};

    const sendAsResponse = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs",
      {
        headers: { authorization: `Bearer ${token.access_token}` },
      },
    );
    const sendAs = (sendAsResponse.ok
      ? await readJsonResponse<{ sendAs?: GmailSendAs[] }>(sendAsResponse)
      : null) ?? { sendAs: [] as GmailSendAs[] };

    const primaryEmail =
      userInfo.email ?? sendAs.sendAs?.find((identity) => identity.isPrimary)?.sendAsEmail;
    if (!primaryEmail)
      throw new ProviderOAuthError(this.provider, "provider did not return an email");

    const scopes = token.scope?.split(/\s+/).filter(Boolean) ?? GMAIL_SCOPES;
    return {
      provider: this.provider,
      providerAccountId: userInfo.sub ?? primaryEmail,
      displayName: userInfo.name ?? primaryEmail,
      primaryEmail,
      encryptedCredentials: encryptEmailCredentials({
        provider: this.provider,
        primaryEmail,
        token,
        obtainedAt: new Date().toISOString(),
      }),
      scopes,
      identities: (sendAs.sendAs?.length
        ? sendAs.sendAs
        : [{ sendAsEmail: primaryEmail, isPrimary: true }]
      )
        .filter((identity) => identity.sendAsEmail)
        .map((identity) => ({
          providerIdentityId: identity.sendAsEmail ?? null,
          email: identity.sendAsEmail ?? primaryEmail,
          displayName: identity.displayName || userInfo.name || null,
          isPrimary: Boolean(identity.isPrimary || identity.sendAsEmail === primaryEmail),
          canSend: identity.verificationStatus ? identity.verificationStatus === "accepted" : true,
        })),
    };
  }

  async listLabels(credentialsEncrypted: string): Promise<ProviderLabel[]> {
    const result = await this.request<{ labels?: GmailLabel[] }>(credentialsEncrypted, "/labels");
    return (result.labels ?? []).map((label) => ({
      providerLabelId: label.id,
      name: label.name,
      kind: mapLabelKind(label),
      color: label.color?.backgroundColor ?? null,
      messageCount: label.messagesTotal ?? 0,
      unreadCount: label.messagesUnread ?? 0,
    }));
  }

  async fullSyncPage(credentialsEncrypted: string, cursor?: string | null): Promise<SyncPage> {
    const parsed = jsonCursor(cursor);
    const pageToken = parsed.pageToken;
    const labels = await this.listLabels(credentialsEncrypted);
    const params = new URLSearchParams({ maxResults: "25" });
    if (pageToken) params.set("pageToken", pageToken);
    const result = await this.request<{ threads?: Array<{ id: string }>; nextPageToken?: string }>(
      credentialsEncrypted,
      `/threads?${params}`,
    );
    const threads = await Promise.all(
      (result.threads ?? []).map((thread) =>
        this.request<GmailThread>(credentialsEncrypted, `/threads/${thread.id}?format=full`),
      ),
    );
    const profile = result.nextPageToken
      ? null
      : await this.request<{ historyId?: string }>(credentialsEncrypted, "/profile");
    return {
      labels,
      threads: threads.map((thread) => {
        const messages = (thread.messages ?? []).map(mapMessage);
        return {
          providerThreadId: thread.id,
          subject: messages[0]?.subject ?? null,
          snippet: messages.at(-1)?.snippet ?? null,
          lastMessageAt: messages.at(-1)?.receivedAt ?? messages.at(-1)?.sentAt ?? null,
          isRead: messages.every((message) => message.isRead),
          isStarred: messages.some((message) => message.providerLabelIds?.includes("STARRED")),
          messages,
        };
      }),
      hasMore: Boolean(result.nextPageToken),
      nextCursor: result.nextPageToken
        ? JSON.stringify({ pageToken: result.nextPageToken })
        : profile?.historyId,
    };
  }

  async incrementalSync(
    credentialsEncrypted: string,
    cursor?: string | null,
  ): Promise<IncrementalSyncResult> {
    const parsed = jsonCursor(cursor);
    const historyId = parsed.historyId;
    if (!historyId) return await this.fullSyncPage(credentialsEncrypted, null);

    const params = new URLSearchParams({ startHistoryId: historyId, historyTypes: "messageAdded" });
    if (parsed.pageToken) params.set("pageToken", parsed.pageToken);
    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/history?${params}`, {
      headers: { authorization: `Bearer ${await this.accessToken(credentialsEncrypted)}` },
    });
    if (res.status === 404) return { threads: [], labels: [], recoveryRequired: true };
    if (!res.ok) throw new Error(`Gmail history ${res.status}: ${await res.text()}`);
    const result = (await res.json()) as GmailHistoryResponse;

    const messageIds = new Set<string>();
    for (const history of result.history ?? []) {
      for (const item of [
        ...(history.messagesAdded ?? []),
        ...(history.labelsAdded ?? []),
        ...(history.labelsRemoved ?? []),
      ]) {
        if (item.message?.id) messageIds.add(item.message.id);
      }
    }

    const messages = await Promise.all(
      [...messageIds].map((id) =>
        this.request<GmailMessage>(credentialsEncrypted, `/messages/${id}?format=full`),
      ),
    );
    const grouped = new Map<string, GmailMessage[]>();
    for (const message of messages) {
      grouped.set(message.threadId, [...(grouped.get(message.threadId) ?? []), message]);
    }

    return {
      labels: await this.listLabels(credentialsEncrypted),
      threads: [...grouped.entries()].map(([threadId, threadMessages]) => {
        const mapped = threadMessages.map(mapMessage);
        return {
          providerThreadId: threadId,
          subject: mapped[0]?.subject ?? null,
          snippet: mapped.at(-1)?.snippet ?? null,
          lastMessageAt: mapped.at(-1)?.receivedAt ?? mapped.at(-1)?.sentAt ?? null,
          isRead: mapped.every((message) => message.isRead),
          isStarred: mapped.some((message) => message.providerLabelIds?.includes("STARRED")),
          messages: mapped,
        };
      }),
      hasMore: Boolean(result.nextPageToken),
      nextCursor: result.nextPageToken
        ? JSON.stringify({ historyId, pageToken: result.nextPageToken })
        : (result.historyId ?? historyId),
    };
  }

  async renewWatch(
    credentialsEncrypted: string,
    _callbackUrl: string,
  ): Promise<{ expiresAt: Date }> {
    const topicName = process.env.GMAIL_PUBSUB_TOPIC;
    if (!topicName) throw new ProviderConfigurationError(this.provider, "watch renewal topic");
    const result = await this.request<{ expiration?: string }>(credentialsEncrypted, "/watch", {
      method: "POST",
      body: JSON.stringify({ topicName, labelIds: ["INBOX"], labelFilterBehavior: "include" }),
    });
    return {
      expiresAt: result.expiration
        ? new Date(Number(result.expiration))
        : new Date(Date.now() + 6 * 86400_000),
    };
  }

  async createDraft(
    credentialsEncrypted: string,
    draft: EmailDraftInput,
  ): Promise<ProviderDraftResult> {
    const raw = (await buildMimeMessage(rawMessage(draft, draft.identityId))).toString();
    const result = await this.request<{ id: string; message?: { id?: string } }>(
      credentialsEncrypted,
      "/drafts",
      {
        method: "POST",
        body: JSON.stringify({ message: { raw: Buffer.from(raw).toString("base64url") } }),
      },
    );
    return { providerDraftId: result.id, providerMessageId: result.message?.id ?? null };
  }

  async sendDraft(
    credentialsEncrypted: string,
    providerDraftId: string,
  ): Promise<ProviderSendResult> {
    const result = await this.request<{ id: string; threadId?: string }>(
      credentialsEncrypted,
      "/drafts/send",
      {
        method: "POST",
        body: JSON.stringify({ id: providerDraftId }),
      },
    );
    return {
      providerMessageId: result.id,
      providerThreadId: result.threadId ?? null,
      sentAt: new Date(),
    };
  }

  async sendMessage(
    credentialsEncrypted: string,
    draft: EmailDraftInput,
  ): Promise<ProviderSendResult> {
    const raw = (await buildMimeMessage(rawMessage(draft, draft.identityId))).toString();
    const result = await this.request<{ id: string; threadId?: string }>(
      credentialsEncrypted,
      "/messages/send",
      {
        method: "POST",
        body: JSON.stringify({ raw: Buffer.from(raw).toString("base64url") }),
      },
    );
    return {
      providerMessageId: result.id,
      providerThreadId: result.threadId ?? null,
      sentAt: new Date(),
    };
  }

  async modifyLabels(
    credentialsEncrypted: string,
    providerMessageId: string,
    changes: { addProviderLabelIds?: string[]; removeProviderLabelIds?: string[] },
  ): Promise<void> {
    await this.request(credentialsEncrypted, `/messages/${providerMessageId}/modify`, {
      method: "POST",
      body: JSON.stringify({
        addLabelIds: changes.addProviderLabelIds ?? [],
        removeLabelIds: changes.removeProviderLabelIds ?? [],
      }),
    });
  }

  async markRead(
    credentialsEncrypted: string,
    providerMessageId: string,
    read: boolean,
  ): Promise<void> {
    await this.modifyLabels(credentialsEncrypted, providerMessageId, {
      addProviderLabelIds: read ? [] : ["UNREAD"],
      removeProviderLabelIds: read ? ["UNREAD"] : [],
    });
  }

  async moveToTrash(credentialsEncrypted: string, providerMessageId: string): Promise<void> {
    await this.request(credentialsEncrypted, `/messages/${providerMessageId}/trash`, {
      method: "POST",
    });
  }

  async fetchAttachment(
    credentialsEncrypted: string,
    providerMessageId: string,
    providerAttachmentId: string,
  ): Promise<{ contentType?: string | null; bytes: Uint8Array }> {
    const result = await this.request<{ data: string }>(
      credentialsEncrypted,
      `/messages/${providerMessageId}/attachments/${providerAttachmentId}`,
    );
    return { bytes: decodeBase64Url(result.data), contentType: null };
  }
}
