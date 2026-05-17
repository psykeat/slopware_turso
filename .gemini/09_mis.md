# MIS (Management Information System / Statistics Module)

## Status: Implemented

## What Was Built

A **Context-Aware Statistics Overlay (`Alt+I`)** that adapts its content based on the active route and focused record. The overlay is a right-side Drawer rendered in the root provider tree, always available regardless of which page is open.

### Context Detection

The overlay detects context from two sources:
- **URL** (`useLocation`) → determines the active module (source of truth, never stale)
- **`focusState`** (via `useFocus`) → determines whether a specific record is selected

| URL | Row selected | Overlay mode |
|---|---|---|
| `/app/addresses` | No | Module / Addresses |
| `/app/addresses` | Yes | Record / Address detail |
| `/app/articles` | No | Module / Articles |
| `/app/articles` | Yes | Record / Article detail |
| Any other page | — | Global |

### Keyboard Trigger
`Alt+I` — dispatches `slopware:open-statistics` custom event → picked up by `StatisticsModule` listener.

---

## Architecture

### No Registry Table
The original PRD described a `stat_definition` DB table driving a generic proxy API. The implementation uses **hardcoded routes** instead, following the existing pattern in the codebase. A registry table would be a separate infrastructure project; it was deferred.

### Materialized Views
Three MVs in migration `20260516120000_mis_stat_views`, built from `fact_sales_event JOIN fiscal_period`:

| View | Grain | Columns |
|---|---|---|
| `mv_sales_period` | tenant × company × fiscal_year × period_no | `total_amount_net`, `total_cogs`, `total_profit`, `doc_count` |
| `mv_sales_period_customer` | + customer_id | `total_amount_net`, `total_cogs`, `total_profit` |
| `mv_sales_period_article` | + article_id | `total_amount_net`, `total_qty`, `total_profit` |

Unique indexes on the grain columns. Refreshed manually or via `REFRESH MATERIALIZED VIEW CONCURRENTLY`.

### API Routes

| Route | Source | Purpose |
|---|---|---|
| `GET /api/stats/dashboard` | `mv_sales_period`, `mv_sales_period_customer`, `mv_sales_period_article`, `document`, `inventory_balance` | Global KPIs + rankings |
| `GET /api/stats/addresses` | `address`, live count queries | Address module overview |
| `GET /api/stats/articles` | `article`, `inventory_balance`, `price_list_item`, `article_group` | Article module overview |
| `GET /api/stats/address/:id` | `mv_sales_period_customer`, `document` | Per-address revenue history + recent docs |
| `GET /api/stats/article/:id` | `mv_sales_period_article`, `inventory_movement` | Per-article sales history + stock ledger |

All routes enforce session auth and tenant isolation via `resolveTenantContext`.

### UI Component
**`packages/ui/components/statistics-module.tsx`** — single file containing:
- `StatisticsModule` (root, manages open state + context detection)
- `GlobalView` — Revenue/Profit/Open Orders/Inventory KPIs + Top Customers + Top Articles rankings
- `AddressModuleView` — total/customer/vendor counts, quality tiles (missing VAT, missing payment terms), top 5 countries
- `ArticleModuleView` — total/active counts, low-stock tile, no-price tile, top 5 article groups
- `AddressRecordView` — period revenue table + recent documents list
- `ArticleRecordView` — period sales table + stock movements list
- `KpiCard`, `QualityTile`, `RankingList`, `SimpleList`, `LoadingSlots` — dumb display primitives

---

## Implemented KPIs

### Global
| KPI | Source |
|---|---|
| Revenue (current + YoY delta) | `mv_sales_period` |
| Profit | `mv_sales_period` |
| Open Orders (count + value) | `document` WHERE status=draft, type=A |
| Draft count | `document` WHERE status=draft |
| Inventory Value | `inventory_balance` (on_hand_qty × gld_purchase) |
| Top 5 Customers by Revenue | `mv_sales_period_customer` JOIN `address` |
| Top 5 Articles by Revenue | `mv_sales_period_article` JOIN `article` |

### Addresses Module
| KPI | Source |
|---|---|
| Total / Customer / Vendor / Active counts | `address` |
| Customers missing VAT ID | `address` WHERE is_customer AND vat_id IS NULL |
| Customers missing Payment Terms | `address` WHERE is_customer AND payment_term_id IS NULL |
| Top 5 Countries | `address` GROUP BY country_code |

### Articles Module
| KPI | Source |
|---|---|
| Total / Active / Archived counts | `article` |
| Articles with zero/negative stock | `inventory_balance` WHERE on_hand_qty <= 0 |
| Articles without price list entry | `article` NOT EXISTS `price_list_item` |
| Top 5 Article Groups | `article` JOIN `article_group` |

### Address Record
| KPI | Source |
|---|---|
| Revenue + Profit by fiscal period (last 24) | `mv_sales_period_customer` |
| Recent documents (last 20) | `document` WHERE customer_id = :id |

### Article Record
| KPI | Source |
|---|---|
| Revenue + Qty by fiscal period (last 24) | `mv_sales_period_article` |
| Stock ledger with running balance (last 50) | `inventory_movement` JOIN `warehouse` JOIN `document` |

---

## Not Implemented (Deferred)

| Item | Reason |
|---|---|
| `stat_definition` registry table | Over-engineered for current codebase; deferred |
| Warehouse context (`/app/warehouse`) | Route not yet built |
| Belegwesen / Documents context | Route exists but no specific overlay registered |
| Lock Context feature | Nice-to-have; deferred |
| Click-to-navigate from rankings | Deferred |
| pg_cron scheduled MV refresh | Infrastructure not available; 5-minute `staleTime` used instead |
| pg_notify event-driven refresh | Deferred |
| Permission-gated KPIs (`finance:read`) | Deferred |
| Standardized `summary/series/rankings` JSON contract | Not needed without registry |
