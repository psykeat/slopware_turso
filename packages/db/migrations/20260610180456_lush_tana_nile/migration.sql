ALTER TABLE "price_list_item" ALTER COLUMN "article_id" DROP NOT NULL;
--> statement-breakpoint
DROP MATERIALIZED VIEW IF EXISTS mv_sales_period_article CASCADE;
--> statement-breakpoint
CREATE MATERIALIZED VIEW mv_sales_period_article AS
SELECT
  fse.tenant_id,
  fse.company_id,
  av.article_id                                                      AS article_id,
  fp.fiscal_year,
  fp.period_no,
  SUM(fse.amount_net_delta)                                          AS total_amount_net,
  SUM(fse.quantity_delta)                                            AS total_qty,
  SUM(fse.amount_net_delta) - COALESCE(SUM(fse.cogs_delta), 0)      AS total_profit
FROM fact_sales_event fse
INNER JOIN article_variant av
  ON fse.variant_id = av.variant_id
JOIN fiscal_period fp
  ON  fse.tenant_id      = fp.tenant_id
  AND fse.company_id     = fp.company_id
  AND fse.booking_period BETWEEN fp.start_date AND fp.end_date
GROUP BY fse.tenant_id, fse.company_id, av.article_id, fp.fiscal_year, fp.period_no;
--> statement-breakpoint
CREATE UNIQUE INDEX idx_mv_sales_period_article_pk
  ON mv_sales_period_article (tenant_id, company_id, article_id, fiscal_year, period_no);