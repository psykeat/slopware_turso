# PRD: Statistics Module (Statistikmodul)

## Problem Statement

The ERP platform currently shows mocked/hardcoded KPIs on the dashboard. There is no fiscal year period tracking, no AVCO (Gewichteter Durchschnittspreis / GLD) inventory valuation, no purchase statistics infrastructure, and no module-level statistics for addresses, articles, or article groups. Users cannot compare revenue and profit across periods or fiscal years, and module detail views (address, article, article group) show no analytics. The `dashboard:kpi` workspace view hardcodes 6 KPIs and 3 insights — none are data-driven.

## Proposed Solution

Build a layered statistics module with five distinct layers:

1. **Schema layer** — new tables (`fiscal_period`, `fact_purchase_event`), extensions to `fact_sales_event` and `document`, AVCO already accommodated via existing `inventory_balance.gld_purchase / gld_cost` columns
2. **Command layer** — extend `postDocument()` to write AVCO on vendor invoice posting and COGS snapshots on sales invoice posting
3. **Aggregation layer** — 8 PostgreSQL Materialized Views with `CONCURRENT REFRESH` via pg_cron (every 5 min) + `pg_notify` after each posting
4. **Query layer** — server functions for dashboard KPIs, address module stats, article module stats, article group module stats, live order statistics
5. **UI layer** — real KPI dashboard, period comparison view, Lagerstandsjournal (stock ledger), stats panels embedded in address/article/article-group detail views

Architecture follows CQRS: `postDocument()` writes lean to fact tables, reads scale independently via MVs.

## User Stories

1. As a user, I see real revenue and profit figures on the dashboard for the current fiscal year, with a delta vs. the prior year.
2. As a user, I can compare Umsatz and Rohertrag per period (month) across two fiscal years side by side.
3. As a user, I see the top 5 article groups by revenue on the dashboard.
4. As a user, opening an address detail panel shows its total Umsatz/Ertrag per period, open items (Offene Posten) with due dates, all document lines (Bewegungstabelle, filterable by document type), and all documents (Belegtabelle, filterable by type).
5. As a user, opening an article detail panel shows its Umsatz/Ertrag per period, purchase quantities per period, the Lagerstandsjournal (all stock movements with running balance), and all document lines/documents.
6. As a user, opening an article group shows aggregate Umsatz/Ertrag per period, purchase quantities, and all linked document lines/documents.
7. As a user, I can view the Lagerstandsjournal for any article: a formatted ledger of all inventory movements showing incoming/outgoing quantities, current reservation and purchase order quantities, and a traceable running balance.
8. As an admin, I can close a fiscal period to prevent retroactive postings.

## Non-Goals

- **GL/journal posting** — `account_determination_rule` and `journal_entry` exist in schema but are not used yet; this remains a separate feature
- **Payment tracking** — bank reconciliation, partial payments, and payment allocation are out of scope; only `is_paid + paid_at + paid_amount` flags on `document`
- **Historical order volume** — order statistics are real-time only (open order count/value); period-over-period order trend tracking is a future feature
- **Non-monthly periods** — fiscal periods are always 12 calendar months; 4-4-5 or 13-period structures are not supported
- **AVCO cost correction** — if a vendor invoice changes AVCO after a sales invoice was already posted, `cogs_delta` is not retroactively corrected; future upgrade
- **Production order statistics** — production inputs/outputs are out of scope for this module

## Implementation Decisions

| Decision                          | Choice                                                             | Rationale                                                                                                                |
| --------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Ertrag calculation                | AVCO (GLD)                                                         | Most accurate for trading companies; `gld_purchase` / `gld_cost` columns already exist on `inventory_balance`            |
| AVCO update trigger               | Vendor invoice posting (`r`)                                       | Simpler GR posting; AVCO locked when financial obligation confirmed                                                      |
| COGS in fact_sales_event          | Snapshot at posting time                                           | `gld_purchase × qty` written as `cogs_delta` on `R`/`G` posting; AVCO at that moment is sufficient for trading WWS       |
| Aggregation strategy              | Materialized Views (CQRS)                                          | Lean writes, independent read scaling; CONCURRENTLY refresh avoids query blocks                                          |
| MV refresh trigger                | pg_cron every 5 min + pg_notify                                    | Prevents per-posting refresh overhead under concurrent load                                                              |
| Fiscal period                     | Dedicated `fiscal_period` table                                    | Enables `is_closed` flag, clean MV joins, future period configuration                                                    |
| Purchase facts                    | Separate `fact_purchase_event` table                               | Different shape from sales (supplier_id vs customer_id, AVCO history columns); avoids mixing concerns                    |
| Open items                        | `is_paid + paid_at + paid_amount` on `document`                    | Sufficient for OP display and due-date calculation; full payment allocation deferred                                     |
| Order statistics                  | Live queries against `document`                                    | Real-time open order count/value; historical trend deferred                                                              |
| Lagerstandsjournal                | Hybrid by tracking mode                                            | Non-tracked: 1 row per `document_line`; serial-tracked: 1 row per serial number; batch: 1 row per line with batch column |
| Auftrags/Bestellmengen in journal | Current `inventory_balance.reserved_qty` / `expected_purchase_qty` | Historical reservation states not reconstructable; current state is the practical user need                              |

## Module Map

### 1. `packages/db` — Schema Migrations

**New tables:**

- `fiscal_period` — period definitions per company/fiscal year
- `fact_purchase_event` — purchase fact events (vendor invoices/credits)

**Extended tables:**

- `fact_sales_event` — add `cogs_delta numeric`, `fiscal_period_id uuid`
- `document` — add `is_paid boolean`, `paid_at timestamptz`, `paid_amount numeric`

**New raw SQL migration — Materialized Views:**
8 MVs defined via `sql` tagged template (Drizzle raw migration):

- `mv_sales_period`
- `mv_sales_period_customer`
- `mv_sales_period_article`
- `mv_sales_period_article_group`
- `mv_sales_period_address_category`
- `mv_purchase_period`
- `mv_purchase_period_supplier`
- `mv_purchase_period_article`

**New indexes:**

- `document(tenant_id, document_type_id, status)` — for live order queries
- `document(tenant_id, customer_id, status)` — for address OP queries
- All MVs get `UNIQUE INDEX` on their grouping key for `CONCURRENTLY` refresh

### 2. `packages/domain` — Posting Command Extensions

**`posting-command.ts`** gets three new write paths:

- **AVCO write** (for `r` / vendor invoice): Query current `inventory_balance.on_hand_qty` + `gld_purchase`, compute new weighted average, update `gld_purchase` and `gld_cost`
- **COGS snapshot** (for `R` / sales invoice): Read `inventory_balance.gld_purchase` per article, write `cogs_delta = gld_purchase × |quantity_delta|` into `fact_sales_event`
- **Purchase event write** (for `r`, `g`): Insert into `fact_purchase_event`
- **`pg_notify`**: After each successful commit, emit `pg_notify('stats_refresh', tenant_id::text)` for near-real-time MV scheduling

**New helper:** `resolveFiscalPeriodId(sql, tenantId, companyId, date): Promise<string>` — looks up `fiscal_period` by date range; triggers lazy period generation if none found

### 3. `packages/domain` — Fiscal Period Generator

**`fiscal-period-generator.ts`** (new):

- `generateFiscalPeriods(sql, companyId, tenantId, fiscalYear)` — creates 12 `fiscal_period` rows from `company.fiscal_year_start_month`
- Called at company creation and lazily when `resolveFiscalPeriodId` finds no match

### 4. `apps/web/src/server` — Server Functions

**`$getDashboardKpis()`** (new):

- Queries `mv_sales_period` for current + prior fiscal year → Umsatz, Rohertrag, YoY delta
- Queries `mv_purchase_period` → Lieferantenumsatz
- Live queries `document` → open orders count/value, open invoices count/value
- Live query `inventory_balance × gld_purchase` → total inventory value
- Queries `mv_sales_period_article_group` → top 5 article groups

**`$getAddressStats(addressId)`** (extend existing `getCustomerStats`):

- `mv_sales_period_customer` → Umsatz/Ertrag per period
- Live query `document` filtered by `customer_id` + `is_paid = false` → Offene Posten with due dates
- Live query `document_line` JOIN `document` filtered by `customer_id` → Bewegungstabelle
- Live query `document` filtered by `customer_id` → Belegtabelle

**`$getArticleStats(articleId)`** (extend existing stats):

- `mv_sales_period_article` → Umsatz/Ertrag per period
- `mv_purchase_period_article` → Einkaufsmengen per period
- Live query `inventory_movement` + `document_line` hybrid → Lagerstandsjournal rows
- Live query `document_line` → Bewegungstabelle
- Live query `document` → Belegtabelle

**`$getArticleGroupStats(articleGroupId)`** (new):

- `mv_sales_period_article_group` → Umsatz/Ertrag per period
- `mv_purchase_period_article` grouped by article_group → Einkaufsmengen
- Live query `document_line` JOIN `article` → Bewegungstabelle
- Live query `document` → Belegtabelle

### 5. `apps/web/src/features/workspace` — UI Components

**`views/kpi-view.tsx`** (replace mocked data with `$getDashboardKpis()`)

**`views/period-comparison-view.tsx`** (new standalone workspace view):

- Fiscal year selector (current + prior years from `fiscal_period`)
- Bar/line chart: Umsatz vs. Rohertrag per period (1–12)
- Year-over-year toggle
- Registered as `stats:period-comparison` in `VIEW_REGISTRY`

**`views/article-detail.tsx`** (extend):

- Add tabs: Statistik | Lagerjournal | Bewegungen | Belege
- Statistik tab: Umsatz/Ertrag per period chart + Einkaufsmengen
- Lagerjournal tab: `StockLedgerTable` component

**`views/detail-views.tsx` / address detail** (extend):

- Add tabs: Statistik | Offene Posten | Bewegungen | Belege

**`components/StockLedgerTable.tsx`** (new shared component):

- Columns: Datum | Beleg-Nr. | Typ | Lagerort | Zugang | Abgang | Lagerstand | Auftrag | Bestellung
- Serial mode: extra Seriennummer column
- Batch mode: extra Charge column
- Sticky running-balance footer

## Technical Details

### New Table: `fiscal_period`

```sql
CREATE TABLE fiscal_period (
  fiscal_period_id  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL,
  company_id        uuid NOT NULL REFERENCES company(company_id),
  fiscal_year       integer NOT NULL,           -- e.g. 2025
  period_no         integer NOT NULL CHECK (period_no BETWEEN 1 AND 12),
  start_date        date NOT NULL,
  end_date          date NOT NULL,
  is_closed         boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, fiscal_year, period_no)
);
CREATE INDEX ON fiscal_period (tenant_id, company_id, start_date, end_date);
```

Period generation example for `fiscal_year_start_month = 10` (October), fiscal year 2025:

- Period 1: 2025-10-01 → 2025-10-31
- Period 3: 2025-12-01 → 2025-12-31
- Period 4: 2026-01-01 → 2026-01-31
- Period 12: 2026-09-01 → 2026-09-30
  (`fiscal_year` label = start calendar year of the fiscal year)

### New Table: `fact_purchase_event`

```sql
CREATE TABLE fact_purchase_event (
  fact_purchase_event_id  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid NOT NULL,
  company_id              uuid,
  source_document_id      uuid,
  source_document_line_id uuid,
  supplier_id             uuid,                 -- address.address_id
  article_id              uuid,
  event_type              varchar,              -- 'original' | 'correction'
  quantity_delta          numeric NOT NULL,
  amount_net_delta        numeric NOT NULL,     -- vendor invoice line total
  avg_cost_before         numeric,             -- gld_purchase before this event
  avg_cost_after          numeric,             -- gld_purchase after this event
  booking_period          date NOT NULL,
  fiscal_period_id        uuid REFERENCES fiscal_period(fiscal_period_id),
  transaction_id          uuid,
  created_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON fact_purchase_event (tenant_id, article_id);
CREATE INDEX ON fact_purchase_event (tenant_id, supplier_id);
CREATE INDEX ON fact_purchase_event (tenant_id, fiscal_period_id);
CREATE INDEX ON fact_purchase_event (tenant_id, transaction_id);
```

### Extensions to Existing Tables

```sql
-- fact_sales_event: add COGS and period FK
ALTER TABLE fact_sales_event
  ADD COLUMN cogs_delta       numeric,
  ADD COLUMN fiscal_period_id uuid REFERENCES fiscal_period(fiscal_period_id);
CREATE INDEX ON fact_sales_event (tenant_id, fiscal_period_id);

-- document: add payment flags
ALTER TABLE document
  ADD COLUMN is_paid     boolean NOT NULL DEFAULT false,
  ADD COLUMN paid_at     timestamptz,
  ADD COLUMN paid_amount numeric;

-- Indexes for live order/OP queries
CREATE INDEX ON document (tenant_id, status) WHERE status != 'posted';
CREATE INDEX ON document (tenant_id, customer_id, is_paid) WHERE is_paid = false;
```

### AVCO Calculation in posting-command.ts

For document type `r` (vendor invoice), per article per line:

```typescript
// Pseudo-code — runs inside existing transaction
const balance = await sql`
  SELECT on_hand_qty, gld_purchase FROM inventory_balance
  WHERE tenant_id = ${tenantId} AND article_id = ${articleId}
  FOR UPDATE
`;
const currentQty = balance.on_hand_qty ?? 0;
const currentAvg = balance.gld_purchase ?? lineUnitPrice;
const newQty = currentQty + quantityDelta;
const newAvg =
  newQty > 0 ? (currentQty * currentAvg + quantityDelta * lineUnitPrice) / newQty : lineUnitPrice;

await sql`
  UPDATE inventory_balance SET gld_purchase = ${newAvg}, gld_cost = ${newAvg}
  WHERE tenant_id = ${tenantId} AND article_id = ${articleId}
`;
// Then insert fact_purchase_event with avg_cost_before and avg_cost_after
```

### Materialized Views (key examples)

```sql
-- Global sales per period
CREATE MATERIALIZED VIEW mv_sales_period AS
SELECT
  fse.tenant_id,
  fse.company_id,
  fse.fiscal_period_id,
  fp.fiscal_year,
  fp.period_no,
  SUM(fse.quantity_delta)                           AS total_qty,
  SUM(fse.amount_net_delta)                         AS total_amount_net,
  SUM(fse.cogs_delta)                               AS total_cogs,
  SUM(fse.amount_net_delta) - SUM(fse.cogs_delta)  AS total_profit,
  COUNT(DISTINCT fse.source_document_id)            AS document_count
FROM fact_sales_event fse
JOIN fiscal_period fp ON fp.fiscal_period_id = fse.fiscal_period_id
GROUP BY fse.tenant_id, fse.company_id, fse.fiscal_period_id, fp.fiscal_year, fp.period_no;

CREATE UNIQUE INDEX ON mv_sales_period (tenant_id, company_id, fiscal_period_id);

-- Per article group (requires JOIN to article for group lookup)
CREATE MATERIALIZED VIEW mv_sales_period_article_group AS
SELECT
  fse.tenant_id,
  fse.company_id,
  fse.fiscal_period_id,
  a.article_group_id,
  SUM(fse.amount_net_delta)                         AS total_amount_net,
  SUM(fse.cogs_delta)                               AS total_cogs,
  SUM(fse.amount_net_delta) - SUM(fse.cogs_delta)  AS total_profit
FROM fact_sales_event fse
JOIN article a ON a.article_id = fse.article_id
WHERE a.article_group_id IS NOT NULL
GROUP BY fse.tenant_id, fse.company_id, fse.fiscal_period_id, a.article_group_id;

CREATE UNIQUE INDEX ON mv_sales_period_article_group (tenant_id, company_id, fiscal_period_id, article_group_id);
```

The remaining 6 MVs follow the same pattern with their respective dimension columns.

### MV Refresh Strategy

```typescript
// At end of postDocument() — after successful commit:
await sql`SELECT pg_notify('stats_refresh', ${tenantId})`;
```

```sql
-- pg_cron job (registered once at DB init):
SELECT cron.schedule('refresh-stats-mvs', '*/5 * * * *', $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_sales_period;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_sales_period_customer;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_sales_period_article;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_sales_period_article_group;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_sales_period_address_category;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_purchase_period;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_purchase_period_supplier;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_purchase_period_article;
$$);
```

### Lagerstandsjournal Query (article_id)

```sql
-- Non-serial/batch articles: 1 row per document_line
SELECT
  im.movement_date,
  d.document_no,
  dt.code AS doc_type,
  w.name  AS warehouse,
  CASE WHEN im.qty_delta > 0 THEN im.qty_delta END AS zugangsmenge,
  CASE WHEN im.qty_delta < 0 THEN ABS(im.qty_delta) END AS abgangsmenge,
  SUM(im.qty_delta) OVER (
    PARTITION BY im.tenant_id, im.warehouse_id
    ORDER BY im.movement_date, im.created_at
  ) AS lagerstand
FROM inventory_movement im
JOIN document d ON d.document_id = im.source_document_id
JOIN document_type dt ON dt.document_type_id = d.document_type_id
JOIN warehouse w ON w.warehouse_id = im.warehouse_id
WHERE im.tenant_id = $tenantId AND im.article_id = $articleId
  AND im.serial_number_id IS NULL  -- exclude serial rows for non-serial mode
ORDER BY im.movement_date, im.created_at;
```

Running balance via window function `SUM(qty_delta) OVER (ORDER BY movement_date)` gives the traceable Lagerstand per warehouse. Current `reserved_qty` and `expected_purchase_qty` appended from `inventory_balance` as a footer/pinned row.

### Workspace Registry Additions

```typescript
// registry.ts VIEW_REGISTRY additions:
{ key: "stats:period-comparison", entity: "_meta", view: "period-comparison",
  label_de: "Perioden-Vergleich", label_en: "Period Comparison",
  section_de: "Statistik", section_en: "Statistics" }

{ key: "stats:top-groups", entity: "_meta", view: "top-article-groups",
  label_de: "Top Warengruppen", label_en: "Top Article Groups",
  section_de: "Statistik", section_en: "Statistics" }
```

## Open Questions

- **pg_cron availability**: Is `pg_cron` extension installed in the target PostgreSQL instance? If not, MV refresh must be triggered via application-level cron (e.g., a Node.js cron job calling a server function). Confirm before implementation.
- **`fiscal_year_start_month` per company vs. per tenant**: Currently `fiscal_year_start_month` is on `company`. If multiple companies in one tenant have different fiscal year starts, each needs its own `fiscal_period` rows — the design already handles this since `fiscal_period` is keyed by `company_id`.
- **Inventory valuation at period snapshot**: The Lagerstandsjournal shows movements but not a period-end inventory value. A future `mv_inventory_period_snapshot` could capture period-end `on_hand_qty × gld_purchase` for balance sheet support.
- **`is_closed` enforcement**: When `fiscal_period.is_closed = true`, `postDocument()` should reject postings with `booking_period` inside that period. This guard should be added to `postDocument()` as a new `errorCode: "PERIOD_CLOSED"`.
- **Einstellungen workspace**: The `/app/workspace/einstellungen` view needs a UI for viewing/managing fiscal periods (at minimum: list periods, close a period). This should be part of the implementation scope but is not detailed here.
