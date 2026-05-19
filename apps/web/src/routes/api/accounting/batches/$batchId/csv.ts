import { auth } from "@repo/auth/auth";
import { AccountingExportService } from "@repo/db/services/accounting-export-service";
import { createFileRoute } from "@tanstack/react-router";

import { resolveTenantContext } from "#/lib/resolve-tenant";

const svc = new AccountingExportService();

export const Route = createFileRoute("/api/accounting/batches/$batchId/csv")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return new Response("Unauthorized", { status: 401 });
        const isSystemAdmin = (session.user as unknown as { isSystemAdmin: boolean }).isSystemAdmin;
        const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context) return new Response("Forbidden", { status: 403 });

        try {
          const csv = await svc.generateCsv(context.tenantId, params.batchId);
          return new Response(csv, {
            headers: {
              "Content-Type": "text/csv; charset=utf-8",
              "Content-Disposition": `attachment; filename="accounting-export-${params.batchId}.csv"`,
            },
          });
        } catch (e: unknown) {
          return Response.json({ error: (e as Error).message }, { status: 404 });
        }
      },
    },
  },
});
