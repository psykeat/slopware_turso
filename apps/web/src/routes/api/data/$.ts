import { auth } from "@repo/auth/auth";
import { DataService } from "@repo/db/services/data";
import { DocumentService } from "@repo/db/services/document-service";
import { createFileRoute } from "@tanstack/react-router";

import { resolveTenantContext } from "#/lib/resolve-tenant";

export const Route = createFileRoute("/api/data/$")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session || !session.user) {
          return new Response("Unauthorized", { status: 401 });
        }

        const isSystemAdmin = (session.user as any).isSystemAdmin;
        const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context && !isSystemAdmin) {
          return new Response("No active tenant found", { status: 403 });
        }

        const service = new DataService(context?.tenantId ?? "", isSystemAdmin);
        const url = new URL(request.url);
        const segments = url.pathname.split("/").filter(Boolean);
        // /api/data/[entity] OR /api/data/[entity]/[id]
        // Segments are: api, data, entity, [id]
        const entityName = segments[2];
        const id = segments[3];

        if (!entityName) return new Response("Bad Request", { status: 400 });

        try {
          if (id) {
            console.log(`[Data API] GET Single: ${entityName} ID: ${id}`);
            const result = await service.get(entityName, id);
            if (!result) return new Response("Not Found", { status: 404 });
            return new Response(JSON.stringify(result), {
              headers: { "content-type": "application/json" },
            });
          }

          // Extract query params for FK filtering; exclude pagination/reserved keys
          const reserved = new Set([
            "limit",
            "offset",
            "page",
            "orderBy",
            "paginated",
            "search",
            "filters",
          ]);
          const filters: Record<string, string> = {};
          for (const [key, value] of url.searchParams.entries()) {
            if (!reserved.has(key)) {
              filters[key] = value;
            }
          }

          const limit = url.searchParams.get("limit")
            ? Number(url.searchParams.get("limit"))
            : undefined;
          const orderBy = url.searchParams.get("orderBy") ?? undefined;
          const paginated = url.searchParams.get("paginated") === "true";
          const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
          const effectiveLimit = limit ?? 50;
          const offset = paginated ? (page - 1) * effectiveLimit : undefined;

          const search = url.searchParams.get("search") ?? undefined;
          const filtersParam = url.searchParams.get("filters");
          let filterRules: Array<{ col: string; op: string; val: string }> | undefined;
          if (filtersParam) {
            try {
              filterRules = JSON.parse(filtersParam);
            } catch {
              /* ignore */
            }
          }

          console.log(`[Data API] GET List: ${entityName} Filters:`, filters);

          if (paginated) {
            const result = (await service.list(entityName, filters, {
              limit: effectiveLimit,
              offset,
              orderBy,
              count: true,
              search,
              filterRules,
            })) as { data: any[]; total: number };
            return new Response(JSON.stringify(result), {
              headers: { "content-type": "application/json" },
            });
          }

          const data = await service.list(entityName, filters, {
            limit,
            orderBy,
            search,
            filterRules,
          });
          return new Response(JSON.stringify(data), {
            headers: { "content-type": "application/json" },
          });
        } catch (err: any) {
          console.error(`[Data API] Error:`, err);
          return new Response(err.message, { status: 500 });
        }
      },
      POST: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session || !session.user) return new Response("Unauthorized", { status: 401 });

        const isSystemAdmin = (session.user as any).isSystemAdmin;
        const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context && !isSystemAdmin) return new Response("Forbidden", { status: 403 });

        const service = new DataService(context?.tenantId ?? "", isSystemAdmin);
        const entityName = new URL(request.url).pathname.split("/").filter(Boolean)[2];
        if (!entityName) return new Response("Bad Request", { status: 400 });

        try {
          const body = await request.json();
          if (entityName === "documentLine") {
            const documentService = new DocumentService();
            const result = await documentService.createDocumentLine(context?.tenantId ?? "", body);
            return new Response(JSON.stringify(result), {
              headers: { "content-type": "application/json" },
            });
          }

          const result = await service.create(entityName, body);
          return new Response(JSON.stringify(result), {
            headers: { "content-type": "application/json" },
          });
        } catch (err: any) {
          console.error(`[Data API] POST Error:`, err);
          return new Response(err.message ?? "Internal error", { status: 400 });
        }
      },
      PATCH: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session || !session.user) return new Response("Unauthorized", { status: 401 });

        const isSystemAdmin = (session.user as any).isSystemAdmin;
        const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context && !isSystemAdmin) return new Response("Forbidden", { status: 403 });

        const service = new DataService(context?.tenantId ?? "", isSystemAdmin);
        const segments = new URL(request.url).pathname.split("/").filter(Boolean);
        const entityName = segments[2];
        const id = segments[3];

        if (!entityName || !id) return new Response("Bad Request", { status: 400 });

        try {
          const body = await request.json();
          const result = await service.patch(entityName, id, body);
          return new Response(JSON.stringify(result), {
            headers: { "content-type": "application/json" },
          });
        } catch (err: any) {
          console.error(`[Data API] PATCH Error:`, err);
          return new Response(err.message ?? "Internal error", { status: 400 });
        }
      },
      DELETE: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session || !session.user) return new Response("Unauthorized", { status: 401 });

        const isSystemAdmin = (session.user as any).isSystemAdmin;
        const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context && !isSystemAdmin) return new Response("Forbidden", { status: 403 });

        const service = new DataService(context?.tenantId ?? "", isSystemAdmin);
        const segments = new URL(request.url).pathname.split("/").filter(Boolean);
        const entityName = segments[2];
        const id = segments[3];

        if (!entityName || !id) return new Response("Bad Request", { status: 400 });

        try {
          const result = await service.delete(entityName, id);
          if (result.fkViolation) {
            return new Response(JSON.stringify({ fkViolation: true }), {
              status: 409,
              headers: { "content-type": "application/json" },
            });
          }
          if (!result.deleted) return new Response("Not Found", { status: 404 });
          return new Response(JSON.stringify({ deleted: true }), {
            headers: { "content-type": "application/json" },
          });
        } catch (err: any) {
          console.error("[Data API] DELETE Error:", err);
          return new Response(err.message ?? "Internal error", { status: 400 });
        }
      },
    },
  },
});
