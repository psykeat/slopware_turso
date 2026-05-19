import { auth } from "@repo/auth/auth";
import { ImportService } from "@repo/db/services/import-service";
import { createFileRoute } from "@tanstack/react-router";

import { resolveTenantContext } from "#/lib/resolve-tenant";

export const Route = createFileRoute("/api/import/batches/$batchId/approve")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return new Response("Unauthorized", { status: 401 });
        const isSystemAdmin = (session.user as any).isSystemAdmin;
        const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context) return new Response("No active tenant found", { status: 403 });

        try {
          const svc = new ImportService(context.tenantId, session.user.id);
          await svc.approveBatch(params.batchId);
          return new Response(JSON.stringify({ ok: true }), {
            headers: { "content-type": "application/json" },
          });
        } catch (err: any) {
          const status = err.message?.includes("cannot be approved") ? 400 : 404;
          return new Response(err.message, { status });
        }
      },
    },
  },
});
