import { auth } from "@repo/auth/auth";
import { db, activePersistence, runInTenantScope } from "@repo/db";
import { createFileRoute } from "@tanstack/react-router";
import { sql } from "drizzle-orm";

import { resolveTenantContext } from "#/lib/resolve-tenant";

export const Route = createFileRoute("/api/stats/article/$articleId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return new Response("Unauthorized", { status: 401 });
        const isSystemAdmin = (session.user as any).isSystemAdmin;
        const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context) return new Response("Forbidden", { status: 403 });
        const { tenantId } = context;
        const { articleId } = params;

        return runInTenantScope(context, async () => {
          let revenueResult: any[];
          let stockLedgerResult: any[];

          if (activePersistence.provider === "turso") {
            revenueResult = await db.execute(
              sql`SELECT
                fp.fiscal_year AS fiscal_year,
                fp.period_no AS period_no,
                SUM(fse.amount_net_delta) AS total_amount_net,
                SUM(fse.quantity_delta) AS total_qty
              FROM fact_sales_event fse
              INNER JOIN article_variant av ON fse.variant_id = av.variant_id
              JOIN fiscal_period fp
                ON fse.company_id = fp.company_id
                AND fse.booking_period BETWEEN fp.start_date AND fp.end_date
              WHERE av.article_id = ${articleId}
              GROUP BY fp.fiscal_year, fp.period_no
              ORDER BY fp.fiscal_year DESC, fp.period_no ASC
              LIMIT 24`,
            );

            stockLedgerResult = await db.execute(
              sql`
                SELECT *
                FROM (
                  SELECT
                    im.inventory_movement_id,
                    im.movement_type,
                    im.qty_delta,
                    im.movement_date,
                    im.created_at,
                    im.warehouse_id,
                    im.reference_text,
                    d.document_no,
                    w.name AS warehouse_name,
                    v.sku AS variant_sku,
                    v.variant_id,
                    SUM(COALESCE(im.qty_delta, 0)) OVER (
                      PARTITION BY im.variant_id, im.warehouse_id
                      ORDER BY im.created_at, im.inventory_movement_id
                      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
                    ) AS running_balance
                  FROM inventory_movement im
                  LEFT JOIN article_variant v ON im.variant_id = v.variant_id
                  LEFT JOIN document d ON im.source_document_id = d.document_id
                  LEFT JOIN warehouse w ON im.warehouse_id = w.warehouse_id
                  WHERE v.article_id = ${articleId}
                ) ledger
                ORDER BY ledger.created_at DESC, ledger.inventory_movement_id DESC
                LIMIT 50
              `,
            );
          } else {
            revenueResult = await db.execute(
              sql`SELECT fiscal_year, period_no, total_amount_net, total_qty FROM mv_sales_period_article WHERE tenant_id = ${tenantId}::uuid AND article_id = ${articleId}::uuid ORDER BY fiscal_year DESC, period_no ASC LIMIT 24`,
            );

            stockLedgerResult = await db.execute(
              sql`
                SELECT *
                FROM (
                  SELECT
                    im.inventory_movement_id,
                    im.movement_type,
                    im.qty_delta,
                    im.movement_date,
                    im.created_at,
                    im.warehouse_id,
                    im.reference_text,
                    d.document_no,
                    w.name AS warehouse_name,
                    v.sku AS variant_sku,
                    v.variant_id,
                    SUM(COALESCE(im.qty_delta, 0)) OVER (
                      PARTITION BY im.variant_id, im.warehouse_id
                      ORDER BY im.created_at, im.inventory_movement_id
                      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
                    ) AS running_balance
                  FROM inventory_movement im
                  LEFT JOIN article_variant v ON im.variant_id = v.variant_id
                  LEFT JOIN document d ON im.source_document_id = d.document_id
                  LEFT JOIN warehouse w ON im.warehouse_id = w.warehouse_id
                  WHERE im.tenant_id = ${tenantId}::uuid
                    AND v.article_id = ${articleId}::uuid
                ) ledger
                ORDER BY ledger.created_at DESC, ledger.inventory_movement_id DESC
                LIMIT 50
              `,
            );
          }

          return new Response(
            JSON.stringify({
              revenueByPeriod: Array.from(revenueResult),
              stockLedger: Array.from(stockLedgerResult),
            }),
            { headers: { "content-type": "application/json" } },
          );
        });
      },
    },
  },
});
