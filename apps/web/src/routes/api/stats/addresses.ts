import { auth } from "@repo/auth/auth";
import { db } from "@repo/db";
import { createFileRoute } from "@tanstack/react-router";
import { sql } from "drizzle-orm";

import { resolveTenantContext } from "#/lib/resolve-tenant";

export const Route = createFileRoute("/api/stats/addresses")({
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
            COUNT(*)                                                      AS total,
            COUNT(*) FILTER (WHERE is_customer = true)                    AS customer_count,
            COUNT(*) FILTER (WHERE is_supplier = true)                    AS supplier_count,
            COUNT(*) FILTER (WHERE archived_at IS NULL)                   AS active_count,
            COUNT(*) FILTER (WHERE is_customer = true AND vat_id IS NULL) AS missing_vat,
            COUNT(*) FILTER (WHERE is_customer = true AND payment_term_id IS NULL) AS missing_payment_term
          FROM address
          WHERE tenant_id = ${tenantId}::uuid AND archived_at IS NULL`,
        )) as any[];

        const topCountries = await db.execute(
          sql`SELECT country_code, COUNT(*) AS cnt
              FROM address
              WHERE tenant_id = ${tenantId}::uuid AND archived_at IS NULL
              GROUP BY country_code
              ORDER BY cnt DESC
              LIMIT 5`,
        );

        return new Response(
          JSON.stringify({
            total: Number(totals?.total ?? 0),
            customerCount: Number(totals?.customer_count ?? 0),
            supplierCount: Number(totals?.supplier_count ?? 0),
            activeCount: Number(totals?.active_count ?? 0),
            missingVat: Number(totals?.missing_vat ?? 0),
            missingPaymentTerm: Number(totals?.missing_payment_term ?? 0),
            topCountries: Array.from(topCountries).map((r: any) => ({
              countryCode: r.country_code,
              count: Number(r.cnt),
            })),
          }),
          { headers: { "content-type": "application/json" } },
        );
      },
    },
  },
});
