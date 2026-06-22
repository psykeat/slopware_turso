import { auth } from "@repo/auth/auth";
import { db, activePersistence, runInTenantScope } from "@repo/db";
import { document as documentTable } from "@repo/db/schema";
import { createFileRoute } from "@tanstack/react-router";
import { sql } from "drizzle-orm";
import { count, sum, eq, and } from "drizzle-orm";

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

        return runInTenantScope(context, async () => {
          let revenueResult: any[];
          let priorRevenueResult: any[];
          let inventoryResult: any[];

          if (activePersistence.provider === "turso") {
            revenueResult = await db.execute(
              sql`SELECT
                COALESCE(SUM(fse.amount_net_delta), 0) AS revenue,
                COALESCE(SUM(fse.cogs_delta), 0) AS cogs,
                COALESCE(SUM(fse.amount_net_delta) - COALESCE(SUM(fse.cogs_delta), 0), 0) AS profit
              FROM fact_sales_event fse
              JOIN fiscal_period fp
                ON fse.company_id = fp.company_id
                AND fse.booking_period BETWEEN fp.start_date AND fp.end_date
              WHERE fp.fiscal_year = ${currentYear}`,
            );

            priorRevenueResult = await db.execute(
              sql`SELECT
                COALESCE(SUM(fse.amount_net_delta), 0) AS revenue
              FROM fact_sales_event fse
              JOIN fiscal_period fp
                ON fse.company_id = fp.company_id
                AND fse.booking_period BETWEEN fp.start_date AND fp.end_date
              WHERE fp.fiscal_year = ${currentYear - 1}`,
            );

            inventoryResult = await db.execute(
              sql`SELECT COALESCE(SUM(on_hand_qty * COALESCE(gld_purchase, 0)), 0) AS inventory_value FROM inventory_balance WHERE inventory_item_id IS NOT NULL`,
            );
          } else {
            revenueResult = await db.execute(
              sql`SELECT COALESCE(SUM(total_amount_net), 0) AS revenue, COALESCE(SUM(total_cogs), 0) AS cogs, COALESCE(SUM(total_profit), 0) AS profit FROM mv_sales_period WHERE tenant_id = ${tenantId}::uuid AND fiscal_year = ${currentYear}`,
            );

            priorRevenueResult = await db.execute(
              sql`SELECT COALESCE(SUM(total_amount_net), 0) AS revenue FROM mv_sales_period WHERE tenant_id = ${tenantId}::uuid AND fiscal_year = ${currentYear - 1}`,
            );

            inventoryResult = await db.execute(
              sql`SELECT COALESCE(SUM(on_hand_qty * COALESCE(gld_purchase, 0)), 0) AS inventory_value FROM inventory_balance WHERE tenant_id = ${tenantId}::uuid AND inventory_item_id IS NOT NULL`,
            );
          }

          const revenue = revenueResult[0] as any;
          const priorRevenue = priorRevenueResult[0] as any;
          const inventoryRow = inventoryResult[0] as any;

          const openOrdersResult = await db
            .select({
              cnt: count(),
              total: sum(documentTable.totalGross),
            })
            .from(documentTable)
            .where(and(eq(documentTable.status, "draft"), eq(documentTable.documentType, "A")));

          const draftResult = await db
            .select({ cnt: count() })
            .from(documentTable)
            .where(eq(documentTable.status, "draft"));

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
        });
      },
    },
  },
});
