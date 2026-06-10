import { auth } from "@repo/auth/auth";
import { db } from "@repo/db";
import { document as documentTable } from "@repo/db/schema";
import { createFileRoute } from "@tanstack/react-router";
import { sql } from "drizzle-orm";
import { eq, and, count, sum } from "drizzle-orm";

import { resolveTenantContext } from "#/lib/resolve-tenant";

export const Route = createFileRoute("/api/stats/dashboard")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return new Response("Unauthorized", { status: 401 });
        const isSystemAdmin = (session.user as any).isSystemAdmin;
        const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context) return new Response("Forbidden", { status: 403 });
        const { tenantId } = context;

        const currentYear = new Date().getFullYear();

        const revenueResult = await db.execute(
          sql`SELECT COALESCE(SUM(total_amount_net), 0) AS revenue, COALESCE(SUM(total_cogs), 0) AS cogs, COALESCE(SUM(total_profit), 0) AS profit FROM mv_sales_period WHERE tenant_id = ${tenantId}::uuid AND fiscal_year = ${currentYear}`,
        );
        const revenue = revenueResult[0] as any;

        const priorRevenueResult = await db.execute(
          sql`SELECT COALESCE(SUM(total_amount_net), 0) AS revenue FROM mv_sales_period WHERE tenant_id = ${tenantId}::uuid AND fiscal_year = ${currentYear - 1}`,
        );
        const priorRevenue = priorRevenueResult[0] as any;

        const openOrdersResult = await db
          .select({
            cnt: count(),
            total: sum(documentTable.totalGross),
          })
          .from(documentTable)
          .where(
            and(
              eq(documentTable.tenantId, tenantId),
              eq(documentTable.status, "draft"),
              eq(documentTable.documentType, "A"),
            ),
          );

        const inventoryResult = await db.execute(
          sql`SELECT COALESCE(SUM(on_hand_qty * COALESCE(gld_purchase, 0)), 0) AS inventory_value FROM inventory_balance WHERE tenant_id = ${tenantId}::uuid AND inventory_item_id IS NOT NULL`,
        );
        const inventoryRow = inventoryResult[0] as any;

        const draftResult = await db
          .select({ cnt: count() })
          .from(documentTable)
          .where(and(eq(documentTable.tenantId, tenantId), eq(documentTable.status, "draft")));

        return new Response(
          JSON.stringify({
            revenue: {
              current: Number(revenue?.revenue ?? 0),
              prior: Number(priorRevenue?.revenue ?? 0),
            },
            profit: { current: Number(revenue?.profit ?? 0) },
            cogs: { current: Number(revenue?.cogs ?? 0) },
            openOrders: {
              count: Number(openOrdersResult[0]?.cnt ?? 0),
              value: Number(openOrdersResult[0]?.total ?? 0),
            },
            inventoryValue: Number(inventoryRow?.inventory_value ?? 0),
            draftCount: Number(draftResult[0]?.cnt ?? 0),
          }),
          { headers: { "content-type": "application/json" } },
        );
      },
    },
  },
});
