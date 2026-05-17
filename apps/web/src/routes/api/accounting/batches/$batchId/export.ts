import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@repo/auth/auth";
import { resolveTenantContext } from "#/lib/resolve-tenant";
import { AccountingExportService } from "@repo/db/services/accounting-export-service";

const svc = new AccountingExportService();

export const Route = createFileRoute("/api/accounting/batches/$batchId/export")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return new Response("Unauthorized", { status: 401 });
        const isSystemAdmin = (session.user as unknown as { isSystemAdmin: boolean }).isSystemAdmin;
        const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context) return new Response("Forbidden", { status: 403 });

        try {
          await svc.markBatchExported(context.tenantId, params.batchId);
          return Response.json({ success: true });
        } catch (e: unknown) {
          return Response.json({ error: (e as Error).message }, { status: 400 });
        }
      },
    },
  },
});
