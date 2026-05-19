import { auth } from "@repo/auth/auth";
import { db } from "@repo/db";
import { createFileRoute } from "@tanstack/react-router";
import { sql } from "drizzle-orm";

import { resolveTenantContext } from "#/lib/resolve-tenant";

export const Route = createFileRoute("/api/stats/articles")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return new Response("Unauthorized", { status: 401 });
        const isSystemAdmin = (session.user as any).isSystemAdmin;
        const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context) return new Response("Forbidden", { status: 403 });
        const { tenantId } = context;

        const [totals] = (await db.execute(
          sql`SELECT
            COUNT(*)                                           AS total,
            COUNT(*) FILTER (WHERE archived_at IS NULL)       AS active_count,
            COUNT(*) FILTER (WHERE archived_at IS NOT NULL)   AS archived_count
          FROM article
          WHERE tenant_id = ${tenantId}::uuid`,
        )) as any[];

        const [lowStock] = (await db.execute(
          sql`SELECT COUNT(DISTINCT article_id) AS cnt
              FROM inventory_balance
              WHERE tenant_id = ${tenantId}::uuid AND on_hand_qty <= 0`,
        )) as any[];

        const [noPrice] = (await db.execute(
          sql`SELECT COUNT(*) AS cnt
              FROM article a
              WHERE a.tenant_id = ${tenantId}::uuid
                AND a.archived_at IS NULL
                AND NOT EXISTS (
                  SELECT 1 FROM price_list_item pli
                  WHERE pli.tenant_id = ${tenantId}::uuid AND pli.article_id = a.article_id
                )`,
        )) as any[];

        const topGroups = await db.execute(
          sql`SELECT ag.name, COUNT(a.article_id) AS cnt
              FROM article a
              JOIN article_group ag ON a.article_group_id = ag.article_group_id
              WHERE a.tenant_id = ${tenantId}::uuid AND a.archived_at IS NULL
              GROUP BY ag.article_group_id, ag.name
              ORDER BY cnt DESC
              LIMIT 5`,
        );

        return new Response(
          JSON.stringify({
            total: Number(totals?.total ?? 0),
            activeCount: Number(totals?.active_count ?? 0),
            archivedCount: Number(totals?.archived_count ?? 0),
            lowStockCount: Number(lowStock?.cnt ?? 0),
            noPriceCount: Number(noPrice?.cnt ?? 0),
            topGroups: Array.from(topGroups).map((r: any) => ({
              name: r.name,
              count: Number(r.cnt),
            })),
          }),
          { headers: { "content-type": "application/json" } },
        );
      },
    },
  },
});
