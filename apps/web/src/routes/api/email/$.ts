import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { auth } from "@repo/auth/auth";
import { EmailAccountService } from "@repo/db/services/email/account-service";
import { EmailDocumentService } from "@repo/db/services/email/document-service";
import { EmailJobService } from "@repo/db/services/email/job-service";
import { EmailSendService } from "@repo/db/services/email/send-service";
import { EmailSyncService } from "@repo/db/services/email/sync-service";
import { EmailTemplateService } from "@repo/db/services/email/template-service";
import type { EmailDraftInput, EmailJobType, EmailProvider } from "@repo/db/services/email/types";
import {
  EmailWebhookLookupError,
  EmailWebhookValidationError,
  queueWebhookIncrementalSync,
  validateWebhookSignal,
} from "@repo/db/services/email/webhook";
import { createFileRoute } from "@tanstack/react-router";

import { resolveTenantContext } from "#/lib/resolve-tenant";

export const Route = createFileRoute("/api/email/$")({
  server: {
    handlers: {
      GET: async ({ request }) => withEmailContext(request, handleGet),
      POST: async ({ request }) => withEmailContext(request, handlePost),
      PATCH: async ({ request }) => withEmailContext(request, handlePatch),
    },
  },
});

type EmailContext = {
  request: Request;
  tenantId: string;
  userId: string;
  segments: string[];
};

type OAuthState = {
  provider: EmailProvider;
  tenantId: string;
  userId: string;
  nonce: string;
  issuedAt: number;
  returnTo: string;
};

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const MICROSOFT_AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";

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

const GRAPH_SCOPES = [
  "offline_access",
  "openid",
  "profile",
  "email",
  "User.Read",
  "Mail.ReadWrite",
  "Mail.Send",
];

function json(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("content-type", "application/json");
  return new Response(JSON.stringify(data), { ...init, headers });
}

async function withEmailContext(
  request: Request,
  handler: (context: EmailContext) => Promise<Response>,
) {
  const url = new URL(request.url);
  const publicSegments = url.pathname.split("/").filter(Boolean).slice(2);
  if (publicSegments[0] === "webhooks") return await handleWebhook(request, publicSegments);

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const isSystemAdmin = (session.user as any).isSystemAdmin;
  const tenantContext = await resolveTenantContext(request, session.user.id, isSystemAdmin);
  if (!tenantContext) return new Response("Forbidden", { status: 403 });

  const segments = url.pathname.split("/").filter(Boolean).slice(2);
  return await handler({
    request,
    tenantId: tenantContext.tenantId,
    userId: session.user.id,
    segments,
  });
}

async function handleWebhook(request: Request, segments: string[]) {
  if (segments[1] !== "google" && segments[1] !== "microsoft") {
    return jsonError(400, "Unsupported provider");
  }
  if (request.method === "GET" && segments[1] === "microsoft") {
    const validationToken = new URL(request.url).searchParams.get("validationToken");
    if (validationToken) {
      return new Response(validationToken, {
        headers: { "content-type": "text/plain" },
      });
    }
  }
  if (request.method !== "POST") return jsonError(405, "Method Not Allowed");

  const bodyResult = await readBody(request);
  if (!bodyResult.ok) return bodyResult.response;
  const body = bodyResult.value;
  const validation = validateWebhookSignal(request, segments[1], body);
  if (!validation.ok) return jsonError(validation.status, validation.error);
  try {
    const result = await queueWebhookIncrementalSync(segments[1], body);
    return json({ queued: true, job: result });
  } catch (error) {
    if (error instanceof EmailWebhookValidationError || error instanceof EmailWebhookLookupError) {
      return jsonError(error.status, error.message);
    }
    throw error;
  }
}

async function readBody(
  request: Request,
): Promise<{ ok: true; value: Record<string, unknown> } | { ok: false; response: Response }> {
  const text = await request.text();
  if (!text.trim()) return { ok: true, value: {} };
  try {
    return { ok: true, value: JSON.parse(text) as Record<string, unknown> };
  } catch {
    return { ok: false, response: jsonError(400, "Request body must be valid JSON") };
  }
}

function jsonError(status: number, message: string, details?: Record<string, unknown>) {
  return json({ error: { message, ...(details ?? {}) } }, { status });
}

function storageRoot() {
  return join(process.cwd(), "storage");
}

function documentPdfStorageKey(tenantId: string, documentId: string) {
  return `tenant-${tenantId}/documents/${documentId}.pdf`;
}

function documentPdfStoragePath(storageKey: string) {
  return join(storageRoot(), storageKey);
}

async function ensureDocumentPdfAttachment(request: Request, tenantId: string, documentId: string) {
  const storageKey = documentPdfStorageKey(tenantId, documentId);
  const path = documentPdfStoragePath(storageKey);
  try {
    await mkdir(join(storageRoot(), `tenant-${tenantId}`, "documents"), { recursive: true });
    const existing = await fetchDocumentPdf(request, documentId);
    await writeFile(path, new Uint8Array(await existing.arrayBuffer()));
    return storageKey;
  } catch (error) {
    console.error("[email] failed to materialize document pdf", error);
    throw error;
  }
}

async function fetchDocumentPdf(request: Request, documentId: string) {
  const url = new URL(request.url);
  url.pathname = `/api/documents/${documentId}/print`;
  const res = await fetch(url, { headers: new Headers(request.headers) });
  if (!res.ok) {
    throw new Error(`Failed to render document PDF: ${await res.text()}`);
  }
  return res;
}

function parseAddressList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const email =
        typeof (item as Record<string, unknown>).email === "string"
          ? String((item as Record<string, unknown>).email).trim()
          : "";
      if (!email) return null;
      const name =
        typeof (item as Record<string, unknown>).name === "string"
          ? String((item as Record<string, unknown>).name)
          : null;
      return { email, name };
    })
    .filter(Boolean) as EmailDraftInput["to"];
}

function parseAttachments(value: unknown): NonNullable<EmailDraftInput["attachments"]> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const fileName =
        typeof (item as Record<string, unknown>).fileName === "string"
          ? String((item as Record<string, unknown>).fileName).trim()
          : "";
      if (!fileName) return null;
      return {
        fileName,
        contentType:
          typeof (item as Record<string, unknown>).contentType === "string"
            ? String((item as Record<string, unknown>).contentType)
            : null,
        providerAttachmentId:
          typeof (item as Record<string, unknown>).providerAttachmentId === "string"
            ? String((item as Record<string, unknown>).providerAttachmentId)
            : null,
        storageKey:
          typeof (item as Record<string, unknown>).storageKey === "string"
            ? String((item as Record<string, unknown>).storageKey)
            : null,
        sizeBytes:
          typeof (item as Record<string, unknown>).sizeBytes === "number"
            ? Number((item as Record<string, unknown>).sizeBytes)
            : null,
        inlineContentId:
          typeof (item as Record<string, unknown>).inlineContentId === "string"
            ? String((item as Record<string, unknown>).inlineContentId)
            : null,
      };
    })
    .filter(Boolean) as NonNullable<EmailDraftInput["attachments"]>;
}

function parseDraftInput(
  body: Record<string, unknown>,
): { ok: true; value: EmailDraftInput } | { ok: false; response: Response } {
  const accountId = typeof body.accountId === "string" ? body.accountId : "";
  const identityId = typeof body.identityId === "string" ? body.identityId : "";
  const subject = typeof body.subject === "string" ? body.subject : "";
  if (!accountId) return { ok: false, response: jsonError(400, "accountId is required") };
  if (!identityId) return { ok: false, response: jsonError(400, "identityId is required") };
  if (!subject) return { ok: false, response: jsonError(400, "subject is required") };

  return {
    ok: true,
    value: {
      accountId,
      identityId,
      to: parseAddressList(body.to),
      cc: parseAddressList(body.cc),
      bcc: parseAddressList(body.bcc),
      subject,
      bodyHtml: typeof body.bodyHtml === "string" ? body.bodyHtml : null,
      bodyText: typeof body.bodyText === "string" ? body.bodyText : null,
      attachments: parseAttachments(body.attachments),
    },
  };
}

async function handleGet(context: EmailContext) {
  const { request, segments, tenantId, userId } = context;
  const url = new URL(request.url);
  const accountService = new EmailAccountService(tenantId, userId);
  const syncService = new EmailSyncService(tenantId, userId);

  if (segments[0] === "accounts") {
    if (segments[1] === "connect" && segments[2]) {
      return startOAuth(request, tenantId, userId, segments[2]);
    }
    if (segments[1] === "callback" && segments[2]) {
      return finishOAuth(request, tenantId, userId, segments[2]);
    }
    if (segments[1] && segments[2] === "identities") {
      return json(await accountService.listIdentities(segments[1]));
    }
    if (segments[1] && segments[2] === "labels") {
      return json(await syncService.listLabels(segments[1]));
    }
    if (segments[1] && segments[2] === "sync-state") {
      return json(await syncService.listSyncState(segments[1]));
    }
    return json(await accountService.listAccounts());
  }

  if (segments[0] === "threads" && segments[1]) {
    const thread = await syncService.getThread(segments[1]);
    if (!thread) return new Response("Not Found", { status: 404 });
    return json(thread);
  }

  if (segments[0] === "threads") {
    return json(
      await syncService.listThreads({
        accountId: url.searchParams.get("accountId"),
        labelId: url.searchParams.get("labelId"),
        limit: Number(url.searchParams.get("limit") ?? 50),
      }),
    );
  }

  if (segments[0] === "messages" && segments[1] && segments[2] === "attachments") {
    const result = await syncService.listMessageAttachments(segments[1]);
    if (!result) return new Response("Not Found", { status: 404 });
    return json(result);
  }

  if (segments[0] === "attachments" && segments[1] && segments[2] === "content") {
    const result = await syncService.fetchAttachmentContent(segments[1]);
    if (!result) return new Response("Not Found", { status: 404 });
    const body = result.bytes.buffer.slice(
      result.bytes.byteOffset,
      result.bytes.byteOffset + result.bytes.byteLength,
    ) as ArrayBuffer;
    return new Response(body, {
      headers: {
        "content-type": result.contentType,
        "content-disposition": `attachment; filename="${encodeURIComponent(result.attachment.fileName)}"`,
      },
    });
  }

  if (segments[0] === "drafts" && segments[1]) {
    return json(await new EmailSendService(tenantId, userId).getDraft(segments[1]));
  }

  if (segments[0] === "outbox") {
    const accountId = url.searchParams.get("accountId");
    if (!accountId) return jsonError(400, "accountId is required");
    return json(
      await new EmailSendService(tenantId, userId).listOutbox({
        accountId,
        status: url.searchParams.get("status"),
        limit: Number(url.searchParams.get("limit") ?? 50),
      }),
    );
  }

  if (segments[0] === "jobs") {
    const accountId = url.searchParams.get("accountId");
    if (!accountId) return jsonError(400, "accountId is required");
    await accountService.assertGrant(accountId, "read");
    return json(
      await new EmailJobService(tenantId).list({
        emailAccountId: accountId,
        status: url.searchParams.get("status"),
        jobType: parseJobType(url.searchParams.get("jobType")),
        limit: Number(url.searchParams.get("limit") ?? 50),
      }),
    );
  }

  return new Response("Not Found", { status: 404 });
}

async function handlePost(context: EmailContext) {
  const { request, segments, tenantId, userId } = context;
  const bodyResult = await readBody(request);
  if (!bodyResult.ok) return bodyResult.response;
  const body = bodyResult.value;

  if (segments[0] === "accounts" && segments[1] === "connect" && segments[2]) {
    const provider = segments[2] === "google" ? "gmail" : segments[2];
    if (provider !== "gmail" && provider !== "microsoft") {
      return jsonError(400, "Unsupported provider");
    }
    const result = await new EmailAccountService(tenantId, userId).connect(
      provider as EmailProvider,
      body,
    );
    return json(result);
  }

  if (segments[0] === "accounts" && segments[1] && segments[2] === "initial-sync") {
    const result = await new EmailSyncService(tenantId, userId).queueAccountJob(
      segments[1],
      "initial_sync",
    );
    return json(result);
  }

  if (segments[0] === "accounts" && segments[1] && segments[2] === "sync") {
    const jobType = parseAccountJobType(body.jobType) ?? "incremental_sync";
    const result = await new EmailSyncService(tenantId, userId).queueAccountJob(
      segments[1],
      jobType,
    );
    return json(result);
  }

  if (
    segments[0] === "accounts" &&
    segments[1] &&
    segments[2] === "labels" &&
    segments[3] === "sync"
  ) {
    const result = await new EmailSyncService(tenantId, userId).refreshLabels(segments[1]);
    if (!result) return new Response("Not Found", { status: 404 });
    return json(result);
  }

  if (segments[0] === "accounts" && segments[1] && segments[2] === "watch-renewal") {
    const account = await new EmailAccountService(tenantId, userId).getAccountForProvider(
      segments[1],
      "manage",
    );
    if (!account) return new Response("Not Found", { status: 404 });
    const callbackUrl = `${baseUrl(request)}/api/email/webhooks/${publicProviderSegment(account.provider as EmailProvider)}`;
    const result = await new EmailSyncService(tenantId, userId).queueAccountJob(
      segments[1],
      "watch_renewal",
      {
        callbackUrl,
      },
    );
    return json(result);
  }

  if (segments[0] === "threads" && segments[1] && segments[2] === "mark-read") {
    const result = await new EmailSyncService(tenantId, userId).markRead(
      segments[1],
      body.read !== false,
    );
    if (!result) return new Response("Not Found", { status: 404 });
    return json(result);
  }

  if (segments[0] === "threads" && segments[1] && segments[2] === "apply-label") {
    if (typeof body.labelId !== "string" || !body.labelId)
      return jsonError(400, "labelId is required");
    const result = await new EmailSyncService(tenantId, userId).applyLabel(
      segments[1],
      body.labelId,
    );
    if (!result) return new Response("Not Found", { status: 404 });
    return json(result);
  }

  if (segments[0] === "threads" && segments[1] && segments[2] === "archive") {
    const result = await new EmailSyncService(tenantId, userId).archiveThread(segments[1]);
    if (!result) return new Response("Not Found", { status: 404 });
    return json(result);
  }

  if (segments[0] === "drafts" && segments[1] && segments[2] === "send") {
    const result = await new EmailSendService(tenantId, userId).sendDraft(segments[1]);
    return json(result);
  }

  if (segments[0] === "drafts" && segments[1] && segments[2] === "provider-draft") {
    const result = await new EmailSendService(tenantId, userId).createProviderDraft(segments[1]);
    return json(result);
  }

  if (segments[0] === "drafts" && segments[1] && segments[2] === "queue") {
    const result = await new EmailSendService(tenantId, userId).queueDraft(segments[1]);
    return json(result);
  }

  if (segments[0] === "drafts") {
    const parsed = parseDraftInput(body);
    if (!parsed.ok) return parsed.response;
    const result = await new EmailSendService(tenantId, userId).saveDraft(parsed.value);
    return json(result);
  }

  if (segments[0] === "messages" && segments[1] && segments[2] === "reply") {
    const result = await new EmailSendService(tenantId, userId).reply(segments[1], body as any);
    if (!result) return new Response("Not Found", { status: 404 });
    return json(result);
  }

  if (segments[0] === "messages" && segments[1] && segments[2] === "forward") {
    const result = await new EmailSendService(tenantId, userId).forward(segments[1], body as any);
    if (!result) return new Response("Not Found", { status: 404 });
    return json(result);
  }

  if (segments[0] === "attachments" && segments[1] && segments[2] === "fetch") {
    const result = await new EmailSyncService(tenantId, userId).queueAttachmentFetch(segments[1]);
    if (!result) return new Response("Not Found", { status: 404 });
    return json(result);
  }

  if (segments[0] === "templates" && segments[1] === "render") {
    const result = await new EmailTemplateService(tenantId, userId).render(body as any);
    return json(result);
  }

  if (segments[0] === "documents" && segments[1] && segments[2] === "prepare-send") {
    if (typeof body.emailIdentityId !== "string" || !body.emailIdentityId) {
      return jsonError(400, "emailIdentityId is required");
    }
    await ensureDocumentPdfAttachment(request, tenantId, segments[1]);
    const result = await new EmailDocumentService(tenantId, userId).prepareDocumentEmail({
      documentId: segments[1],
      emailIdentityId: String(body.emailIdentityId),
      templateId: typeof body.templateId === "string" ? body.templateId : null,
      language: typeof body.language === "string" ? body.language : null,
      to: "to" in body ? parseAddressList(body.to) : undefined,
      cc: "cc" in body ? parseAddressList(body.cc) : undefined,
      bcc: "bcc" in body ? parseAddressList(body.bcc) : undefined,
      subject: typeof body.subject === "string" ? body.subject : null,
      bodyText: typeof body.bodyText === "string" ? body.bodyText : null,
      bodyHtml: typeof body.bodyHtml === "string" ? body.bodyHtml : null,
    });
    return json(result);
  }

  if (segments[0] === "documents" && segments[1] && segments[2] === "compose-defaults") {
    if (typeof body.emailIdentityId !== "string" || !body.emailIdentityId) {
      return jsonError(400, "emailIdentityId is required");
    }
    const result = await new EmailDocumentService(tenantId, userId).getDocumentEmailDefaults({
      documentId: segments[1],
      emailIdentityId: String(body.emailIdentityId),
      templateId: typeof body.templateId === "string" ? body.templateId : null,
      language: typeof body.language === "string" ? body.language : null,
    });
    return json({
      ...result,
      attachments: result.attachments.map(
        ({ storageKey: _storageKey, ...attachment }) => attachment,
      ),
    });
  }

  if (segments[0] === "jobs" && segments[1] === "run-next") {
    const workerId = typeof body.workerId === "string" ? body.workerId : "api";
    const jobService = new EmailJobService(tenantId);
    const job = await jobService.claimNext(workerId);
    if (!job) return json({ job: null });
    try {
      const result = await new EmailSyncService(tenantId, userId).runJob(job.emailJobId);
      await jobService.complete(job.emailJobId, workerId);
      return json({ job, result });
    } catch (error) {
      await jobService.fail(job.emailJobId, error, new Date(Date.now() + 60_000), workerId);
      throw error;
    }
  }

  if (segments[0] === "jobs" && segments[1] && segments[2] === "run") {
    const jobService = new EmailJobService(tenantId);
    const job = await jobService.get(segments[1]);
    if (!job) return new Response("Not Found", { status: 404 });
    try {
      const result = await new EmailSyncService(tenantId, userId).runJob(job.emailJobId);
      await jobService.complete(job.emailJobId);
      return json({ job, result });
    } catch (error) {
      await jobService.fail(job.emailJobId, error, new Date(Date.now() + 60_000));
      throw error;
    }
  }

  return new Response("Not Found", { status: 404 });
}

async function handlePatch(context: EmailContext) {
  return await handlePost(context);
}

function providerFromSegment(segment: string): EmailProvider | null {
  if (segment === "google" || segment === "gmail") return "gmail";
  if (segment === "microsoft" || segment === "graph") return "microsoft";
  return null;
}

function publicProviderSegment(provider: EmailProvider) {
  return provider === "gmail" ? "google" : "microsoft";
}

function parseJobType(value: string | null): EmailJobType | null {
  if (
    value === "initial_sync" ||
    value === "incremental_sync" ||
    value === "watch_renewal" ||
    value === "reconcile" ||
    value === "send" ||
    value === "fetch_attachment"
  ) {
    return value;
  }
  return null;
}

function parseAccountJobType(value: unknown): EmailJobType | null {
  if (
    value === "initial_sync" ||
    value === "incremental_sync" ||
    value === "watch_renewal" ||
    value === "reconcile"
  ) {
    return value;
  }
  return null;
}

function baseUrl(request: Request) {
  return (process.env.VITE_BASE_URL || new URL(request.url).origin).replace(/\/$/, "");
}

function redirectUri(request: Request, provider: EmailProvider) {
  return `${baseUrl(request)}/api/email/accounts/callback/${publicProviderSegment(provider)}`;
}

function oauthStateSecret() {
  const secret = process.env.EMAIL_OAUTH_STATE_SECRET ?? process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("EMAIL_OAUTH_STATE_SECRET or BETTER_AUTH_SECRET is required");
  return secret;
}

function encodeState(state: OAuthState) {
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
  const signature = createHmac("sha256", oauthStateSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function decodeState(value: string): OAuthState {
  const [payload, signature] = value.split(".");
  if (!payload || !signature) throw new Error("Invalid OAuth state");

  const expected = createHmac("sha256", oauthStateSecret()).update(payload).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    throw new Error("Invalid OAuth state signature");
  }

  const state = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as OAuthState;
  if (Date.now() - state.issuedAt > 10 * 60 * 1000) throw new Error("OAuth state expired");
  return state;
}

function startOAuth(request: Request, tenantId: string, userId: string, providerSegment: string) {
  const provider = providerFromSegment(providerSegment);
  if (!provider) return jsonError(400, "Unsupported provider");

  const clientId =
    provider === "gmail"
      ? (process.env.GMAIL_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID)
      : (process.env.MICROSOFT_CLIENT_ID ?? process.env.GRAPH_CLIENT_ID);
  if (!clientId) return new Response(`${provider} OAuth client is not configured`, { status: 500 });

  const state = encodeState({
    provider,
    tenantId,
    userId,
    nonce: randomBytes(16).toString("base64url"),
    issuedAt: Date.now(),
    returnTo: "/app/email",
  });

  const authUrl = new URL(provider === "gmail" ? GOOGLE_AUTH_URL : MICROSOFT_AUTH_URL);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri(request, provider));
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("scope", (provider === "gmail" ? GMAIL_SCOPES : GRAPH_SCOPES).join(" "));
  if (provider === "gmail") {
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
  }

  return Response.redirect(authUrl.toString(), 302);
}

async function finishOAuth(
  request: Request,
  tenantId: string,
  userId: string,
  providerSegment: string,
) {
  const provider = providerFromSegment(providerSegment);
  if (!provider) return jsonError(400, "Unsupported provider");

  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  if (error) return Response.redirect(`${baseUrl(request)}/app/email?emailConnect=error`, 302);

  const code = url.searchParams.get("code");
  const stateValue = url.searchParams.get("state");
  if (!code || !stateValue) return jsonError(400, "OAuth code and state are required");

  let state: OAuthState;
  try {
    state = decodeState(stateValue);
  } catch (error) {
    return jsonError(400, error instanceof Error ? error.message : "Invalid OAuth state");
  }
  if (state.provider !== provider || state.tenantId !== tenantId || state.userId !== userId) {
    return jsonError(403, "OAuth state does not match active session");
  }

  try {
    await new EmailAccountService(tenantId, userId).connect(provider, {
      code,
      redirectUri: redirectUri(request, provider),
    });
  } catch (err: any) {
    console.error("Email OAuth connect failed:", err);
    return jsonError(500, "Failed to connect email account");
  }

  return Response.redirect(`${baseUrl(request)}${state.returnTo}?emailConnect=ok`, 302);
}
