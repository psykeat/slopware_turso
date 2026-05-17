import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@repo/auth/auth";
import { resolveTenantContext } from "#/lib/resolve-tenant";
import { ImportService } from "@repo/db/services/import-service";

export const Route = createFileRoute("/api/import/profiles/$profileId/activate")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return new Response("Unauthorized", { status: 401 });
        const isSystemAdmin = (session.user as any).isSystemAdmin;
        const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context) return new Response("No active tenant found", { status: 403 });

        try {
          const body = (await request.json()) as { connectorId: string };
          if (!body.connectorId) {
            return new Response("connectorId is required", { status: 400 });
          }

          const svc = new ImportService(context.tenantId, session.user.id);
          const result = await svc.activateMapping(body.connectorId, params.profileId);
          return new Response(JSON.stringify(result), {
            headers: { "content-type": "application/json" },
          });
        } catch (err: any) {
          return new Response(err.message, { status: 400 });
        }
      },
    },
  },
});
