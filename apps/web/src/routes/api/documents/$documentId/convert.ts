import { createFileRoute } from "@tanstack/react-router";
import { DocumentService } from "@repo/db/services/document-service";
import { auth } from "@repo/auth/auth";
import { resolveTenantContext } from "#/lib/resolve-tenant";

export const Route = createFileRoute("/api/documents/$documentId/convert")({
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

        let targetGroupId: string | undefined;
        try {
          const body = await request.json();
          targetGroupId = body?.targetGroupId;
        } catch {
          // no body or invalid JSON — that's fine
        }

        try {
          const svc = new DocumentService();

          if (targetGroupId) {
            const result = await svc.convertDocument(
              params.documentId,
              session.user.id,
              context.tenantId,
              targetGroupId,
            );
            return new Response(JSON.stringify(result), {
              headers: { "content-type": "application/json" },
            });
          }

          const candidates = await svc.getConversionCandidates(
            params.documentId,
            context.tenantId,
          );

          return new Response(
            JSON.stringify({ candidates }),
            { headers: { "content-type": "application/json" } },
          );
        } catch (err: any) {
          return new Response(err.message, { status: 400 });
        }
      },
    },
  },
});
