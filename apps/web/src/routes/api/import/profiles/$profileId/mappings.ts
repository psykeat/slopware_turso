import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@repo/auth/auth";
import { resolveTenantContext } from "#/lib/resolve-tenant";
import { ImportService } from "@repo/db/services/import-service";

export const Route = createFileRoute("/api/import/profiles/$profileId/mappings")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return new Response("Unauthorized", { status: 401 });
        const isSystemAdmin = (session.user as any).isSystemAdmin;
        const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context) return new Response("No active tenant found", { status: 403 });

        const url = new URL(request.url);
        const connectorId = url.searchParams.get("connectorId");
        if (!connectorId) {
          return new Response("connectorId query param is required", { status: 400 });
        }

        try {
          const svc = new ImportService(context.tenantId, session.user.id);
          const mappings = await svc.getMappings(connectorId, params.profileId);
          return new Response(JSON.stringify(mappings), {
            headers: { "content-type": "application/json" },
          });
        } catch (err: any) {
          return new Response(err.message, { status: 400 });
        }
      },

      POST: async ({ request, params }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return new Response("Unauthorized", { status: 401 });
        const isSystemAdmin = (session.user as any).isSystemAdmin;
        const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context) return new Response("No active tenant found", { status: 403 });

        try {
          const body = (await request.json()) as {
            connectorId: string;
            rows: Array<{
              sourceField: string;
              targetTable: string;
              targetColumn: string;
              transform?: object;
              defaultValue?: unknown;
            }>;
          };

          if (!body.connectorId) {
            return new Response("connectorId is required", { status: 400 });
          }

          const svc = new ImportService(context.tenantId, session.user.id);
          await svc.saveMappings(body.connectorId, params.profileId, body.rows ?? []);
          return new Response(JSON.stringify({ ok: true }), {
            headers: { "content-type": "application/json" },
          });
        } catch (err: any) {
          return new Response(err.message, { status: 400 });
        }
      },
    },
  },
});
