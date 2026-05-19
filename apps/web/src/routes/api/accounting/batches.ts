import { auth } from "@repo/auth/auth";
import { AccountingExportService } from "@repo/db/services/accounting-export-service";
import { createFileRoute } from "@tanstack/react-router";

import { resolveTenantContext } from "#/lib/resolve-tenant";

const svc = new AccountingExportService();

export const Route = createFileRoute("/api/accounting/batches")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return new Response("Unauthorized", { status: 401 });
        const isSystemAdmin = (session.user as unknown as { isSystemAdmin: boolean }).isSystemAdmin;
        const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context) return new Response("Forbidden", { status: 403 });

        const url = new URL(request.url);
        const companyId = url.searchParams.get("companyId") ?? undefined;

        try {
          const batches = await svc.listBatches(context.tenantId, companyId);
          return Response.json(batches);
        } catch (e: unknown) {
          return Response.json({ error: (e as Error).message }, { status: 400 });
        }
      },

      POST: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return new Response("Unauthorized", { status: 401 });
        const isSystemAdmin = (session.user as unknown as { isSystemAdmin: boolean }).isSystemAdmin;
        const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context) return new Response("Forbidden", { status: 403 });

        let body: { companyId?: string; fiscalPeriodId?: string } = {};
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const { companyId, fiscalPeriodId } = body;
        if (!companyId || !fiscalPeriodId) {
          return Response.json(
            { error: "companyId and fiscalPeriodId are required" },
            { status: 400 },
          );
        }

        try {
          const result = await svc.createExportBatch(
            context.tenantId,
            companyId,
            fiscalPeriodId,
            session.user.id,
          );
          return Response.json(result, { status: 201 });
        } catch (e: unknown) {
          return Response.json({ error: (e as Error).message }, { status: 400 });
        }
      },
    },
  },
});
