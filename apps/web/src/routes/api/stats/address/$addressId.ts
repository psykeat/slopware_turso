import { auth } from "@repo/auth/auth";
import { db, activePersistence, runInTenantScope } from "@repo/db";
import { document as documentTable } from "@repo/db/schema";
import { createFileRoute } from "@tanstack/react-router";
import { sql } from "drizzle-orm";
import { eq, desc } from "drizzle-orm";

import { resolveTenantContext } from "#/lib/resolve-tenant";

export const Route = createFileRoute("/api/stats/address/$addressId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return new Response("Unauthorized", { status: 401 });
        const isSystemAdmin = (session.user as any).isSystemAdmin;
        const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context) return new Response("Forbidden", { status: 403 });
        const { tenantId } = context;
        const { addressId } = params;

        return runInTenantScope(context, async () => {
          let revenueResult: any[];

          if (activePersistence.provider === "turso") {
            revenueResult = await db.execute(
              sql`SELECT
                fp.fiscal_year AS fiscal_year,
                fp.period_no AS period_no,
                SUM(fse.amount_net_delta) AS total_amount_net,
                SUM(fse.amount_net_delta) - COALESCE(SUM(fse.cogs_delta), 0) AS total_profit
              FROM fact_sales_event fse
              JOIN fiscal_period fp
                ON fse.company_id = fp.company_id
                AND fse.booking_period BETWEEN fp.start_date AND fp.end_date
              WHERE fse.customer_id = ${addressId}
              GROUP BY fp.fiscal_year, fp.period_no
              ORDER BY fp.fiscal_year DESC, fp.period_no ASC
              LIMIT 24`,
            );
          } else {
            revenueResult = await db.execute(
              sql`SELECT fiscal_year, period_no, total_amount_net, total_profit FROM mv_sales_period_customer WHERE tenant_id = ${tenantId}::uuid AND customer_id = ${addressId}::uuid ORDER BY fiscal_year DESC, period_no ASC LIMIT 24`,
            );
          }

          const recentDocuments = await db
            .select({
              documentId: documentTable.documentId,
              documentNo: documentTable.documentNo,
              documentDate: documentTable.documentDate,
              documentType: documentTable.documentType,
              status: documentTable.status,
              totalGross: documentTable.totalGross,
              isPaid: documentTable.isPaid,
            })
            .from(documentTable)
            .where(eq(documentTable.customerId, addressId))
            .orderBy(desc(documentTable.documentDate))
            .limit(20);

          return new Response(
            JSON.stringify({
              revenueByPeriod: Array.from(revenueResult),
              recentDocuments,
            }),
            { headers: { "content-type": "application/json" } },
          );
        });
      },
    },
  },
});
