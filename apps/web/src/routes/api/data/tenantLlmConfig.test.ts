import { auth } from "@repo/auth/auth";
import { db } from "@repo/db";
import { company } from "@repo/db/schema";
import { createFileRoute } from "@tanstack/react-router";
import { and, eq } from "drizzle-orm";

import { resolveTenantContext } from "#/lib/resolve-tenant";

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

export const Route = createFileRoute("/api/data/tenantLlmConfig/test")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const startedAt = performance.now();
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) {
          return new Response("Unauthorized", { status: 401 });
        }

        const isSystemAdmin = Boolean((session.user as Record<string, unknown>).isSystemAdmin);
        const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context) {
          return new Response("No active tenant found", { status: 403 });
        }

        const body = (await request.json().catch(() => ({}))) as {
          provider?: string;
          endpointUrl?: string;
          model?: string;
          apiKey?: string;
          vertexCredentials?: string;
          vertexProject?: string;
          vertexLocation?: string;
          githubToken?: string;
          githubRepo?: string;
          companyId?: string;
        };

        if (!body.companyId) {
          return new Response(JSON.stringify({ error: "companyId is required" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }

        const companyRow = await db
          .select({ companyId: company.companyId })
          .from(company)
          .where(and(eq(company.companyId, body.companyId), eq(company.tenantId, context.tenantId)))
          .limit(1);

        if (!companyRow[0]) {
          return new Response("Company not found", { status: 404 });
        }

        const provider = inferProvider(body.model ?? "", body.provider);
        const gatewayUrl = body.endpointUrl || "http://localhost:11435";
        const requestStartedAt = performance.now();

        const llmRes = await fetch(`${gatewayUrl}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(15000),
          body: JSON.stringify({
            prompt: "Reply with exactly: pong",
            model: body.model ?? "gemini/gemini-2.5-flash",
            endpoint_url: gatewayUrl,
            provider,
            api_key: body.apiKey && body.apiKey !== SENTINEL ? body.apiKey : undefined,
            vertex_credentials:
              body.vertexCredentials && body.vertexCredentials !== SENTINEL
                ? body.vertexCredentials
                : undefined,
            vertex_project: body.vertexProject || undefined,
            vertex_location: body.vertexLocation || undefined,
            github_token: body.githubToken || undefined,
            github_repo: body.githubRepo || undefined,
            max_tokens: 8,
            direct_vertex_test: provider === "vertex_ai",
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
            model: parsed.model ?? body.model ?? "gemini/gemini-2.5-flash",
            provider: parsed.provider ?? provider,
            usage: parsed.usage ?? null,
            timings: {
              totalMs: Math.round(requestFinishedAt - startedAt),
              llmRequestMs: Math.round(requestFinishedAt - requestStartedAt),
            },
          }),
          { headers: { "content-type": "application/json" } },
        );
      },
    },
  },
});
