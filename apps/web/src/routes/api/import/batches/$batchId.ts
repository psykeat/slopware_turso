import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@repo/auth/auth";
import { resolveTenantContext } from "#/lib/resolve-tenant";
import { ImportService } from "@repo/db/services/import-service";

export const Route = createFileRoute("/api/import/batches/$batchId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return new Response("Unauthorized", { status: 401 });
        const isSystemAdmin = (session.user as any).isSystemAdmin;
        const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context) return new Response("No active tenant found", { status: 403 });

        try {
          const svc = new ImportService(context.tenantId, session.user.id);
          const result = await svc.getBatch(params.batchId);
          return new Response(JSON.stringify(result), {
            headers: { "content-type": "application/json" },
          });
        } catch (err: any) {
          return new Response(err.message, { status: 404 });
        }
      },
    },
  },
});
