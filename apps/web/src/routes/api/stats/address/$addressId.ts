import { auth } from "@repo/auth/auth";
import { db } from "@repo/db";
import { document as documentTable } from "@repo/db/schema";
import { createFileRoute } from "@tanstack/react-router";
import { sql } from "drizzle-orm";
import { eq, and, desc } from "drizzle-orm";

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

        const revenueResult = await db.execute(
          sql`SELECT fiscal_year, period_no, total_amount_net, total_profit FROM mv_sales_period_customer WHERE tenant_id = ${tenantId}::uuid AND customer_id = ${addressId}::uuid ORDER BY fiscal_year DESC, period_no ASC LIMIT 24`,
        );

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
          .where(and(eq(documentTable.tenantId, tenantId), eq(documentTable.customerId, addressId)))
          .orderBy(desc(documentTable.documentDate))
          .limit(20);

        return new Response(
          JSON.stringify({
            revenueByPeriod: Array.from(revenueResult),
            recentDocuments,
          }),
          { headers: { "content-type": "application/json" } },
        );
      },
    },
  },
});
