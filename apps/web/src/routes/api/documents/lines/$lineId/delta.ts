import { auth } from "@repo/auth/auth";
import { DocumentService } from "@repo/db/services/document-service";
import { createFileRoute } from "@tanstack/react-router";

import { resolveTenantContext } from "#/lib/resolve-tenant";

export const Route = createFileRoute("/api/documents/lines/$lineId/delta")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session || !session.user) {
          return new Response("Unauthorized", { status: 401 });
        }

        const isSystemAdmin = (session.user as any).isSystemAdmin;
        const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context) {
          return new Response("No active tenant found", { status: 403 });
        }

        let body: { qtyDelta: number };
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid JSON body", { status: 400 });
        }

        if (typeof body.qtyDelta !== "number") {
          return new Response("qtyDelta must be a number", { status: 400 });
        }

        try {
          const svc = new DocumentService();
          const result = await svc.applyDeltaEffect(
            params.lineId,
            body.qtyDelta,
            session.user.id,
            context.tenantId,
          );
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
