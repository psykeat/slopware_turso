import { auth } from "@repo/auth/auth";
import { DocumentService } from "@repo/db/services/document-service";
import { createFileRoute } from "@tanstack/react-router";

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
          const companyId = new URL(request.url).searchParams.get("companyId") ?? undefined;
          const tree = await svc.getDocumentTree(context.tenantId, companyId);
          console.log(
            "[Tree API] tenantId:",
            context.tenantId,
            "sections:",
            tree.length,
            JSON.stringify(tree),
          );
          return new Response(JSON.stringify(tree), {
            headers: { "content-type": "application/json" },
          });
        } catch (err: any) {
          console.error("[Tree API] error:", err);
          return new Response(err.message, { status: 500 });
        }
      },
    },
  },
});
