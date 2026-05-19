# Handoff 3: Ledger & Statistics Integrity Plan

This plan addresses critical gaps in stock movements, serial number auditability, and statistics freshness identified on 2026-05-18.

## 1. Problem Statement

- **Stock Ledger Inaccuracy**: Running balance is currently calculated over a subset of movements (last 50) and excludes Stocktakes (`V`), leading to incorrect "current" levels in the UI.
- **Serial Audit Gap**: Document lines with multiple serial numbers are posted as one multi-unit movement, losing the 1-to-1 link between a specific physical move and a specific serial number.
- **Stale Statistics**: Materialized views used for MIS are never refreshed; `pg_notify` is emitted but not handled.
- **Valuation Blind Spot**: Inventory value changes from stocktakes and production are not recorded in fact tables.

## 2. Implementation Strategy

### Phase 1: Database Schema & Constraints

- **New Migration**: Create `mv_sales_period_article_group` materialized view (joining `fact_sales_event` -> `article` -> `article_group`).
- **Constraint Update**: Relax `chk_inventory_movement_qty_logic` to allow `qty_delta` on `V` movements. This allows storing the correction delta alongside the absolute value for easy running-balance calculation.

### Phase 2: Posting Engine Refactor (`DocumentService.postDocument`)

- **V-Type Correction**:
  - Calculate `delta = absoluteQty - currentOnHand` before applying the reset.
  - Store `delta` in `inventory_movement.qty_delta`.
- **Serial Splitting**:
  - If an article has `tracking_mode === 'serial'`, split the document line posting into N individual movements of 1 unit each.
  - Each 1-unit movement must be linked to its unique `serial_number_id`.
- **Inbound SN Creation**:
  - For inbound types (`l`, `r`, `Z`, `q`), if `serial_no` (freetext) is provided in tracking, create the `serial_number` record during the posting transaction if it doesn't exist.
- **Fact Injection**:
  - Record `fact_purchase_event` (eventType: 'correction') for `V` discrepancies and `q` outputs, using current AVCO (`gld_purchase`) as the valuation basis.

### Phase 3: Statistics Layer

- **Refresh Mechanism**:
  - Create a server function `refreshStatisticsMVs(tenantId)` that executes `REFRESH MATERIALIZED VIEW CONCURRENTLY` for all 7 views.
  - Wire this to the end of `postDocument` (fire-and-forget or debounced).
- **Stock Ledger Rewrite**:
  - Update `/api/stats/article/$articleId` to fetch the true running balance.
  - SQL: `SUM(qty_delta) OVER (PARTITION BY warehouse_id ORDER BY created_at)` including `V` movements.

### Phase 4: UI Validation

- **StockLedgerTable**: Verify that stocktakes appear as "Korrektur" or "Inventur" rows and the balance correctly reflects the reset.
- **StatisticsModule**: Ensure dashboard rankings (Top Customers/Articles) reflect the latest posted documents.

## 3. Verification Checklist

- [ ] `V` movements have both `absolute_qty` and `qty_delta` in the DB.
- [ ] A line with 3 serial numbers results in 3 rows in `inventory_movement`.
- [ ] `REFRESH MATERIALIZED VIEW` runs after posting.
- [ ] Stock ledger "Lagerstand" column matches `inventory_balance.on_hand_qty` for the latest movement.
- [ ] Article Group rankings are visible in the MIS dashboard.
