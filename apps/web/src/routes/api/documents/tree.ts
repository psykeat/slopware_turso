import { createFileRoute } from "@tanstack/react-router";
import { DocumentService } from "@repo/db/services/document-service";
import { auth } from "@repo/auth/auth";
import { resolveTenantContext } from "#/lib/resolve-tenant";

export const Route = createFileRoute("/api/documents/tree")({
  server: {
    handlers: {
      GET: async ({ request }) => {
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
          const tree = await svc.getDocumentTree(context.tenantId);
          return new Response(JSON.stringify(tree), {
            headers: { "content-type": "application/json" },
          });
        } catch (err: any) {
          return new Response(err.message, { status: 500 });
        }
      },
    },
  },
});
