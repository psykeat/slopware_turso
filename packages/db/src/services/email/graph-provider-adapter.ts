import { decryptEmailCredentials, encryptEmailCredentials } from "./credential-crypto";
import { loadDraftAttachment } from "./mime";
import {
  type EmailProviderAdapter,
  type EmailProviderConnection,
  ProviderConfigurationError,
  ProviderOAuthError,
  ProviderReauthRequiredError,
  type ProviderContact,
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
  const isDraft =
    folderName &&
    (folderName.includes("draft") ||
      folderName.includes("entwürf") ||
      folderName.includes("entwurf"));
  const isSent =
    folderName &&
    (folderName.includes("sent") ||
      folderName.includes("gesendet") ||
      folderName.includes("gesendete"));
  const direction = isDraft ? "draft" : isSent ? "outbound" : "inbound";
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
        contentType: draft.bodyHtml ? "html" : "text",
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

  // fallow-ignore-next-line unused-class-member
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
  ): Promise<{ expiresAt: Date; subscriptionId?: string | null; channelToken?: string | null }> {
    const clientState =
      process.env.MICROSOFT_WEBHOOK_CLIENT_STATE ?? process.env.EMAIL_WEBHOOK_TOKEN;
    if (!clientState)
      throw new ProviderConfigurationError(this.provider, "subscription client state");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const result = await this.request<{ id?: string }>(credentialsEncrypted, "/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        changeType: "created,updated,deleted",
        notificationUrl: callbackUrl,
        resource: "/me/messages",
        expirationDateTime: expiresAt.toISOString(),
        clientState,
      }),
    });
    return { expiresAt, subscriptionId: result.id ?? null, channelToken: clientState };
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

  async moveToTrash(credentialsEncrypted: string, providerMessageId: string): Promise<void> {
    await this.request(credentialsEncrypted, `/me/messages/${providerMessageId}/move`, {
      method: "POST",
      body: JSON.stringify({ destinationId: "deleteditems" }),
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

  async syncContacts(credentialsEncrypted: string): Promise<ProviderContact[]> {
    const contacts: ProviderContact[] = [];
    let nextLink: string | undefined =
      "/me/contacts?$select=id,emailAddresses,givenName,surname,displayName&$top=100";

    while (nextLink) {
      // @ts-expect-error
      // eslint-disable-next-line
      const response = await this.request<{
        value: Array<{
          id: string;
          emailAddresses?: Array<{ address: string; name?: string }>;
          givenName?: string;
          surname?: string;
          displayName?: string;
        }>;
        "@odata.nextLink"?: string;
      }>(credentialsEncrypted, nextLink);

      for (const contact of response.value ?? []) {
        if (!contact.emailAddresses || contact.emailAddresses.length === 0) continue;
        for (const emailObj of contact.emailAddresses) {
          if (!emailObj.address) continue;
          contacts.push({
            id: `${contact.id}-${emailObj.address}`,
            email: emailObj.address,
            firstName: contact.givenName ?? null,
            lastName: contact.surname ?? null,
            displayName: contact.displayName ?? null,
          });
        }
      }

      nextLink = response["@odata.nextLink"];
    }
    return contacts;
  }

  private async deltaPage(credentialsEncrypted: string, cursor?: string | null) {
    let url: string;
    let isStandardSync = false;
    let standardSyncTimestamp: string | null = null;

    if (cursor && cursor.startsWith("standard-sync:")) {
      isStandardSync = true;
      standardSyncTimestamp = cursor.substring("standard-sync:".length);
      url = `/me/messages?$filter=lastModifiedDateTime gt ${standardSyncTimestamp}&$top=25&$select=id,conversationId,internetMessageId,parentFolderId,subject,bodyPreview,body,from,toRecipients,ccRecipients,bccRecipients,sentDateTime,receivedDateTime,isRead,hasAttachments,categories,internetMessageHeaders`;
    } else if (cursor && cursor.startsWith("https://")) {
      url = cursor;
      isStandardSync = !cursor.includes("/messages/delta");
    } else {
      url =
        "/me/messages/delta?$top=25&$select=id,conversationId,internetMessageId,parentFolderId,subject,bodyPreview,body,from,toRecipients,ccRecipients,bccRecipients,sentDateTime,receivedDateTime,isRead,hasAttachments,categories,internetMessageHeaders";
    }

    let result: {
      value?: GraphMessage[];
      "@odata.nextLink"?: string;
      "@odata.deltaLink"?: string;
    } = {};

    try {
      result = (await this.request<any>(credentialsEncrypted, url)) ?? {};
    } catch (err: any) {
      if (
        !cursor &&
        (err.message.includes("Change tracking is not supported") ||
          err.message.includes("Unsupported request"))
      ) {
        console.log(
          "ℹ️ Root change tracking is not supported for this account. Falling back to standard messages sync...",
        );
        isStandardSync = true;
        url =
          "/me/messages?$top=25&$select=id,conversationId,internetMessageId,parentFolderId,subject,bodyPreview,body,from,toRecipients,ccRecipients,bccRecipients,sentDateTime,receivedDateTime,isRead,hasAttachments,categories,internetMessageHeaders";
        result = (await this.request<any>(credentialsEncrypted, url)) ?? {};
      } else {
        throw err;
      }
    }

    const labels = await this.listLabels(credentialsEncrypted);
    const folderNames = new Map(labels.map((label) => [label.providerLabelId, label.name]));
    const messagesWithAttachments = await Promise.all(
      (result.value ?? []).map(async (message) => {
        const attachments = message.hasAttachments
          ? await this.request<{ value?: GraphAttachment[] }>(
              credentialsEncrypted,
              `/me/messages/${message.id}/attachments`,
            ).then((res) => res.value ?? [])
          : [];
        return { message, mapped: mapGraphMessage(message, attachments, folderNames) };
      }),
    );

    let nextCursor: string | null = null;
    if (result["@odata.nextLink"]) {
      nextCursor = result["@odata.nextLink"];
    } else if (result["@odata.deltaLink"]) {
      nextCursor = result["@odata.deltaLink"];
    } else if (isStandardSync) {
      nextCursor = `standard-sync:${new Date().toISOString()}`;
    } else {
      nextCursor = cursor ?? null;
    }

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
      nextCursor,
    };
  }
}
