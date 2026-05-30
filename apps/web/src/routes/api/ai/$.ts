import { auth } from "@repo/auth/auth";
import { AIDiscoveryService } from "@repo/db/services/ai-discovery";
import { AIPlanningService } from "@repo/db/services/ai-planning";
import { createFileRoute } from "@tanstack/react-router";

import { resolveTenantContext } from "#/lib/resolve-tenant";

const AI_PLAN_SCOPES = new Set(["mail-classification", "mail-to-document-draft"]);

function normalizePlanScope(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    return ["mail-classification"];
  }
  const scopes = value.filter((item): item is string => typeof item === "string");
  if (scopes.length !== value.length || scopes.some((scope) => !AI_PLAN_SCOPES.has(scope))) {
    throw new Error("Unsupported AI taskScope");
  }
  return scopes;
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

        const url = new URL(request.url);
        const path = url.pathname;

        try {
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

          return new Response("Not Found", { status: 404 });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), {
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

            let taskScope: string[];
            try {
              taskScope = normalizePlanScope(body.taskScope);
            } catch (error: any) {
              return new Response(JSON.stringify({ error: error.message }), {
                status: 400,
                headers: { "content-type": "application/json" },
              });
            }
            const plan = await AIPlanningService.createPlan({
              taskScope,
              rawInput: body.rawInput,
              tenantId,
              userId,
            });

            return new Response(JSON.stringify(plan), {
              headers: { "content-type": "application/json" },
            });
          }

          // 3. POST /api/ai/plans/:planId/validate
          if (path.startsWith("/api/ai/plans/") && path.endsWith("/validate")) {
            const parts = path.split("/");
            const planId = parts[parts.length - 2]; // Extract planId from second to last segment
            const result = await AIPlanningService.validatePlan(planId, tenantId);
            return new Response(JSON.stringify(result), {
              headers: { "content-type": "application/json" },
            });
          }

          // 4. POST /api/ai/plans/:planId/apply
          if (path.startsWith("/api/ai/plans/") && path.endsWith("/apply")) {
            const parts = path.split("/");
            const planId = parts[parts.length - 2]; // Extract planId
            const body = (await request.json()) as { userOverrides?: any };

            const result = await AIPlanningService.applyPlan({
              planId,
              userOverrides: body.userOverrides || {},
              tenantId,
              userId,
            });

            const status = result.status === "success" ? 200 : 400;
            return new Response(JSON.stringify(result), {
              status,
              headers: { "content-type": "application/json" },
            });
          }

          return new Response("Not Found", { status: 404 });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
