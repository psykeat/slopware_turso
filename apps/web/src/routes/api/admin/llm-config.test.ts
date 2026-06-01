import { auth } from "@repo/auth/auth";
import { db } from "@repo/db";
import { systemSettings } from "@repo/db/schema";
import { createFileRoute } from "@tanstack/react-router";
import { and, eq } from "drizzle-orm";

import { decrypt } from "./llm-config";

const SENTINEL = "••••••••";

function inferProvider(model: string, provider?: string): string {
  if (model.startsWith("vertex_ai/")) return "vertex_ai";
  if (model.startsWith("gemini/")) return "google_ai_studio";
  if (provider) return provider;
  return "openai";
}

function safeErrorMessage(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.detail === "string") return record.detail;
    if (typeof record.error === "string") return record.error;
  }
  return "Unknown error";
}

export const Route = createFileRoute("/api/admin/llm-config/test")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const startedAt = performance.now();
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) {
          return new Response("Unauthorized", { status: 401 });
        }

        const isSystemAdmin = (session.user as Record<string, unknown>).isSystemAdmin;
        if (!isSystemAdmin) {
          return new Response("Forbidden", { status: 403 });
        }

        const body = (await request.json().catch(() => ({}))) as {
          provider?: string;
          endpointUrl?: string;
          model?: string;
          apiKey?: string;
          vertexCredentials?: string;
          vertexProject?: string;
          vertexLocation?: string;
        };

        const configRow = await db
          .select()
          .from(systemSettings)
          .where(and(eq(systemSettings.scope, "global"), eq(systemSettings.key, "llm_config")))
          .limit(1);

        if (!configRow[0]) {
          return new Response(JSON.stringify({ configMissing: true }), {
            headers: { "content-type": "application/json" },
          });
        }

        const storedConfig = configRow[0].value as {
          provider?: string;
          endpointUrl: string;
          model: string;
          apiKey: string;
          vertexCredentials?: string;
          vertexProject?: string;
          vertexLocation?: string;
        };

        const provider = inferProvider(
          body.model ?? storedConfig.model,
          body.provider ?? storedConfig.provider,
        );
        const configLoadedAt = performance.now();
        const llmConfig = {
          ...storedConfig,
          provider,
          endpointUrl: body.endpointUrl ?? storedConfig.endpointUrl,
          model: body.model ?? storedConfig.model,
          vertexProject: body.vertexProject ?? storedConfig.vertexProject,
          vertexLocation: body.vertexLocation ?? storedConfig.vertexLocation,
          vertexCredentials:
            body.vertexCredentials === undefined || body.vertexCredentials === SENTINEL
              ? decrypt(storedConfig.vertexCredentials ?? "")
              : body.vertexCredentials,
          apiKey:
            body.apiKey === undefined || body.apiKey === SENTINEL || body.apiKey === ""
              ? decrypt(storedConfig.apiKey ?? "")
              : body.apiKey,
        };
        const gatewayUrl = llmConfig.endpointUrl || "http://localhost:11435";
        const requestStartedAt = performance.now();

        const llmRes = await fetch(`${gatewayUrl}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(15000),
          body: JSON.stringify({
            prompt: "Reply with exactly: pong",
            model: llmConfig.model,
            endpoint_url: gatewayUrl,
            provider: llmConfig.provider,
            api_key: llmConfig.apiKey || undefined,
            vertex_credentials: llmConfig.vertexCredentials || undefined,
            vertex_project: llmConfig.vertexProject || undefined,
            vertex_location: llmConfig.vertexLocation || undefined,
            max_tokens: 8,
            direct_vertex_test: llmConfig.provider === "vertex_ai",
          }),
        });

        const rawBody = await llmRes.text();
        const requestFinishedAt = performance.now();
        if (!llmRes.ok) {
          let parsed: unknown = rawBody;
          try {
            parsed = JSON.parse(rawBody) as unknown;
          } catch {
            // keep raw text
          }

          return new Response(
            JSON.stringify({
              ok: false,
              status: llmRes.status,
              error: safeErrorMessage(parsed),
              raw: rawBody,
              timings: {
                totalMs: Math.round(requestFinishedAt - startedAt),
                configLoadMs: Math.round(configLoadedAt - startedAt),
                llmRequestMs: Math.round(requestFinishedAt - requestStartedAt),
              },
            }),
            {
              status: 502,
              headers: { "content-type": "application/json" },
            },
          );
        }

        const parsed = JSON.parse(rawBody) as {
          content?: string;
          model?: string;
          provider?: string;
          usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
        };

        return new Response(
          JSON.stringify({
            ok: true,
            content: parsed.content ?? "",
            model: parsed.model ?? llmConfig.model,
            provider: parsed.provider ?? llmConfig.provider,
            usage: parsed.usage ?? null,
            timings: {
              totalMs: Math.round(requestFinishedAt - startedAt),
              configLoadMs: Math.round(configLoadedAt - startedAt),
              llmRequestMs: Math.round(requestFinishedAt - requestStartedAt),
            },
          }),
          { headers: { "content-type": "application/json" } },
        );
      },
    },
  },
});
