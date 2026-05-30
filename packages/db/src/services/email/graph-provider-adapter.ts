import { decryptEmailCredentials, encryptEmailCredentials } from "./credential-crypto";
import { loadDraftAttachment } from "./mime";
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

const GRAPH_SCOPES = [
  "offline_access",
  "openid",
  "profile",
  "email",
  "User.Read",
  "Mail.ReadWrite",
  "Mail.Send",
];

type GraphTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

type GraphMe = {
  id?: string;
  displayName?: string;
  mail?: string | null;
  userPrincipalName?: string | null;
};

type GraphCredentialBundle = {
  provider: "microsoft";
  primaryEmail?: string;
  token: GraphTokenResponse;
  obtainedAt?: string;
};

type GraphMailFolder = {
  id: string;
  displayName: string;
  parentFolderId?: string | null;
  totalItemCount?: number;
  unreadItemCount?: number;
};

type GraphEmailAddress = {
  emailAddress?: { address?: string | null; name?: string | null };
};

type GraphMessage = {
  id: string;
  conversationId?: string | null;
  internetMessageId?: string | null;
  parentFolderId?: string | null;
  subject?: string | null;
  bodyPreview?: string | null;
  body?: { contentType?: string; content?: string | null } | null;
  from?: GraphEmailAddress | null;
  toRecipients?: GraphEmailAddress[];
  ccRecipients?: GraphEmailAddress[];
  bccRecipients?: GraphEmailAddress[];
  sentDateTime?: string | null;
  receivedDateTime?: string | null;
  isRead?: boolean;
  hasAttachments?: boolean;
  categories?: string[];
  internetMessageHeaders?: Array<{ name?: string; value?: string }>;
};

type GraphAttachment = {
  id: string;
  name?: string;
  contentType?: string | null;
  size?: number | null;
  isInline?: boolean;
  contentId?: string | null;
  contentBytes?: string;
};

function graphAddress(value?: GraphEmailAddress | null) {
  return {
    email: value?.emailAddress?.address ?? "",
    name: value?.emailAddress?.name ?? null,
  };
}

function graphAddressList(values?: GraphEmailAddress[]) {
  return (values ?? []).map(graphAddress).filter((address) => address.email);
}

async function readJsonResponse<T>(res: Response): Promise<T | undefined> {
  const text = await res.text();
  if (!text.trim()) return undefined;
  return JSON.parse(text) as T;
}

function asGraphRecipients(values?: Array<{ email: string; name?: string | null }>) {
  return (values ?? []).map((value) => ({
    emailAddress: { address: value.email, name: value.name ?? undefined },
  }));
}

function graphBody(message: GraphMessage) {
  const content = message.body?.content ?? null;
  if (message.body?.contentType?.toLowerCase() === "html")
    return { bodyHtml: content, bodyText: null };
  return { bodyHtml: null, bodyText: content };
}

function mapGraphMessage(
  message: GraphMessage,
  attachments: GraphAttachment[] = [],
  folderNames: Map<string, string> = new Map(),
) {
  const body = graphBody(message);
  const folderName = message.parentFolderId
    ? folderNames.get(message.parentFolderId)?.toLowerCase()
    : "";
  const direction = folderName?.includes("draft")
    ? "draft"
    : folderName?.includes("sent")
      ? "outbound"
      : "inbound";
  return {
    providerMessageId: message.id,
    providerThreadId: message.conversationId ?? message.id,
    internetMessageId: message.internetMessageId ?? null,
    direction,
    from: graphAddress(message.from),
    to: graphAddressList(message.toRecipients),
    cc: graphAddressList(message.ccRecipients),
    bcc: graphAddressList(message.bccRecipients),
    subject: message.subject ?? null,
    snippet: message.bodyPreview ?? null,
    bodyHtml: body.bodyHtml,
    bodyText: body.bodyText,
    sentAt: direction === "inbound" ? null : (message.sentDateTime ?? null),
    receivedAt: direction === "inbound" ? (message.receivedDateTime ?? null) : null,
    isRead: message.isRead ?? false,
    hasAttachments: message.hasAttachments ?? attachments.length > 0,
    rawHeaders: Object.fromEntries(
      (message.internetMessageHeaders ?? []).map((h) => [h.name ?? "", h.value ?? ""]),
    ),
    providerLabelIds: [
      ...(message.categories ?? []),
      ...(message.parentFolderId ? [message.parentFolderId] : []),
    ],
    attachments: attachments.map((attachment) => ({
      providerAttachmentId: attachment.id,
      fileName: attachment.name ?? "attachment",
      contentType: attachment.contentType ?? null,
      sizeBytes: attachment.size ?? null,
      inlineContentId: attachment.isInline ? (attachment.contentId ?? attachment.id) : null,
    })),
  } satisfies import("./types").ProviderMessage;
}

export class GraphProviderAdapter implements EmailProviderAdapter {
  readonly provider = "microsoft" as const;
  private updatedCredentialsEncrypted: string | null = null;

  consumeUpdatedCredentials() {
    const value = this.updatedCredentialsEncrypted;
    this.updatedCredentialsEncrypted = null;
    return value;
  }

  private async accessToken(credentialsEncrypted: string) {
    const bundle = decryptEmailCredentials<GraphCredentialBundle>(credentialsEncrypted);
    if (bundle.token.access_token) return bundle.token.access_token;
    return await this.refreshAccessToken(bundle);
  }

  private async refreshAccessToken(bundle: GraphCredentialBundle) {
    const clientId = process.env.MICROSOFT_CLIENT_ID ?? process.env.GRAPH_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET ?? process.env.GRAPH_CLIENT_SECRET;
    const tenant = process.env.MICROSOFT_TENANT_ID ?? "common";
    const refreshToken = bundle.token.refresh_token;
    if (!clientId || !clientSecret)
      throw new ProviderConfigurationError(this.provider, "OAuth refresh");
    if (!refreshToken)
      throw new ProviderReauthRequiredError(this.provider, "missing refresh token");

    const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
        scope: GRAPH_SCOPES.join(" "),
      }),
    });
    const token = (await readJsonResponse<GraphTokenResponse>(res)) ?? {};
    if (!res.ok || token.error || !token.access_token) {
      throw new ProviderReauthRequiredError(
        this.provider,
        token.error_description ?? token.error ?? res.statusText,
      );
    }
    bundle.token = {
      ...bundle.token,
      ...token,
      refresh_token: token.refresh_token ?? refreshToken,
    };
    this.updatedCredentialsEncrypted = encryptEmailCredentials(bundle);
    return token.access_token;
  }

  private async request<T>(
    credentialsEncrypted: string,
    pathOrUrl: string,
    init: RequestInit = {},
  ) {
    const url = pathOrUrl.startsWith("https://")
      ? pathOrUrl
      : `https://graph.microsoft.com/v1.0${pathOrUrl}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        authorization: `Bearer ${await this.accessToken(credentialsEncrypted)}`,
        "content-type": "application/json",
        ...init.headers,
      },
    });
    if (res.status === 401) {
      const retry = await fetch(url, {
        ...init,
        headers: {
          authorization: `Bearer ${await this.refreshAccessToken(decryptEmailCredentials<GraphCredentialBundle>(credentialsEncrypted))}`,
          "content-type": "application/json",
          ...init.headers,
        },
      });
      if (!retry.ok) throw new Error(`Graph API ${retry.status}: ${await retry.text()}`);
      if (retry.status === 204 || retry.status === 205) return undefined as T;
      return (await readJsonResponse<T>(retry)) as T;
    }
    if (!res.ok) throw new Error(`Graph API ${res.status}: ${await res.text()}`);
    if (res.status === 204 || res.status === 205) return undefined as T;
    return (await readJsonResponse<T>(res)) as T;
  }

  private async draftMessage(draft: EmailDraftInput) {
    const attachments = (
      await Promise.all(
        (draft.attachments ?? []).map((attachment) => loadDraftAttachment(attachment)),
      )
    ).filter(Boolean) as Array<NonNullable<Awaited<ReturnType<typeof loadDraftAttachment>>>>;

    return {
      subject: draft.subject,
      body: {
        contentType: draft.bodyHtml ? "HTML" : "Text",
        content: draft.bodyHtml ?? draft.bodyText ?? "",
      },
      from: { emailAddress: { address: draft.identityId } },
      toRecipients: asGraphRecipients(draft.to),
      ccRecipients: asGraphRecipients(draft.cc),
      bccRecipients: asGraphRecipients(draft.bcc),
      attachments: attachments.map((attachment) => ({
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: attachment.fileName,
        contentType: attachment.contentType ?? "application/octet-stream",
        contentBytes: attachment.bytes.toString("base64"),
        isInline: Boolean(attachment.inlineContentId),
        contentId: attachment.inlineContentId ?? undefined,
      })),
    };
  }

  async connect(input: Record<string, unknown>): Promise<EmailProviderConnection> {
    const clientId = process.env.MICROSOFT_CLIENT_ID ?? process.env.GRAPH_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET ?? process.env.GRAPH_CLIENT_SECRET;
    const tenant = process.env.MICROSOFT_TENANT_ID ?? "common";
    const code = typeof input.code === "string" ? input.code : "";
    const redirectUri = typeof input.redirectUri === "string" ? input.redirectUri : "";

    if (!clientId || !clientSecret)
      throw new ProviderConfigurationError(this.provider, "OAuth connect");
    if (!code || !redirectUri)
      throw new ProviderOAuthError(this.provider, "missing authorization code");

    const tokenRes = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        scope: GRAPH_SCOPES.join(" "),
      }),
    });
    const token = (await readJsonResponse<GraphTokenResponse>(tokenRes)) ?? {};
    if (!tokenRes.ok || token.error || !token.access_token) {
      throw new ProviderOAuthError(
        this.provider,
        token.error_description ?? token.error ?? tokenRes.statusText,
      );
    }

    const meResponse = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { authorization: `Bearer ${token.access_token}` },
    });
    const me = (await readJsonResponse<GraphMe>(meResponse)) ?? {};

    const primaryEmail = me.mail ?? me.userPrincipalName;
    if (!primaryEmail)
      throw new ProviderOAuthError(this.provider, "provider did not return an email");

    const scopes = token.scope?.split(/\s+/).filter(Boolean) ?? GRAPH_SCOPES;
    return {
      provider: this.provider,
      providerAccountId: me.id ?? primaryEmail,
      displayName: me.displayName ?? primaryEmail,
      primaryEmail,
      encryptedCredentials: encryptEmailCredentials({
        provider: this.provider,
        primaryEmail,
        token,
        obtainedAt: new Date().toISOString(),
      }),
      scopes,
      identities: [
        {
          providerIdentityId: primaryEmail,
          email: primaryEmail,
          displayName: me.displayName ?? null,
          isPrimary: true,
          canSend: true,
        },
      ],
    };
  }

  async listLabels(credentialsEncrypted: string): Promise<ProviderLabel[]> {
    const result = await this.request<{ value?: GraphMailFolder[] }>(
      credentialsEncrypted,
      "/me/mailFolders?$top=100",
    );
    return (result.value ?? []).map((folder) => ({
      providerLabelId: folder.id,
      name: folder.displayName,
      kind: "folder",
      parentProviderLabelId: folder.parentFolderId ?? null,
      messageCount: folder.totalItemCount ?? 0,
      unreadCount: folder.unreadItemCount ?? 0,
    }));
  }

  async fullSyncPage(credentialsEncrypted: string, cursor?: string | null): Promise<SyncPage> {
    return await this.deltaPage(credentialsEncrypted, cursor);
  }

  async incrementalSync(
    credentialsEncrypted: string,
    cursor?: string | null,
  ): Promise<IncrementalSyncResult> {
    return await this.deltaPage(credentialsEncrypted, cursor);
  }

  async renewWatch(
    credentialsEncrypted: string,
    callbackUrl: string,
  ): Promise<{ expiresAt: Date }> {
    const clientState =
      process.env.MICROSOFT_WEBHOOK_CLIENT_STATE ?? process.env.EMAIL_WEBHOOK_TOKEN;
    if (!clientState)
      throw new ProviderConfigurationError(this.provider, "subscription client state");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await this.request(credentialsEncrypted, "/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        changeType: "created,updated,deleted",
        notificationUrl: callbackUrl,
        resource: "/me/messages",
        expirationDateTime: expiresAt.toISOString(),
        clientState,
      }),
    });
    return { expiresAt };
  }

  async createDraft(
    credentialsEncrypted: string,
    draft: EmailDraftInput,
  ): Promise<ProviderDraftResult> {
    const result = await this.request<{ id: string }>(credentialsEncrypted, "/me/messages", {
      method: "POST",
      body: JSON.stringify(await this.draftMessage(draft)),
    });
    return { providerDraftId: result.id, providerMessageId: result.id };
  }

  async sendDraft(
    credentialsEncrypted: string,
    providerDraftId: string,
  ): Promise<ProviderSendResult> {
    await this.request(credentialsEncrypted, `/me/messages/${providerDraftId}/send`, {
      method: "POST",
    });
    return { providerMessageId: providerDraftId, sentAt: new Date() };
  }

  async sendMessage(
    credentialsEncrypted: string,
    draft: EmailDraftInput,
  ): Promise<ProviderSendResult> {
    const draftResult = await this.createDraft(credentialsEncrypted, draft);
    await this.sendDraft(credentialsEncrypted, draftResult.providerDraftId);
    return {
      providerMessageId: draftResult.providerMessageId ?? draftResult.providerDraftId,
      sentAt: new Date(),
    };
  }

  async modifyLabels(
    credentialsEncrypted: string,
    providerMessageId: string,
    changes: { addProviderLabelIds?: string[]; removeProviderLabelIds?: string[] },
  ): Promise<void> {
    const message = await this.request<GraphMessage>(
      credentialsEncrypted,
      `/me/messages/${providerMessageId}`,
    );
    const categories = new Set(message.categories ?? []);
    for (const label of changes.addProviderLabelIds ?? []) categories.add(label);
    for (const label of changes.removeProviderLabelIds ?? []) categories.delete(label);
    await this.request(credentialsEncrypted, `/me/messages/${providerMessageId}`, {
      method: "PATCH",
      body: JSON.stringify({ categories: [...categories] }),
    });
  }

  async markRead(
    credentialsEncrypted: string,
    providerMessageId: string,
    read: boolean,
  ): Promise<void> {
    await this.request(credentialsEncrypted, `/me/messages/${providerMessageId}`, {
      method: "PATCH",
      body: JSON.stringify({ isRead: read }),
    });
  }

  async fetchAttachment(
    credentialsEncrypted: string,
    providerMessageId: string,
    providerAttachmentId: string,
  ): Promise<{ contentType?: string | null; bytes: Uint8Array }> {
    const result = await this.request<GraphAttachment>(
      credentialsEncrypted,
      `/me/messages/${providerMessageId}/attachments/${providerAttachmentId}`,
    );
    if (!result.contentBytes)
      throw new Error("Graph attachment content is not available for this attachment type");
    return {
      contentType: result.contentType ?? null,
      bytes: new Uint8Array(Buffer.from(result.contentBytes, "base64")),
    };
  }

  private async deltaPage(credentialsEncrypted: string, cursor?: string | null) {
    const url =
      cursor && cursor.startsWith("https://")
        ? cursor
        : "/me/messages/delta?$top=25&$select=id,conversationId,internetMessageId,parentFolderId,subject,bodyPreview,body,from,toRecipients,ccRecipients,bccRecipients,sentDateTime,receivedDateTime,isRead,hasAttachments,categories,internetMessageHeaders";
    const result = await this.request<{
      value?: GraphMessage[];
      "@odata.nextLink"?: string;
      "@odata.deltaLink"?: string;
    }>(credentialsEncrypted, url);
    const labels = await this.listLabels(credentialsEncrypted);
    const folderNames = new Map(labels.map((label) => [label.providerLabelId, label.name]));
    const messagesWithAttachments = await Promise.all(
      (result.value ?? []).map(async (message) => {
        const attachments = message.hasAttachments
          ? await this.request<{ value?: GraphAttachment[] }>(
              credentialsEncrypted,
              `/me/messages/${message.id}/attachments?$select=id,name,contentType,size,isInline,contentId`,
            ).then((res) => res.value ?? [])
          : [];
        return { message, mapped: mapGraphMessage(message, attachments, folderNames) };
      }),
    );
    return {
      labels,
      threads: messagesWithAttachments.map(({ message, mapped }) => ({
        providerThreadId: message.conversationId ?? message.id,
        subject: mapped.subject,
        snippet: mapped.snippet,
        lastMessageAt: mapped.receivedAt ?? mapped.sentAt ?? null,
        isRead: mapped.isRead,
        isStarred: false,
        messages: [mapped],
      })),
      hasMore: Boolean(result["@odata.nextLink"]),
      nextCursor: result["@odata.nextLink"] ?? result["@odata.deltaLink"] ?? cursor ?? null,
    };
  }
}
