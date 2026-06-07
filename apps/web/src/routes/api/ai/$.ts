import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { auth } from "@repo/auth/auth";
import { db } from "@repo/db";
import {
  aiSession,
  aiMemory,
  company,
  emailMessage,
  emailThread,
  systemSettings,
  tenantLlmConfig,
} from "@repo/db/schema";
import { AIDiscoveryService } from "@repo/db/services/ai-discovery";
import {
  decryptEmailCredentials,
  encryptEmailCredentials,
} from "@repo/db/services/email/credential-crypto";
import { createFileRoute } from "@tanstack/react-router";
import { and, eq, desc } from "drizzle-orm";

import { resolveTenantContext } from "#/lib/resolve-tenant";

const SENTINEL = "••••••••";

function encryptGlobalLlmSecret(text: string): string {
  const encryptionKeyHex = process.env.ENCRYPTION_SECRET ?? "";
  const encryptionKey =
    encryptionKeyHex.length === 64 ? Buffer.from(encryptionKeyHex, "hex") : null;
  if (!encryptionKey) return text;

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

function decryptGlobalLlmSecret(encoded: string): string {
  const encryptionKeyHex = process.env.ENCRYPTION_SECRET ?? "";
  const encryptionKey =
    encryptionKeyHex.length === 64 ? Buffer.from(encryptionKeyHex, "hex") : null;
  if (!encryptionKey) return encoded;

  const parts = encoded.split(":");
  if (parts.length !== 3) return encoded;
  const [ivHex, authTagHex, cipherHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(cipherHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

type LoadedLlmConfig = {
  configured: boolean;
  provider: string;
  endpointUrl: string;
  model: string;
  apiKey: string;
  vertexCredentials: string;
  githubToken: string;
  githubRepo: string;
  vertexProject: string;
  vertexLocation: string;
  isActive?: boolean;
  tenantLlmConfigId?: string;
};

function maskLoadedConfig(config: LoadedLlmConfig) {
  return {
    configured: config.configured,
    provider: config.provider,
    endpointUrl: config.endpointUrl,
    model: config.model,
    apiKey: config.apiKey ? SENTINEL : "",
    vertexCredentials: config.vertexCredentials ? SENTINEL : "",
    githubToken: config.githubToken ? SENTINEL : "",
    githubRepo: config.githubRepo,
    vertexProject: config.vertexProject,
    vertexLocation: config.vertexLocation,
    ...(config.isActive === undefined ? {} : { isActive: config.isActive }),
    ...(config.tenantLlmConfigId ? { tenantLlmConfigId: config.tenantLlmConfigId } : {}),
  };
}

async function loadGlobalLlmConfig(): Promise<LoadedLlmConfig | null> {
  const configRow = await db
    .select()
    .from(systemSettings)
    .where(and(eq(systemSettings.scope, "global"), eq(systemSettings.key, "llm_config")))
    .limit(1);

  if (!configRow[0]) return null;

  const stored = configRow[0].value as {
    provider?: string;
    endpointUrl?: string;
    model?: string;
    apiKey?: string;
    vertexCredentials?: string;
    githubToken?: string;
    githubRepo?: string;
    vertexProject?: string;
    vertexLocation?: string;
  };

  return {
    configured: true,
    provider: stored.provider ?? "",
    endpointUrl: stored.endpointUrl ?? "",
    model: stored.model ?? "",
    apiKey: stored.apiKey ? decryptGlobalLlmSecret(stored.apiKey) : "",
    vertexCredentials: stored.vertexCredentials
      ? decryptGlobalLlmSecret(stored.vertexCredentials)
      : "",
    githubToken: stored.githubToken ? decryptGlobalLlmSecret(stored.githubToken) : "",
    githubRepo: stored.githubRepo ?? "",
    vertexProject: stored.vertexProject ?? "",
    vertexLocation: stored.vertexLocation ?? "",
  };
}

async function loadTenantLlmConfig(
  tenantId: string,
  companyId: string,
): Promise<LoadedLlmConfig | null> {
  const [row] = await db
    .select()
    .from(tenantLlmConfig)
    .where(and(eq(tenantLlmConfig.tenantId, tenantId), eq(tenantLlmConfig.companyId, companyId)))
    .limit(1);

  if (!row) return null;

  const safeDecryptTenantSecret = (encoded?: string | null) => {
    if (!encoded) return "";
    try {
      return decryptEmailCredentials<string>(encoded);
    } catch {
      return encoded;
    }
  };

  return {
    configured: true,
    tenantLlmConfigId: row.tenantLlmConfigId,
    provider: row.provider ?? "",
    endpointUrl: row.endpointUrl ?? "",
    model: row.model ?? "",
    apiKey: safeDecryptTenantSecret(row.apiKey),
    vertexCredentials: safeDecryptTenantSecret(row.vertexCredentials),
    githubToken: safeDecryptTenantSecret(row.githubToken),
    githubRepo: row.githubRepo ?? "",
    vertexProject: row.vertexProject ?? "",
    vertexLocation: row.vertexLocation ?? "",
    isActive: row.isActive ?? true,
  };
}

export const Route = createFileRoute("/api/ai/$")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return new Response("Unauthorized", { status: 401 });

        const isSystemAdmin = (session.user as any).isSystemAdmin;
        const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context) return new Response("Forbidden", { status: 403 });
        const tenantId = context.tenantId;
        const userId = session.user.id;

        const url = new URL(request.url);
        const path = url.pathname;

        try {
          if (path === "/api/ai/llm-config") {
            const scope = url.searchParams.get("scope") || "global";
            const companyId = url.searchParams.get("companyId") || "";

            if (scope === "tenant") {
              if (!companyId) {
                return new Response(JSON.stringify({ configured: false }), {
                  headers: { "content-type": "application/json" },
                });
              }

              const tenantConfig = await loadTenantLlmConfig(tenantId, companyId);
              return new Response(
                JSON.stringify(
                  tenantConfig ? maskLoadedConfig(tenantConfig) : { configured: false },
                ),
                {
                  headers: { "content-type": "application/json" },
                },
              );
            }

            if (!isSystemAdmin) return new Response("Forbidden", { status: 403 });

            const globalConfig = await loadGlobalLlmConfig();
            return new Response(
              JSON.stringify(globalConfig ? maskLoadedConfig(globalConfig) : { configured: false }),
              { headers: { "content-type": "application/json" } },
            );
          }

          // 1. GET /api/ai/catalog/entities
          if (path === "/api/ai/catalog/entities") {
            const scopeParam = url.searchParams.get("scope") || "all";
            const taskScope = scopeParam.split(",");
            const catalog = await AIDiscoveryService.getSemanticEntityCatalog(tenantId, taskScope);
            return new Response(JSON.stringify({ entities: catalog }), {
              headers: { "content-type": "application/json" },
            });
          }

          // 2. GET /api/ai/catalog/entities/:entityName
          if (path.startsWith("/api/ai/catalog/entities/")) {
            const entityName = path.split("/").pop() || "";
            const fields = await AIDiscoveryService.getSemanticFieldCatalog(entityName, tenantId);
            return new Response(JSON.stringify({ entityName, fields }), {
              headers: { "content-type": "application/json" },
            });
          }

          // 3. GET /api/ai/catalog/commands
          if (path === "/api/ai/catalog/commands") {
            const scopeParam = url.searchParams.get("scope") || "all";
            const taskScope = scopeParam.split(",");
            const commands = await AIDiscoveryService.getSemanticCommandCatalog(
              tenantId,
              taskScope,
            );
            return new Response(JSON.stringify({ commands }), {
              headers: { "content-type": "application/json" },
            });
          }

          // GET /api/ai/context/mail-thread/:threadId
          if (path.startsWith("/api/ai/context/mail-thread/")) {
            const threadId = path.split("/").pop() || "";
            const thread = await db
              .select()
              .from(emailThread)
              .where(
                and(eq(emailThread.emailThreadId, threadId), eq(emailThread.tenantId, tenantId)),
              )
              .limit(1);

            if (thread.length === 0) {
              return new Response("Thread not found", { status: 404 });
            }

            const messages = await db
              .select()
              .from(emailMessage)
              .where(
                and(eq(emailMessage.emailThreadId, threadId), eq(emailMessage.tenantId, tenantId)),
              );

            return new Response(
              JSON.stringify({
                threadId: thread[0].emailThreadId,
                subject: thread[0].subject,
                relatedDocumentId: thread[0].relatedDocumentId,
                relatedAddressId: thread[0].relatedAddressId,
                messages: messages.map((m) => ({
                  messageId: m.emailMessageId,
                  direction: m.direction,
                  fromJson: m.fromJson,
                  toJson: m.toJson,
                  subject: m.subject,
                  bodyText: m.bodyText,
                  bodyHtml: m.bodyHtml,
                })),
              }),
              {
                headers: { "content-type": "application/json" },
              },
            );
          }

          // GET /api/ai/memories
          if (path === "/api/ai/memories") {
            const memories = await db
              .select()
              .from(aiMemory)
              .where(eq(aiMemory.tenantId, tenantId))
              .orderBy(desc(aiMemory.createdAt));

            return new Response(JSON.stringify(memories), {
              headers: { "content-type": "application/json" },
            });
          }

          // GET /api/ai/sessions/:sessionId/sse or GET /api/ai/sse
          if (
            (path.startsWith("/api/ai/sessions/") && path.endsWith("/sse")) ||
            path === "/api/ai/sse"
          ) {
            const sessionId =
              path === "/api/ai/sse"
                ? url.searchParams.get("sessionId") || ""
                : path.split("/")[4] || "";

            if (!sessionId) {
              return new Response("Missing sessionId", { status: 400 });
            }

            const headers = {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
            };

            const stream = new ReadableStream({
              async start(controller) {
                const encoder = new TextEncoder();
                const sendEvent = (event: string, data: any) => {
                  try {
                    controller.enqueue(
                      encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
                    );
                  } catch {
                    // Client closed connection
                  }
                };
                const abortController = new AbortController();
                const timeout = setTimeout(() => abortController.abort(), 60000);
                request.signal.addEventListener("abort", () => abortController.abort(), {
                  once: true,
                });

                try {
                  const [sessionRow] = await db
                    .select()
                    .from(aiSession)
                    .where(
                      and(eq(aiSession.sessionId, sessionId), eq(aiSession.tenantId, tenantId)),
                    )
                    .limit(1);

                  if (!sessionRow) {
                    sendEvent("error", {
                      errorClass: "CONTEXT_NOT_RESOLVABLE",
                      message: "Session not found",
                    });
                    controller.close();
                    return;
                  }

                  sendEvent("status", { status: "resolving-context" });

                  // Build or fetch context projection
                  const { getOrCreateContextProjection } =
                    await import("@repo/db/services/ai-context-projection");
                  const snapshot = await getOrCreateContextProjection({
                    sessionId,
                    tenantId,
                    focusType: sessionRow.focusType,
                    focusId: sessionRow.focusId,
                  });

                  sendEvent("status", { status: "interpreting" });

                  const { AIOrchestratorService } =
                    await import("@repo/db/services/ai-orchestrator");
                  const analysisRes = await AIOrchestratorService.runMailAgentAnalysis({
                    threadId: sessionRow.focusId,
                    rawInput: snapshot.contentText || JSON.stringify(snapshot),
                    tenantId,
                    userId,
                    sessionId,
                    onChunk: (chunk) => {
                      sendEvent("chunk", chunk);
                    },
                  });

                  const resolveRes = await AIOrchestratorService.resolveMailThread({
                    interpretationId: analysisRes.interpretationId,
                    tenantId,
                  });

                  sendEvent(
                    "status",
                    resolveRes.resolution?.addressResolution?.status === "unique_match"
                      ? { status: "building-review" }
                      : {
                          status: "awaiting-user-input",
                          message:
                            "Der Agent konnte den Geschäftspartner nicht eindeutig auflösen.",
                        },
                  );

                  const reviewRes = await AIOrchestratorService.buildMailReview({
                    interpretationId: analysisRes.interpretationId,
                    resolution: resolveRes.resolution,
                    tenantId,
                  });

                  const validation = await AIOrchestratorService.validateMailReview({
                    reviewId: reviewRes.reviewId,
                    tenantId,
                  });

                  const selectedBundle =
                    reviewRes.review.bundles?.find(
                      (bundle: any) => bundle.bundleId === reviewRes.review.selectedBundleId,
                    ) ??
                    reviewRes.review.bundles?.[0] ??
                    null;
                  const payload = {
                    ...reviewRes.review,
                    selectedBundleId: reviewRes.review.selectedBundleId ?? null,
                    selectedAddressId:
                      selectedBundle?.resolverSlots?.find(
                        (slot: any) => slot.slotKey === "customer",
                      )?.resolvedId ?? null,
                    selectedDocumentId:
                      selectedBundle?.resolverSlots?.find(
                        (slot: any) => slot.slotKey === "referenceDocument",
                      )?.resolvedId ?? null,
                    extraReplyInstruction: "",
                  };

                  sendEvent("review", {
                    reviewId: reviewRes.reviewId,
                    payload,
                    validation,
                  });

                  sendEvent("status", { status: "completed" });
                } catch (err: any) {
                  sendEvent("error", {
                    errorClass: err.errorClass || "AI_UNAVAILABLE",
                    message:
                      err.name === "AbortError"
                        ? "Analyse hat das Zeitlimit überschritten"
                        : err.message || "Analyse fehlgeschlagen",
                  });
                } finally {
                  clearTimeout(timeout);
                  controller.close();
                }
              },
            });

            return new Response(stream, { headers });
          }

          return new Response("Not Found", { status: 404 });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message, errorClass: "AI_UNAVAILABLE" }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },

      POST: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return new Response("Unauthorized", { status: 401 });

        const isSystemAdmin = (session.user as any).isSystemAdmin;
        const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context) return new Response("Forbidden", { status: 403 });
        const tenantId = context.tenantId;
        const userId = session.user.id;

        const url = new URL(request.url);
        const path = url.pathname;

        try {
          if (path === "/api/ai/llm-config") {
            const body = (await request.json()) as {
              scope?: "global" | "tenant";
              companyId?: string;
              provider?: string;
              endpointUrl?: string;
              model?: string;
              apiKey?: string;
              vertexCredentials?: string;
              githubToken?: string;
              githubRepo?: string;
              vertexProject?: string;
              vertexLocation?: string;
              isActive?: boolean;
            };

            const scope = body.scope || (body.companyId ? "tenant" : "global");

            if (scope === "tenant") {
              if (!body.companyId) {
                return new Response(JSON.stringify({ error: "companyId is required" }), {
                  status: 400,
                  headers: { "content-type": "application/json" },
                });
              }

              const [companyRow] = await db
                .select({ companyId: company.companyId })
                .from(company)
                .where(and(eq(company.companyId, body.companyId), eq(company.tenantId, tenantId)))
                .limit(1);

              if (!companyRow) return new Response("Company not found", { status: 404 });

              const [existing] = await db
                .select()
                .from(tenantLlmConfig)
                .where(
                  and(
                    eq(tenantLlmConfig.tenantId, tenantId),
                    eq(tenantLlmConfig.companyId, body.companyId),
                  ),
                )
                .limit(1);

              const resolvedApiKey =
                body.apiKey === SENTINEL
                  ? (existing?.apiKey ?? "")
                  : encryptEmailCredentials(body.apiKey ?? "");
              const resolvedGithubToken =
                body.githubToken === SENTINEL
                  ? (existing?.githubToken ?? "")
                  : encryptEmailCredentials(body.githubToken ?? "");
              const resolvedVertexCredentials =
                body.vertexCredentials === SENTINEL
                  ? (existing?.vertexCredentials ?? "")
                  : encryptEmailCredentials(body.vertexCredentials ?? "");

              const newValue = {
                tenantId,
                companyId: body.companyId,
                provider: body.provider ?? "",
                endpointUrl: body.endpointUrl ?? "",
                model: body.model ?? "",
                apiKey: resolvedApiKey,
                vertexCredentials: resolvedVertexCredentials,
                githubToken: resolvedGithubToken,
                githubRepo: body.githubRepo ?? "",
                vertexProject: body.vertexProject ?? "",
                vertexLocation: body.vertexLocation ?? "",
                isActive: body.isActive ?? true,
              };

              if (existing) {
                await db
                  .update(tenantLlmConfig)
                  .set({ ...newValue, updatedAt: new Date() })
                  .where(eq(tenantLlmConfig.tenantLlmConfigId, existing.tenantLlmConfigId));
              } else {
                await db.insert(tenantLlmConfig).values(newValue);
              }

              return new Response(JSON.stringify({ ok: true }), {
                headers: { "content-type": "application/json" },
              });
            }

            if (!isSystemAdmin) return new Response("Forbidden", { status: 403 });

            const [existing] = await db
              .select()
              .from(systemSettings)
              .where(and(eq(systemSettings.scope, "global"), eq(systemSettings.key, "llm_config")))
              .limit(1);

            const stored = (existing?.value ?? {}) as {
              apiKey?: string;
              vertexCredentials?: string;
              githubToken?: string;
            };

            const newValue = {
              provider: body.provider ?? "",
              endpointUrl: body.endpointUrl ?? "",
              model: body.model ?? "",
              apiKey:
                body.apiKey === SENTINEL
                  ? (stored.apiKey ?? "")
                  : encryptGlobalLlmSecret(body.apiKey ?? ""),
              vertexCredentials:
                body.vertexCredentials === SENTINEL
                  ? (stored.vertexCredentials ?? "")
                  : encryptGlobalLlmSecret(body.vertexCredentials ?? ""),
              githubToken:
                body.githubToken === SENTINEL
                  ? (stored.githubToken ?? "")
                  : encryptGlobalLlmSecret(body.githubToken ?? ""),
              githubRepo: body.githubRepo ?? "",
              vertexProject: body.vertexProject ?? "",
              vertexLocation: body.vertexLocation ?? "",
            };

            if (existing) {
              await db
                .update(systemSettings)
                .set({ value: newValue, updatedAt: new Date() })
                .where(eq(systemSettings.settingId, existing.settingId));
            } else {
              await db.insert(systemSettings).values({
                scope: "global",
                key: "llm_config",
                value: newValue,
              });
            }

            return new Response(JSON.stringify({ ok: true }), {
              headers: { "content-type": "application/json" },
            });
          }

          if (path === "/api/ai/llm-config/test") {
            const startedAt = performance.now();
            const body = (await request.json().catch(() => ({}))) as {
              scope?: "global" | "tenant";
              companyId?: string;
              provider?: string;
              endpointUrl?: string;
              model?: string;
              apiKey?: string;
              vertexCredentials?: string;
              vertexProject?: string;
              vertexLocation?: string;
              githubToken?: string;
              githubRepo?: string;
            };

            const scope = body.scope || (body.companyId ? "tenant" : "global");
            let config: LoadedLlmConfig | null = null;

            if (scope === "tenant") {
              if (!body.companyId) {
                return new Response(JSON.stringify({ error: "companyId is required" }), {
                  status: 400,
                  headers: { "content-type": "application/json" },
                });
              }

              const [companyRow] = await db
                .select({ companyId: company.companyId })
                .from(company)
                .where(and(eq(company.companyId, body.companyId), eq(company.tenantId, tenantId)))
                .limit(1);

              if (!companyRow) return new Response("Company not found", { status: 404 });
              config = await loadTenantLlmConfig(tenantId, body.companyId);
            } else {
              if (!isSystemAdmin) return new Response("Forbidden", { status: 403 });
              config = await loadGlobalLlmConfig();
            }

            if (!config) {
              return new Response(JSON.stringify({ configMissing: true }), {
                headers: { "content-type": "application/json" },
              });
            }

            const llmConfig = {
              ...config,
              provider: body.provider ?? config.provider,
              endpointUrl: body.endpointUrl ?? config.endpointUrl ?? "",
              model: body.model ?? config.model ?? "",
              apiKey:
                body.apiKey === undefined || body.apiKey === SENTINEL || body.apiKey === ""
                  ? config.apiKey
                  : body.apiKey,
              vertexCredentials:
                body.vertexCredentials === undefined || body.vertexCredentials === SENTINEL
                  ? config.vertexCredentials
                  : body.vertexCredentials,
              vertexProject: body.vertexProject ?? config.vertexProject ?? "",
              vertexLocation: body.vertexLocation ?? config.vertexLocation ?? "",
              githubToken:
                body.githubToken === undefined || body.githubToken === SENTINEL
                  ? config.githubToken
                  : body.githubToken,
              githubRepo: body.githubRepo ?? config.githubRepo ?? "",
            };

            try {
              const { createConfiguredProvider } = await import("@repo/agent");
              const provider = createConfiguredProvider({
                provider: llmConfig.provider,
                model: llmConfig.model,
                apiKey: llmConfig.apiKey || undefined,
                endpointUrl: llmConfig.endpointUrl || undefined,
                vertexCredentials: llmConfig.vertexCredentials || undefined,
                vertexProject: llmConfig.vertexProject || undefined,
                vertexLocation: llmConfig.vertexLocation || undefined,
              });

              const requestStartedAt = performance.now();
              const response = await provider.chat({
                messages: [{ role: "user", content: "Reply with exactly: pong" }],
              });
              const requestFinishedAt = performance.now();

              const content =
                typeof response === "string"
                  ? response
                  : response && typeof response === "object" && "content" in response
                    ? typeof (response as { content?: unknown }).content === "string"
                      ? ((response as { content: string }).content ?? "")
                      : JSON.stringify((response as { content?: unknown }).content ?? "")
                    : JSON.stringify(response);

              return new Response(
                JSON.stringify({
                  ok: true,
                  content,
                  model: llmConfig.model,
                  provider: llmConfig.provider || "google_ai_studio",
                  timings: {
                    totalMs: Math.round(requestFinishedAt - startedAt),
                    llmRequestMs: Math.round(requestFinishedAt - requestStartedAt),
                  },
                }),
                { headers: { "content-type": "application/json" } },
              );
            } catch (error) {
              const requestFinishedAt = performance.now();
              const message = error instanceof Error ? error.message : "Unknown provider error";

              return new Response(
                JSON.stringify({
                  ok: false,
                  error: message,
                  provider: llmConfig.provider || "google_ai_studio",
                  model: llmConfig.model,
                  timings: {
                    totalMs: Math.round(requestFinishedAt - startedAt),
                  },
                }),
                {
                  status: 502,
                  headers: { "content-type": "application/json" },
                },
              );
            }
          }

          // 0. POST /api/ai/sessions
          if (path === "/api/ai/sessions") {
            const body = (await request.json().catch(() => null)) as {
              focusType?: string | null;
              focusId?: string | null;
              mode?: string | null;
            } | null;

            if (!body?.focusType || !body.focusId) {
              return new Response(JSON.stringify({ error: "focusType and focusId are required" }), {
                status: 400,
                headers: { "content-type": "application/json" },
              });
            }

            const mode = body.mode?.trim() || "sync";

            const [sessionRow] = await db
              .insert(aiSession)
              .values({
                tenantId,
                userId,
                focusType: body.focusType,
                focusId: body.focusId,
                mode,
                status: "active",
              })
              .returning({
                sessionId: aiSession.sessionId,
                status: aiSession.status,
                focusType: aiSession.focusType,
                focusId: aiSession.focusId,
                mode: aiSession.mode,
              });

            return new Response(
              JSON.stringify({
                sessionId: sessionRow.sessionId,
                status: sessionRow.status,
                focusType: sessionRow.focusType,
                focusId: sessionRow.focusId,
                mode: sessionRow.mode,
              }),
              {
                status: 201,
                headers: { "content-type": "application/json" },
              },
            );
          }

          // 0. POST /api/ai/context/resolve
          if (path === "/api/ai/context/resolve") {
            const body = (await request.json()) as {
              workspace?: string | null;
              panel?: string | null;
              focusArea?: string | null;
              entityName?: string | null;
              recordId?: string | null;
              mode?: string | null;
              invocationSource?: string | null;
            };

            const supportedTasks: Array<{ taskScope: string; label: string; icon: string }> = [];
            let defaultTaskScope: string | null = null;
            let sourceEntity: string | null = null;
            let sourceId: string | null = null;
            let allowedCommands: string[] = [];

            if (
              (body.workspace === "email" || body.entityName === "emailThread") &&
              body.recordId
            ) {
              const threadId = body.recordId;
              const threadExists = await db
                .select()
                .from(emailThread)
                .where(
                  and(eq(emailThread.emailThreadId, threadId), eq(emailThread.tenantId, tenantId)),
                )
                .limit(1);

              if (threadExists.length === 0) {
                return new Response(
                  JSON.stringify({
                    error: "E-Mail-Thread nicht gefunden oder gehört anderem Mandanten",
                    errorClass: "CONTEXT_NOT_RESOLVABLE",
                  }),
                  {
                    status: 404,
                    headers: { "content-type": "application/json" },
                  },
                );
              }

              supportedTasks.push({
                taskScope: "mail-order-review",
                label: "E-Mail prüfen & Auftrag auflösen",
                icon: "Sparkles",
              });
              defaultTaskScope = "mail-order-review";
              sourceEntity = "emailThread";
              sourceId = threadId;
              allowedCommands = [
                "apply-ai-mail-classification",
                "convert-document-from-ai-review",
                "prepare-document-email",
              ];
            }

            return new Response(
              JSON.stringify({
                supportedTasks,
                defaultTaskScope,
                sourceEntity,
                sourceId,
                allowedCommands,
              }),
              {
                headers: { "content-type": "application/json" },
              },
            );
          }

          // 1. POST /api/ai/catalog/context
          if (path === "/api/ai/catalog/context") {
            const catalogContext = await AIDiscoveryService.getSemanticContext(tenantId);
            return new Response(JSON.stringify({ context: catalogContext }), {
              headers: { "content-type": "application/json" },
            });
          }

          // 2. POST /api/ai/plan
          if (path === "/api/ai/plan") {
            const body = (await request.json()) as {
              taskScope?: string[];
              rawInput: string;
            };
            if (!body.rawInput) {
              return new Response(JSON.stringify({ error: "Missing rawInput parameter" }), {
                status: 400,
                headers: { "content-type": "application/json" },
              });
            }

            // Extract emailThreadId from rawInput context if present
            let emailThreadId = "";
            try {
              const parsed = JSON.parse(body.rawInput);
              emailThreadId = parsed.emailThreadId || "";
            } catch {
              // Ignore
            }

            // V2 Hybrid Orchestrated Compatibility Wrapper
            const { AIOrchestratorService } = await import("@repo/db/services/ai-orchestrator");
            const interpretRes = await AIOrchestratorService.interpretMailThread({
              threadId: emailThreadId || crypto.randomUUID(),
              rawInput: body.rawInput,
              tenantId,
              userId,
            });

            const resolveRes = await AIOrchestratorService.resolveMailThread({
              interpretationId: interpretRes.interpretationId,
              tenantId,
            });

            const reviewRes = await AIOrchestratorService.buildMailReview({
              interpretationId: interpretRes.interpretationId,
              resolution: resolveRes.resolution,
              tenantId,
            });

            const _validation = await AIOrchestratorService.validateMailReview({
              reviewId: reviewRes.reviewId,
              tenantId,
            });

            // Convert the bundle review back to legacy step format for compatibility.
            const steps: any[] = [];
            const selectedBundle =
              reviewRes.review.bundles?.find(
                (bundle: any) => bundle.bundleId === reviewRes.review.selectedBundleId,
              ) ??
              reviewRes.review.bundles?.[0] ??
              null;
            const customerSlot = selectedBundle?.resolverSlots?.find(
              (slot: any) => slot.slotKey === "customer",
            );
            const documentSlot = selectedBundle?.resolverSlots?.find(
              (slot: any) => slot.slotKey === "referenceDocument",
            );

            if (customerSlot || documentSlot) {
              steps.push({
                stepIndex: 1,
                actionType: "LOOKUP",
                entityName: "address",
                lookupCriteria: customerSlot?.candidates?.[0] ? { name: "search" } : {},
                candidateMatches: (customerSlot?.candidates || []).map((c: any) => ({
                  id: c.id,
                  displayValue: c.label,
                  matchScore: c.score ?? (c.recommended ? 1.0 : 0.8),
                })),
                selectedMatchId: customerSlot?.resolvedId || undefined,
              });
            }

            if (documentSlot) {
              steps.push({
                stepIndex: steps.length + 1,
                actionType: "LOOKUP",
                entityName: "document",
                lookupCriteria: documentSlot.candidates?.[0] ? { code: "search" } : {},
                candidateMatches: documentSlot.candidates.map((c: any) => ({
                  id: c.id,
                  displayValue: c.label,
                  matchScore: c.score ?? (c.recommended ? 1.0 : 0.8),
                })),
                selectedMatchId: documentSlot.resolvedId || undefined,
              });
            }

            if (
              selectedBundle?.commandPreview?.some(
                (step: any) => step.commandKey === "convert-document-from-ai-review",
              )
            ) {
              steps.push({
                stepIndex: steps.length + 1,
                actionType: "EXECUTE_COMMAND",
                commandKey: "convert-document-from-ai-review",
                commandPayload: {
                  sourceDocumentId: documentSlot?.resolvedId ? `dependency:2` : undefined,
                  targetDocType: "Order",
                },
              });
            }

            steps.push({
              stepIndex: steps.length + 1,
              actionType: "EXECUTE_COMMAND",
              commandKey: "apply-ai-mail-classification",
              commandPayload: {
                relatedAddressId: customerSlot ? `dependency:1` : undefined,
                relatedDocumentId: documentSlot ? `dependency:${customerSlot ? 2 : 1}` : undefined,
              },
            });

            if (
              selectedBundle?.commandPreview?.some(
                (step: any) => step.commandKey === "prepare-document-email",
              )
            ) {
              steps.push({
                stepIndex: steps.length + 1,
                actionType: "EXECUTE_COMMAND",
                commandKey: "prepare-document-email",
                commandPayload: {
                  documentId: documentSlot?.resolvedId ? `dependency:2` : undefined,
                  emailIdentityId: undefined,
                },
              });
            }

            return new Response(
              JSON.stringify({
                planId: reviewRes.reviewId, // Map reviewId as planId
                planJson: {
                  steps,
                  bundles: reviewRes.review.bundles,
                  selectedBundleId: reviewRes.review.selectedBundleId,
                  businessIntention: reviewRes.review.intentBadge.label,
                  confidenceScore: reviewRes.review.intentBadge.confidenceScore,
                  applyReadiness:
                    reviewRes.review.reviewStatus === "ready_for_review"
                      ? "ready_for_review"
                      : "needs_user_input",
                  blockedReasons: reviewRes.review.blockingIssues.map((i: any) => i.message),
                  _llmTrace: reviewRes.review._llmTrace,
                },
                validation: {
                  warnings: reviewRes.review.warnings,
                  blockedReasons: reviewRes.review.blockingIssues.map((i: any) => i.message),
                },
              }),
              {
                headers: { "content-type": "application/json" },
              },
            );
          }

          // 3. POST /api/ai/tasks/mail/interpret-thread
          if (path === "/api/ai/tasks/mail/interpret-thread") {
            const body = (await request.json()) as {
              threadId: string;
              rawInput?: string;
              customInstructions?: string;
            };
            const { AIOrchestratorService } = await import("@repo/db/services/ai-orchestrator");
            const result = await AIOrchestratorService.interpretMailThread({
              threadId: body.threadId,
              rawInput: body.rawInput,
              customInstructions: body.customInstructions,
              tenantId,
              userId,
            });
            return new Response(JSON.stringify(result), {
              headers: { "content-type": "application/json" },
            });
          }

          // 4. POST /api/ai/tasks/mail/resolve-thread
          if (path === "/api/ai/tasks/mail/resolve-thread") {
            const body = (await request.json()) as { interpretationId: string };
            const { AIOrchestratorService } = await import("@repo/db/services/ai-orchestrator");
            const result = await AIOrchestratorService.resolveMailThread({
              interpretationId: body.interpretationId,
              tenantId,
            });
            return new Response(JSON.stringify(result), {
              headers: { "content-type": "application/json" },
            });
          }

          // 5. POST /api/ai/tasks/mail/build-review
          if (path === "/api/ai/tasks/mail/build-review") {
            const body = (await request.json()) as { interpretationId: string; resolution: any };
            const { AIOrchestratorService } = await import("@repo/db/services/ai-orchestrator");
            const result = await AIOrchestratorService.buildMailReview({
              interpretationId: body.interpretationId,
              resolution: body.resolution,
              tenantId,
            });
            return new Response(JSON.stringify(result), {
              headers: { "content-type": "application/json" },
            });
          }

          // 6. POST /api/ai/reviews/:reviewId/validate
          if (path.startsWith("/api/ai/reviews/") && path.endsWith("/validate")) {
            const parts = path.split("/");
            const reviewId = parts[parts.length - 2];
            const body = ((await request.json()) as { overrides?: any }) || {};
            const { AIOrchestratorService } = await import("@repo/db/services/ai-orchestrator");
            const result = await AIOrchestratorService.validateMailReview({
              reviewId,
              overrides: body.overrides,
              tenantId,
            });
            return new Response(JSON.stringify(result), {
              headers: { "content-type": "application/json" },
            });
          }

          // 7. POST /api/ai/reviews/:reviewId/apply
          if (path.startsWith("/api/ai/reviews/") && path.endsWith("/apply")) {
            const parts = path.split("/");
            const reviewId = parts[parts.length - 2];
            const body = ((await request.json()) as { overrides?: any }) || {};
            const { AIOrchestratorService } = await import("@repo/db/services/ai-orchestrator");
            const result = await AIOrchestratorService.applyMailReview({
              reviewId,
              overrides: body.overrides,
              tenantId,
              userId,
            });
            return new Response(JSON.stringify(result), {
              headers: { "content-type": "application/json" },
            });
          }

          // POST /api/ai/inline-edit
          if (path === "/api/ai/inline-edit") {
            const body = (await request.json()) as {
              text: string;
              action: "improve" | "shorten" | "formal" | "translate";
            };

            if (!body.text || !body.action) {
              return new Response(JSON.stringify({ error: "text and action are required" }), {
                status: 400,
                headers: { "content-type": "application/json" },
              });
            }

            const { resolveLlmRuntimeConfig } = await import("@repo/db/services/ai-orchestrator");
            const llm = await resolveLlmRuntimeConfig(tenantId, userId);

            let prompt = "";
            if (body.action === "improve") {
              prompt = `Verbessere den folgenden Text bezüglich Grammatik, Stil und Lesbarkeit. Behalte den Inhalt und die Bedeutung bei:\n\n${body.text}`;
            } else if (body.action === "shorten") {
              prompt = `Kürze den folgenden Text auf das Wesentliche, ohne wichtige Informationen zu verlieren:\n\n${body.text}`;
            } else if (body.action === "formal") {
              prompt = `Formuliere den folgenden Text professioneller, höflicher und formeller (z.B. Sie-Form):\n\n${body.text}`;
            } else if (body.action === "translate") {
              prompt = `Übersetze den folgenden Text. Wenn er auf Deutsch ist, übersetze ihn ins Englische. Wenn er auf Englisch (oder einer anderen Sprache) ist, übersetze ihn ins Deutsche:\n\n${body.text}`;
            }

            const { createConfiguredProvider } = await import("@repo/agent");
            const provider = createConfiguredProvider({
              provider: llm.providerName,
              model: llm.modelName,
              apiKey: llm.apiKey || undefined,
              endpointUrl: llm.gatewayUrl || undefined,
              vertexCredentials: llm.vertexCredentials || undefined,
              vertexProject: llm.vertexProject || undefined,
              vertexLocation: llm.vertexLocation || undefined,
            });

            const responseText = (await provider.chat({
              messages: [{ role: "user", content: prompt }],
            })) as string;

            return new Response(JSON.stringify({ result: responseText.trim() }), {
              headers: { "content-type": "application/json" },
            });
          }

          // POST /api/ai/memories/:memoryId/confirm
          if (path.startsWith("/api/ai/memories/") && path.endsWith("/confirm")) {
            const parts = path.split("/");
            const memoryId = parts[parts.length - 2];

            const [updated] = await db
              .update(aiMemory)
              .set({ confirmedAt: new Date() })
              .where(and(eq(aiMemory.memoryId, memoryId), eq(aiMemory.tenantId, tenantId)))
              .returning();

            if (!updated) {
              return new Response("Memory not found", { status: 404 });
            }

            return new Response(JSON.stringify({ success: true, memory: updated }), {
              headers: { "content-type": "application/json" },
            });
          }

          // POST /api/ai/memories/:memoryId/reject
          if (path.startsWith("/api/ai/memories/") && path.endsWith("/reject")) {
            const parts = path.split("/");
            const memoryId = parts[parts.length - 2];

            await db
              .delete(aiMemory)
              .where(and(eq(aiMemory.memoryId, memoryId), eq(aiMemory.tenantId, tenantId)));

            return new Response(JSON.stringify({ success: true }), {
              headers: { "content-type": "application/json" },
            });
          }

          // Fallback legacy endpoints
          if (path.startsWith("/api/ai/plans/") && path.endsWith("/validate")) {
            const parts = path.split("/");
            const planId = parts[parts.length - 2];
            const { AIOrchestratorService } = await import("@repo/db/services/ai-orchestrator");
            const result = await AIOrchestratorService.validateMailReview({
              reviewId: planId,
              tenantId,
            });
            return new Response(JSON.stringify(result), {
              headers: { "content-type": "application/json" },
            });
          }

          if (path.startsWith("/api/ai/plans/") && path.endsWith("/apply")) {
            const parts = path.split("/");
            const planId = parts[parts.length - 2];
            const body = (await request.json()) as { userOverrides?: any };
            const { AIOrchestratorService } = await import("@repo/db/services/ai-orchestrator");
            const result = await AIOrchestratorService.applyMailReview({
              reviewId: planId,
              overrides: body.userOverrides,
              tenantId,
              userId,
            });
            const status = result.success ? 200 : 400;
            return new Response(JSON.stringify({ status: result.success ? "success" : "failed" }), {
              status,
              headers: { "content-type": "application/json" },
            });
          }

          return new Response("Not Found", { status: 404 });
        } catch (e: any) {
          let errorClass = "AI_UNAVAILABLE";
          const msg = e.message || "";
          if (msg.includes("Unauthorized") || msg.includes("Forbidden")) {
            errorClass = "UNAUTHORIZED";
          } else if (msg.includes("not found") || msg.includes("exist")) {
            errorClass = "CONTEXT_NOT_RESOLVABLE";
          } else if (msg.includes("Timeout") || msg.includes("timeout")) {
            errorClass = "MODEL_TIMEOUT";
          } else if (msg.includes("validation") || msg.includes("Zod")) {
            errorClass = "SCHEMA_VALIDATION_FAILED";
          } else if (msg.includes("stale") || msg.includes("lock") || msg.includes("version")) {
            errorClass = "STALE_CONTEXT";
          } else if (msg.includes("apply") || msg.includes("Apply") || msg.includes("Command")) {
            errorClass = "APPLY_VALIDATION_FAILED";
          }

          return new Response(JSON.stringify({ error: msg, errorClass }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
      },
      DELETE: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return new Response("Unauthorized", { status: 401 });

        const isSystemAdmin = (session.user as any).isSystemAdmin;
        const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context) return new Response("Forbidden", { status: 403 });
        const tenantId = context.tenantId;

        const url = new URL(request.url);
        const path = url.pathname;

        try {
          if (path.startsWith("/api/ai/memories/")) {
            const parts = path.split("/");
            const memoryId = parts[parts.length - 1];

            await db
              .delete(aiMemory)
              .where(and(eq(aiMemory.memoryId, memoryId), eq(aiMemory.tenantId, tenantId)));

            return new Response(JSON.stringify({ success: true }), {
              headers: { "content-type": "application/json" },
            });
          }
          return new Response("Not Found", { status: 404 });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
