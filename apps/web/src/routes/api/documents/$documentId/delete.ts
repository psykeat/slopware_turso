import { createFileRoute } from "@tanstack/react-router";
import { DocumentService } from "@repo/db/services/document-service";
import { auth } from "@repo/auth/auth";
import { resolveTenantContext } from "#/lib/resolve-tenant";

export const Route = createFileRoute("/api/documents/$documentId/delete")({
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

        try {
          const svc = new DocumentService();
          const result = await svc.deleteDocument(
            params.documentId,
            context.tenantId,
          );
          if (result.notAllowed) {
            return new Response(JSON.stringify({ error: "Deletion not allowed for this document type" }), {
              status: 403,
              headers: { "content-type": "application/json" },
            });
          }
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
