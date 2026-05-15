-- Materialized views for statistics (Phase 3)

-- mv_sales_period: Umsatz/Rohertrag per tenant/company/fiscal_period
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_sales_period AS
SELECT
  fse.tenant_id,
  fse.company_id,
  fse.fiscal_period_id,
  fp.fiscal_year,
  fp.period_no,
  SUM(fse.amount_net_delta) AS total_amount_net,
  SUM(fse.cogs_delta) AS total_cogs,
  SUM(fse.amount_net_delta) - COALESCE(SUM(fse.cogs_delta), 0) AS total_profit,
  SUM(ABS(fse.quantity_delta)) AS total_qty,
  COUNT(DISTINCT fse.source_document_id) AS document_count
FROM fact_sales_event fse
LEFT JOIN fiscal_period fp ON fse.fiscal_period_id = fp.fiscal_period_id
WHERE fse.event_type = 'sale'
GROUP BY fse.tenant_id, fse.company_id, fse.fiscal_period_id, fp.fiscal_year, fp.period_no;

CREATE UNIQUE INDEX IF NOT EXISTS uidx_mv_sales_period
  ON mv_sales_period (tenant_id, company_id, fiscal_period_id)
  WHERE fiscal_period_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mv_sales_period_tenant
  ON mv_sales_period (tenant_id, company_id, fiscal_year);

-- mv_sales_period_customer
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_sales_period_customer AS
SELECT
  fse.tenant_id,
  fse.company_id,
  fse.fiscal_period_id,
  fp.fiscal_year,
  fp.period_no,
  fse.customer_id,
  SUM(fse.amount_net_delta) AS total_amount_net,
  SUM(fse.cogs_delta) AS total_cogs,
  SUM(fse.amount_net_delta) - COALESCE(SUM(fse.cogs_delta), 0) AS total_profit,
  COUNT(DISTINCT fse.source_document_id) AS document_count
FROM fact_sales_event fse
LEFT JOIN fiscal_period fp ON fse.fiscal_period_id = fp.fiscal_period_id
WHERE fse.event_type = 'sale' AND fse.customer_id IS NOT NULL
GROUP BY fse.tenant_id, fse.company_id, fse.fiscal_period_id, fp.fiscal_year, fp.period_no, fse.customer_id;

CREATE UNIQUE INDEX IF NOT EXISTS uidx_mv_sales_period_customer
  ON mv_sales_period_customer (tenant_id, company_id, fiscal_period_id, customer_id)
  WHERE fiscal_period_id IS NOT NULL AND customer_id IS NOT NULL;

-- mv_sales_period_article
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_sales_period_article AS
SELECT
  fse.tenant_id,
  fse.company_id,
  fse.fiscal_period_id,
  fp.fiscal_year,
  fp.period_no,
  fse.article_id,
  SUM(fse.amount_net_delta) AS total_amount_net,
  SUM(fse.cogs_delta) AS total_cogs,
  SUM(ABS(fse.quantity_delta)) AS total_qty,
  COUNT(DISTINCT fse.source_document_id) AS document_count
FROM fact_sales_event fse
LEFT JOIN fiscal_period fp ON fse.fiscal_period_id = fp.fiscal_period_id
WHERE fse.event_type = 'sale' AND fse.article_id IS NOT NULL
GROUP BY fse.tenant_id, fse.company_id, fse.fiscal_period_id, fp.fiscal_year, fp.period_no, fse.article_id;

CREATE UNIQUE INDEX IF NOT EXISTS uidx_mv_sales_period_article
  ON mv_sales_period_article (tenant_id, company_id, fiscal_period_id, article_id)
  WHERE fiscal_period_id IS NOT NULL AND article_id IS NOT NULL;

-- mv_purchase_period
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_purchase_period AS
SELECT
  fpe.tenant_id,
  fpe.company_id,
  fpe.fiscal_period_id,
  fp.fiscal_year,
  fp.period_no,
  SUM(fpe.amount_net_delta) AS total_amount_net,
  SUM(fpe.quantity_delta) AS total_qty,
  COUNT(DISTINCT fpe.source_document_id) AS document_count
FROM fact_purchase_event fpe
LEFT JOIN fiscal_period fp ON fpe.fiscal_period_id = fp.fiscal_period_id
GROUP BY fpe.tenant_id, fpe.company_id, fpe.fiscal_period_id, fp.fiscal_year, fp.period_no;

CREATE UNIQUE INDEX IF NOT EXISTS uidx_mv_purchase_period
  ON mv_purchase_period (tenant_id, company_id, fiscal_period_id)
  WHERE fiscal_period_id IS NOT NULL;

-- mv_purchase_period_supplier
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_purchase_period_supplier AS
SELECT
  fpe.tenant_id,
  fpe.company_id,
  fpe.fiscal_period_id,
  fp.fiscal_year,
  fp.period_no,
  fpe.supplier_id,
  SUM(fpe.amount_net_delta) AS total_amount_net,
  SUM(fpe.quantity_delta) AS total_qty,
  COUNT(DISTINCT fpe.source_document_id) AS document_count
FROM fact_purchase_event fpe
LEFT JOIN fiscal_period fp ON fpe.fiscal_period_id = fp.fiscal_period_id
WHERE fpe.supplier_id IS NOT NULL
GROUP BY fpe.tenant_id, fpe.company_id, fpe.fiscal_period_id, fp.fiscal_year, fp.period_no, fpe.supplier_id;

CREATE UNIQUE INDEX IF NOT EXISTS uidx_mv_purchase_period_supplier
  ON mv_purchase_period_supplier (tenant_id, company_id, fiscal_period_id, supplier_id)
  WHERE fiscal_period_id IS NOT NULL AND supplier_id IS NOT NULL;

-- mv_purchase_period_article
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_purchase_period_article AS
SELECT
  fpe.tenant_id,
  fpe.company_id,
  fpe.fiscal_period_id,
  fp.fiscal_year,
  fp.period_no,
  fpe.article_id,
  SUM(fpe.amount_net_delta) AS total_amount_net,
  SUM(fpe.quantity_delta) AS total_qty,
  COUNT(DISTINCT fpe.source_document_id) AS document_count
FROM fact_purchase_event fpe
LEFT JOIN fiscal_period fp ON fpe.fiscal_period_id = fp.fiscal_period_id
WHERE fpe.article_id IS NOT NULL
GROUP BY fpe.tenant_id, fpe.company_id, fpe.fiscal_period_id, fp.fiscal_year, fp.period_no, fpe.article_id;

CREATE UNIQUE INDEX IF NOT EXISTS uidx_mv_purchase_period_article
  ON mv_purchase_period_article (tenant_id, company_id, fiscal_period_id, article_id)
  WHERE fiscal_period_id IS NOT NULL AND article_id IS NOT NULL;

-- Performance indexes on document table
CREATE INDEX IF NOT EXISTS idx_document_status_tenant ON document (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_document_paid ON document (tenant_id, customer_id, is_paid);
