import { auth } from "@repo/auth/auth";
import { archiveArticleVariants } from "@repo/db/services/article-variant-generator";
import { createFileRoute } from "@tanstack/react-router";

import { resolveTenantContext } from "#/lib/resolve-tenant";

export const Route = createFileRoute("/api/articles/$articleId/archive-variants")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) {
          return new Response("Unauthorized", { status: 401 });
        }

        const isSystemAdmin = (session.user as Record<string, unknown>).isSystemAdmin;
        const context = await resolveTenantContext(
          request,
          session.user.id,
          Boolean(isSystemAdmin),
        );
        if (!context) {
          return new Response("No active tenant found", { status: 403 });
        }

        try {
          const body = await request.json().catch(() => ({}));
          const variantIds: string[] | undefined = Array.isArray(body?.variantIds)
            ? body.variantIds
            : undefined;

          const result = await archiveArticleVariants(
            context.tenantId,
            params.articleId,
            variantIds,
          );
          return new Response(JSON.stringify(result), {
            headers: { "content-type": "application/json" },
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          return new Response(message, { status: 400 });
        }
      },
    },
  },
});
