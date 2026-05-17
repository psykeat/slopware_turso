DROP MATERIALIZED VIEW IF EXISTS mv_sales_period_customer CASCADE;
--> statement-breakpoint
DROP MATERIALIZED VIEW IF EXISTS mv_sales_period_article CASCADE;
--> statement-breakpoint
DROP MATERIALIZED VIEW IF EXISTS mv_sales_period CASCADE;
--> statement-breakpoint
CREATE MATERIALIZED VIEW mv_sales_period AS
SELECT
  fse.tenant_id,
  fse.company_id,
  fp.fiscal_year,
  fp.period_no,
  SUM(fse.amount_net_delta)                                      AS total_amount_net,
  COALESCE(SUM(fse.cogs_delta), 0)                               AS total_cogs,
  SUM(fse.amount_net_delta) - COALESCE(SUM(fse.cogs_delta), 0)  AS total_profit,
  COUNT(DISTINCT fse.source_document_id)                         AS doc_count
FROM fact_sales_event fse
JOIN fiscal_period fp
  ON  fse.tenant_id      = fp.tenant_id
  AND fse.company_id     = fp.company_id
  AND fse.booking_period BETWEEN fp.start_date AND fp.end_date
GROUP BY fse.tenant_id, fse.company_id, fp.fiscal_year, fp.period_no;
--> statement-breakpoint
CREATE UNIQUE INDEX idx_mv_sales_period_pk
  ON mv_sales_period (tenant_id, company_id, fiscal_year, period_no);
--> statement-breakpoint
CREATE MATERIALIZED VIEW mv_sales_period_customer AS
SELECT
  fse.tenant_id,
  fse.company_id,
  fse.customer_id,
  fp.fiscal_year,
  fp.period_no,
  SUM(fse.amount_net_delta)                                      AS total_amount_net,
  COALESCE(SUM(fse.cogs_delta), 0)                               AS total_cogs,
  SUM(fse.amount_net_delta) - COALESCE(SUM(fse.cogs_delta), 0)  AS total_profit
FROM fact_sales_event fse
JOIN fiscal_period fp
  ON  fse.tenant_id      = fp.tenant_id
  AND fse.company_id     = fp.company_id
  AND fse.booking_period BETWEEN fp.start_date AND fp.end_date
WHERE fse.customer_id IS NOT NULL
GROUP BY fse.tenant_id, fse.company_id, fse.customer_id, fp.fiscal_year, fp.period_no;
--> statement-breakpoint
CREATE UNIQUE INDEX idx_mv_sales_period_customer_pk
  ON mv_sales_period_customer (tenant_id, company_id, customer_id, fiscal_year, period_no);
--> statement-breakpoint
CREATE MATERIALIZED VIEW mv_sales_period_article AS
SELECT
  fse.tenant_id,
  fse.company_id,
  fse.article_id,
  fp.fiscal_year,
  fp.period_no,
  SUM(fse.amount_net_delta)                                      AS total_amount_net,
  SUM(fse.quantity_delta)                                        AS total_qty,
  SUM(fse.amount_net_delta) - COALESCE(SUM(fse.cogs_delta), 0)  AS total_profit
FROM fact_sales_event fse
JOIN fiscal_period fp
  ON  fse.tenant_id      = fp.tenant_id
  AND fse.company_id     = fp.company_id
  AND fse.booking_period BETWEEN fp.start_date AND fp.end_date
WHERE fse.article_id IS NOT NULL
GROUP BY fse.tenant_id, fse.company_id, fse.article_id, fp.fiscal_year, fp.period_no;
--> statement-breakpoint
CREATE UNIQUE INDEX idx_mv_sales_period_article_pk
  ON mv_sales_period_article (tenant_id, company_id, article_id, fiscal_year, period_no);
