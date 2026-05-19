import { auth } from "@repo/auth/auth";
import { ImportService } from "@repo/db/services/import-service";
import { createFileRoute } from "@tanstack/react-router";

import { resolveTenantContext } from "#/lib/resolve-tenant";

export const Route = createFileRoute("/api/import/batches")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return new Response("Unauthorized", { status: 401 });
        const isSystemAdmin = (session.user as any).isSystemAdmin;
        const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context) return new Response("No active tenant found", { status: 403 });

        try {
          const url = new URL(request.url);
          const profileId = url.searchParams.get("profileId") ?? undefined;
          const status = url.searchParams.get("status") ?? undefined;

          const svc = new ImportService(context.tenantId, session.user.id);
          const batches = await svc.listBatches({ profileId, status });
          return new Response(JSON.stringify(batches), {
            headers: { "content-type": "application/json" },
          });
        } catch (err: any) {
          return new Response(err.message, { status: 400 });
        }
      },
    },
  },
});
