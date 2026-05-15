import { createFileRoute } from "@tanstack/react-router";
import { db } from "@repo/db";
import { article } from "@repo/db/schema";
import { auth } from "@repo/auth/auth";
import { resolveTenantContext } from "#/lib/resolve-tenant";
import { and, eq, ilike, isNull, or } from "drizzle-orm";

export const Route = createFileRoute("/api/articles/search")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return new Response("Unauthorized", { status: 401 });

        const isSystemAdmin = (session.user as any).isSystemAdmin;
        const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context) return new Response("No active tenant found", { status: 403 });

        const url = new URL(request.url);
        const q = url.searchParams.get("q") ?? "";
        const limit = Math.min(50, Number(url.searchParams.get("limit") ?? "20"));

        const rows = await db
          .select({
            articleId: article.articleId,
            articleNo: article.articleNo,
            name: article.name,
            baseUnit: article.baseUnit,
            taxClassId: article.taxClassId,
          })
          .from(article)
          .where(
            and(
              eq(article.tenantId, context.tenantId),
              eq(article.isActive, true),
              isNull(article.archivedAt),
              q.length > 0
                ? or(ilike(article.articleNo, `%${q}%`), ilike(article.name, `%${q}%`))
                : undefined,
            ),
          )
          .limit(limit);

        return new Response(JSON.stringify(rows), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
