# 05 — Documents, Settings & Statistics Implementation List

## Source of Truth

- **Document module PRD**: `.gemini/_toimplement/documents.md`
- **Document module as-built**: `.gemini/_toimplement/postDokument.md`
- **Document gap analysis**: `.gemini/_toimplement/postDokument_to_implement.md`
- **Settings PRD**: `.gemini/_toimplement/firmenstamm.md`
- **Statistics PRD**: `.gemini/_toimplement/10_statistics_module.md`
- **AI Feedback PRD**: `.gemini/_toimplement/ticket_service.md`
- **Architecture**: `.gemini/00_core_architecture.md`
- **Design language**: `.gemini/design.md`
- **DB schema**: `.gemini/schema.md`
- **Prior checklist**: `.gemini/04_redesign.md`

## Architecture Context (Updated 2026-05-15)

> **IMPORTANT**: The architecture described in the original "What Is Already Done" section below was aspirational. As of 2026-05-15, the actual implementation is:
>
> - **No `packages/domain`** — domain logic is in `packages/db/src/services/document-service.ts`
> - **No `server-functions.ts`** — all server logic in `apps/web/src/routes/api/` route handlers
> - `db.execute()` returns the array directly (postgres-js) — NOT `result.rows`
> - Schema imports: use `@repo/db/schema`, NOT `@repo/db/schema/app.schema`
> - `article.taxClassId` (not taxCodeId), no `article.salesPrice`

The codebase has two layers:

- **Service layer** (`packages/db/src/services/document-service.ts`) — posting engine (all movement types + AVCO + COGS + pg_notify), storno, convert, tree query, pricing, delta correction
- **Route layer** (`apps/web/src/routes/api/documents/`, `apps/web/src/routes/api/stats/`) — REST endpoints calling the service layer; UI (`documents.tsx`, `document-editor.tsx`) now wired to real endpoints

---

## What Is Already Done — Do Not Rebuild

### Domain Layer (packages/domain + server-functions.ts)

- [x] Posting engine — all 15 document types (N, A, L, R, G, b, l, r, g, V, Z, E, U, q, p)
- [x] Storno: A (unreserve), L (return to stock), R→G, r→g
- [x] Delta correction (`apply-delta-effect.ts` + `applyDeltaEffectFn`)
- [x] BOM explosion (`explode-bom.ts` + `explodeDocumentBomFn`)
- [x] Document group X00 protection (guard in entity-command-service.ts)
- [x] Serial/batch tracking in posting
- [x] `listDocumentsFn` — paginated with filters
- [x] `listDocumentTreeFn` — real DB query for sidebar tree
- [x] `updateDocumentFn` — header + replace all lines
- [x] `postDocumentFn` — triggers posting engine
- [x] `stornoDocumentFn` — reversal logic
- [x] `resolveArticlePricingFn` — price + tax for article/address/date
- [x] `next_sequence_no` — document number assignment at draft creation

### UI Layer (packages/ui + routes)

- [x] `TriViewWorkspace`, `DataGrid`, `NavigationTree`, `ContextTabs`, `InspectorPanel`, `EntityMask`, `ActionBar`, `DocumentEditor` — fully redesigned (see 04_redesign.md)
- [x] `documents.tsx` — TriView layout, NavigationTree, DataGrid with document columns, Lines tab, Header Details InspectorPanel, F3/F2/F7/F8/F9 commands wired; F3 now opens `DocumentEditor` directly in new-document mode when a group is selected
- [x] `DocumentEditor` — **full Belegerfassung rewrite** (2026-05-15): 4-column header (Rechnungsadresse / Lieferadresse / Lager+Zahlungsbed.+Versandart / Datum+Währung), group-defaults pre-fill on new documents, keyboard-first inline lines table with article quick-search + Tab flow + live totals, real Post/Wandeln/Storno wiring
- [x] `AddressPickerField` (`packages/ui/components/address-picker-field.tsx`) — type-ahead search via `/api/addresses/search`, address card with inline manual edit mode, stores FK + JSONB snapshot, auto-fills Währung/Zahlungsbedingung from address record
- [x] `DocumentLinesEditor` (inline in `document-editor.tsx`) — keyboard-first: article quick-search → pricing lookup → Tab flow (Qty→EP→R%→next line), auto-first-empty-line, client-side Netto/MwSt/Brutto totals, batch save on F10
- [x] `StatisticsModule` — right drawer with entity-aware KPI cards (real query data)

---

## Phase 1 — Document Module: Domain Wiring

> Connect the redesigned route layer to the domain server functions. The domain is complete — the UI needs to call the right endpoints instead of generic CRUD stubs.

### 1.A Seed Data Corrections (P0 — 30 min)

**Problem**: `seed-document-defaults.ts` has wrong document type names and prefixes for some entries.

- [ ] **1.A1** `packages/domain/src/commands/seed-document-defaults.ts`: Verify and fix the name/prefix table against the canonical list:

| Code | Name            | Prefix |
| ---- | --------------- | ------ |
| N    | Angebot         | ANG-   |
| A    | Auftrag         | AUF-   |
| L    | Lieferschein    | LIS-   |
| R    | Rechnung        | RE-    |
| G    | Gutschrift      | GU-    |
| b    | Bestellung      | BES-   |
| l    | WE-Lieferschein | WEL-   |
| r    | WE-Rechnung     | WER-   |
| g    | WE-Gutschrift   | WEG-   |
| V    | Inventurbuchung | INV-   |
| Z    | Zubuchung       | ZUB-   |
| E    | Entnahme        | ENT-   |
| U    | Umlagerung      | UMB-   |

Note: Only affects new companies; existing data retains old prefixes.

### 1.B Posting Bug Fix (P0 — 10 min)

- [x] **1.B1** `available_qty` recalculation for type `b` — implemented in `DocumentService.postDocument()` in `packages/db/src/services/document-service.ts`.

### 1.C Document Navigation Tree — Three-Level Sidebar

**Current state**: `documents.tsx` renders a flat NavigationTree of `documentType` rows.

**Required**: Three-level tree — Direction (Warenausgang / Wareneingang / Lagerbuchungen) → Document Type → Document Group. Lagerbuchungen section collapsed by default.

- [x] **1.C1** Three-level inline tree in `documents.tsx` — fetches from `GET /api/documents/tree`, groups by direction.
- [x] **1.C2** ADJUSTMENT section collapsed by default via `useState<Set<string>>`.
- [x] **1.C3** `selectedGroupId` state drives `?documentGroupId=...` filter on document list query.
- [x] **1.C4** `GET /api/documents/tree` at `apps/web/src/routes/api/documents/tree.ts`; document list uses generic `?documentGroupId=` FK filter via existing `DataService.list()` filter support.

### 1.D Document List — Server-Side Filtering

- [x] **1.D1** `DataService.list()` extended with `options: { limit?, orderBy? }`. FK filters already supported.
- [x] **1.D2** `documents.tsx` passes `?documentGroupId=${selectedGroupId}` when a group is selected; query key includes selectedGroupId for proper cache invalidation.

### 1.E Document Editor — Real Domain Wiring

**Status**: Fully done as part of 2026-05-15 Belegerfassung rewrite.

- [x] **1.E1** Post button → `POST /api/documents/:id/post` (real mutation, invalidates document query).
- [x] **1.E2** Wandeln button → `POST /api/documents/:id/convert` (closes editor on success).
- [x] **1.E3** Stornieren button visible when `status==='posted'` → `POST /api/documents/:id/storno`.
- [x] **1.E4** Status-based button visibility fully implemented (canPost / canConvert / canStorno flags).
- [x] **1.E5** `convertDocument` in `DocumentService` at `packages/db/src/services/document-service.ts`.
- [x] **1.E6** New-document flow: F3 on a selected group → editor opens with `documentId="__new__"` + `documentGroupId`; group defaults pre-fill warehouse/paymentTerm/shippingMethod/currency; F10 POSTs header then lines sequentially.
- [x] **1.E7** New API endpoints: `GET /api/addresses/search?q=` (ILIKE on companyName/addressNo/city/searchText) and `GET /api/articles/search?q=` (ILIKE on articleNo/name) — both tenant-scoped, limit param, archived excluded. Pricing reuses existing `GET /api/articles/$articleId/pricing`.

### 1.F applyDeltaEffect UI Trigger

**Current state**: `applyDeltaEffectFn` server function exists and is complete. No UI button.

- [ ] **1.F1** `apps/web/src/features/workspace/components/panels/lines-panel-adapter.tsx` or `document-lines-view.tsx`: Add a per-line action "Korrektur" (delta correction) button — visible only on posted documents. Opens a small dialog: qty delta input (signed). Calls `applyDeltaEffectFn({ documentLineId, qtyDelta, userId })`.

### 1.G Article Autocomplete — Price + Tax Resolution

- [x] **1.G1** Wired in `DocumentLinesEditor` (inline in `document-editor.tsx`): selecting an article calls `GET /api/articles/$articleId/pricing?customerId=&documentDate=` → pre-fills `netPrice` + `taxCodeId`; tax rate resolved from `taxRateMap` (loaded from `/api/data/taxCode`); focus advances to Qty input automatically.

### 1.H InventoryBalanceTable — Article Dialog childSection

**Required by documents.md §35–37**: Show inventory balance per warehouse in the article detail dialog.

- [x] **1.H1** `childSection?: (record) => ReactNode` added to `entity-mask.tsx` (renders below form fields when record loaded).
- [x] **1.H2** `packages/ui/components/inventory-balance-table.tsx` — Bestand/Reserviert(amber)/Verfügbar(green/red)/Erwartet columns, Gesamt row, 3-row skeleton.
- [x] **1.H3** `articles.tsx` edit dialog wired with `childSection={(record) => <InventoryBalanceTable articleId={record.articleId as string} />`.

### 1.I CustomerStatsSection — Address Dialog childSection

**Required by documents.md §38–40**: Show last 10 documents + annual revenue for customer addresses.

- [x] **1.I1** `packages/ui/components/customer-stats-section.tsx` — last-10 docs table + annual revenue grouped by year (shown only when posted invoices exist), skeleton, empty state.
- [x] **1.I2** `addresses.tsx` edit dialog wired with `childSection={(record) => record.isCustomer ? <CustomerStatsSection addressId={record.addressId as string} /> : null}`.
- [x] **1.I3** `limit` and `orderBy` supported in `DataService.list()` + `api/data/$.ts`.

---

## Phase 2 — Settings & Firmenstamm

> Upgrade the placeholder Settings route into a full two-column settings workspace with company master data and all 19 helper table entities.

### 2.A EntityMask Inline Mode

- [x] **2.A1** `inline?: boolean` added to `entity-mask.tsx` — no modal wrapper, no Cancel button, renders in document flow.

### 2.B SettingsView Component

- [ ] **2.B1** Create `apps/web/src/routes/_auth/app/settings/settings-view.tsx`: Two-column layout component.
  - Left: 220px sidebar with grouped navigation (see 2.C)
  - Right: content area — either the company inline form or a DataGrid + EntityMask dialog for the selected entity
  - Internal state: `selectedEntity: string` (default `"company"`)
  - No router params — sub-navigation is component-internal state
- [ ] **2.B2** `apps/web/src/routes/_auth/app/settings/index.tsx`: Replace current helper-table sidebar + DataGrid implementation with `<SettingsView />`. Keep the current ActionBar + subCrumb wiring.

### 2.C Settings Sidebar — 20 Entities in 5 Groups

- [ ] **2.C1** `settings-view.tsx`: Sidebar navigation uses this static group structure:

  **Organisation**
  - Firmenstamm (`company`)
  - Bankverbindungen (`bank_account`)
  - Nummernkreise (`number_sequence`)

  **Vertrieb**
  - Zahlungsbedingungen (`payment_term`)
  - Versandarten (`shipping_method`)
  - Preislisten (`price_list`)
  - Rabattgruppen (`discount_group`)
  - Adresskategorien (`address_category`)
  - Beleggruppen (`document_group`)
  - Branchen (`industry`)

  **Lager & Artikel**
  - Einheiten (`unit`)
  - Artikelgruppen (`article_group`)
  - Lagerorte (`warehouse`)

  **Finanzen**
  - Steuerklassen (`tax_class`)
  - Steuerschlüssel (`tax_code`)
  - Kostenstellen (`cost_center`)
  - Sachkonten (`gl_account`)
  - Währungen (`currency`)

  **Geodaten**
  - Länder (`country`)
  - PLZ-Verzeichnis (`postal_code`)

- [ ] **2.C2** `settings-view.tsx`: Each sidebar item is a 28px clickable row. Selected item: primary fill background. Group label: 10px uppercase separator. Matches NavigationTree visual style.
- [ ] **2.C3** `settings-view.tsx`: On item click, set `selectedEntity` state and call `setSubCrumb(label)` from ActionBarContext.

### 2.D Firmenstamm — Pseudo-Singleton Inline Form

- [ ] **2.D1** `settings-view.tsx`: When `selectedEntity === 'company'`, fetch the first active company for the current tenant via `GET /api/data/company?is_active=true&limit=1`. Render `<EntityMask entityName="company" recordId={company.companyId} mode="edit" inline={true} embedded={true} />`. No "New" button. No list/grid.
- [ ] **2.D2** `packages/db/src/services/data.ts`: Add support for `limit` query param in the list endpoint — used by company singleton fetch.
- [ ] **2.D3** `apps/web/src/routes/api/data/$.ts`: Pass `limit` from query params to DataService.

  Form sections in EntityMask for `company` (via tenant_fields metadata):
  - **Allgemein**: name, legal_name, company_no, email, homepage, phone_landline, phone_mobile, gln, eori_no, duns_no
  - **Adresse**: address_line_1, address_line_2, postal_code, city, country_code
  - **Steuer & Zoll**: tax_number, tax_authority, vat_id, fiscal_year_start_month, currency_id
  - **Bank**: bank_name, bank_iban, bank_bic

### 2.E List Entities — DataGrid + EntityMask Dialog

- [ ] **2.E1** `settings-view.tsx`: For all non-company entities, render:
  - `<DataGrid entityName={selectedEntity} ... />` with standard columns
  - F3 (or "+ Neu" button) → open `<EntityMask mode="create" ... />` in a modal dialog
  - Row click / F2 → open `<EntityMask mode="edit" recordId={id} ... />` in a modal dialog
  - F4 → PATCH `{ archived: true }` or `{ is_active: false }` depending on entity
  - No nested router navigation; all state is local to SettingsView

### 2.F DB Migration — Seed tenant_fields for Settings Entities

- [ ] **2.F1** Write a new Drizzle migration (`packages/db/src/migrations/XXXX_seed_settings_fields.ts`): Seeds `tenant_fields` rows with `tenant_id = BASE_TENANT_ID` for all 20 settings entities. For each entity, seed all business-relevant DB columns as `is_visible = true` fields with `scope = 'global'`. This makes them immediately available in EntityMask and configurable via Inline Designer.

  Entities to seed (min required fields per entity):
  - `company`: all 20+ columns from schema
  - `bank_account`: iban, bic, bank_name, currency_id, is_default
  - `number_sequence`: prefix, next_value, padding
  - `payment_term`: name, net_days, discount_days, discount_percentage
  - `shipping_method`: name, tracking_url_template
  - `price_list`: name, currency_id, is_net
  - `discount_group`: name, percentage
  - `address_category`: name
  - `document_group`: name, document_type, group_number, default_warehouse_id, next_group_id, require_serial_tracking, require_batch_tracking
  - `industry`: name
  - `unit`: code, name
  - `article_group`: code, name
  - `warehouse`: code, name, company_id
  - `tax_class`: code, name
  - `tax_code`: code, description, tax_rate
  - `cost_center`: code, name, company_id
  - `gl_account`: account_no, name, account_type, company_id
  - `currency`: code, name, symbol, decimals
  - `country`: iso2_code, iso3_code, name, is_eu
  - `postal_code`: country_code, plz, city, state

- [x] **2.F1** `packages/db/src/scripts/seed-settings-fields.ts` created — idempotent seed script for all 20 entities using `onConflictDoNothing()`.
- [ ] **2.F2** Run seed script: `npx tsx packages/db/src/scripts/seed-settings-fields.ts` — **NOT YET EXECUTED**.

### 2.G i18n Keys for Settings

- [x] **2.G1** `settings.*` keys added to `en.json` (20 entity labels, 5 group headings).
- [x] **2.G2** `de.json` German equivalents added.

---

## Phase 3 — Statistics Module

> Full AVCO-based statistics: fiscal periods, materialized views, dashboard KPIs, address/article stats, Lagerstandsjournal.

### 3.A Schema Changes

- [x] **3.A1** `fiscalPeriod` table added to `app.schema.ts`.
- [x] **3.A2** `factPurchaseEvent` table added (with supplierId, avgCostBefore, avgCostAfter).
- [x] **3.A3** `factSalesEvent.cogsDelta` + `factSalesEvent.fiscalPeriodId` added.
- [x] **3.A4** `document.isPaid` + `document.paidAt` + `document.paidAmount` added.
- [x] **3.A5** Migration `20260515021817_curious_katie_power` applied successfully.

### 3.B Materialized Views (Raw SQL Migration)

- [x] **3.B1** 6 materialized views created via raw SQL migration `20260515120000_statistics_views`: `mv_sales_period`, `mv_sales_period_customer`, `mv_sales_period_article`, `mv_purchase_period`, `mv_purchase_period_supplier`, `mv_purchase_period_article`. UNIQUE indexes on each.
  - Note: `mv_sales_period_article_group` and `mv_sales_period_address_category` **not yet created** (requires article→articleGroup join — skipped for now).
- [x] **3.B2** Performance indexes `idx_document_status_tenant` + `idx_document_paid` applied.
- [x] **3.B3** pg_cron not available — using `pg_notify('stats_refresh', tenantId)` at end of each `postDocument()` instead. Application-level refresh can subscribe via LISTEN.

### 3.C Domain — Fiscal Period Generator

- [x] **3.C1** `packages/db/src/services/fiscal-period-generator.ts` — `generateFiscalPeriods` + `resolveFiscalPeriodId`. Handles cross-year fiscal years, lazy generation on first use.
- [ ] **3.C2** Wire `generateFiscalPeriods` to company creation flow — **not yet done** (no company creation flow exists yet).

### 3.D Domain — Posting Extensions (AVCO + COGS + Purchase Facts)

- [ ] **3.D1** `packages/domain/src/commands/posting-command.ts`: For document type `r` (WE-Rechnung/vendor invoice), after the existing `on_hand` upsert, add AVCO write:
  - Query current `inventory_balance.on_hand_qty` + `gld_purchase` with `FOR UPDATE`
  - Compute `newAvg = (currentQty * currentAvg + qty * lineUnitPrice) / newQty`
  - Update `gld_purchase = newAvg`, `gld_cost = newAvg`
  - Insert `fact_purchase_event` with `avg_cost_before`, `avg_cost_after`, `fiscal_period_id` from `resolveFiscalPeriodId()`
- [x] **3.D1** AVCO for type `r`: reads current gldPurchase, computes weighted average, updates inventoryBalance, inserts factPurchaseEvent with avgCostBefore/After + fiscalPeriodId.
- [x] **3.D2** COGS for type `R`: reads gldPurchase at posting time, writes cogsDelta + fiscalPeriodId to factSalesEvent.
- [ ] **3.D3** Type `g` (WE-Gutschrift) factPurchaseEvent with event_type='correction' — **not yet done** (type g reverses on_hand but no factPurchaseEvent inserted).
- [x] **3.D4** `pg_notify('stats_refresh', tenantId)` emitted at end of each `postDocument()`.

### 3.E Server Functions — Statistics Queries

- [x] **3.E1** `GET /api/stats/dashboard` — mv_sales_period current/prior year, open orders, inventory value, draft count.
- [x] **3.E2** `GET /api/stats/address/:addressId` — mv_sales_period_customer (24 periods), last 20 documents for customer.
- [x] **3.E3** `GET /api/stats/article/:articleId` — mv_sales_period_article (24 periods), stock ledger via window function SQL (running balance per warehouse).
- [ ] **3.E4** `getArticleGroupStatsFn` — **not yet done** (mv_sales_period_article_group not yet created).

### 3.F UI — Statistics Components

- [x] **3.F1** `statistics-module.tsx` — real KPIs from `/api/stats/dashboard`: Revenue (YoY ▲/▼), Gross Profit, Open Orders, Drafts, Inventory Value. staleTime=5min.
- [x] **3.F2** `packages/ui/components/stock-ledger-table.tsx` — Datum/Beleg-Nr(mono)/Lagerort/Zugang(green)/Abgang(amber)/Lagerstand(bold), window-function running balance, 8-row skeleton.
- [x] **3.F3** `articles.tsx` — "Umsatz" tab (period table: Geschäftsjahr/Periode/Umsatz/Menge) + "Lagerstandsjournal" tab (StockLedgerTable).
- [x] **3.F4** `addresses.tsx` — "Umsatz" tab (period revenue/profit) + "Offene Posten" tab (recent docs DataGrid from stats response).
- [ ] **3.F5** Period comparison route `/app/statistics/period-comparison` — **not yet done**.

### 3.G i18n Keys for Statistics

- [x] **3.G1** `stats.*` keys added to `en.json`: revenue, profit, cogs, openOrders, openInvoices, inventoryValue, period, fiscalYear, stockLedger, movements, documents, openItems, inbound, outbound, reserved, available, expected.
- [x] **3.G2** German equivalents added to `de.json`.

---

## Phase 4 — AI Feedback Service

> In-app bug/feature reporting backed by a LiteLLM microservice and GitHub API.

### 4.A LiteLLM Python Microservice

- [x] **4.A1** `services/llm/requirements.txt` — fastapi, uvicorn, litellm.
- [x] **4.A2** `services/llm/main.py` — FastAPI with GET /health + POST /complete → litellm.completion().
- [ ] **4.A3** Service not yet in docker compose — start manually: `cd services/llm && uvicorn main:app --port 11435`.

### 4.B Config Storage

- [ ] **4.B1** `packages/domain/src/commands/` or `packages/domain/src/queries/`: Add `getLlmConfig(sql)` — reads `system_settings` where `scope = 'global'` and `key = 'llm_config'`; decrypts `api_key` and `github_token` using AES-256-GCM from `process.env.ENCRYPTION_SECRET`.
- [ ] **4.B2** Same location: Add `saveLlmConfig(sql, config)` — encrypts secrets, upserts into `system_settings`. Validate `ENCRYPTION_SECRET` is 32-byte hex; throw if missing.
- [ ] **4.B3** `apps/web/src/server/server-functions.ts`: Add `getLlmConfigFn()` (admin-gated: check `user.isSystemAdmin`, return 403 otherwise) and `saveLlmConfigFn(config)` (same gate). Return secrets as `"••••"` sentinel in `getLlmConfigFn` response.

### 4.C Frontend Context Snapshot

- [ ] **4.C1** Create `apps/web/src/lib/feedback-snapshot.ts`:
  ```ts
  export interface FeedbackSnapshot {
    url: string;
    userAgent: string;
    viewport: { width: number; height: number };
    userId: string;
    tenantId: string;
    locale: string;
    lastError: { message: string; stack?: string } | null;
    timestamp: string;
    focusState: { entity?: string; recordId?: string; panelId?: string };
  }
  export function captureFeedbackSnapshot(
    userId: string,
    tenantId: string,
    locale: string,
    focusState: FocusContextState,
    lastError: { message: string; stack?: string } | null,
  ): FeedbackSnapshot;
  ```
  Pure function — no side effects.

### 4.D Feedback Modal

- [ ] **4.D1** Create `packages/ui/components/feedback-modal.tsx`:
  - Props: `open: boolean`, `onClose: () => void`, `snapshot: FeedbackSnapshot`
  - Textarea (required, min 10 chars) for user description
  - Collapsible `<details>` showing `JSON.stringify(snapshot, null, 2)` in `<pre>` (read-only, `overflow-auto max-h-40`)
  - Submit button → loading spinner → success state showing issue URL as `<a href={url} target="_blank">` link
  - Error state with retry
  - Esc → close (via useDismiss)
- [x] **4.D2** FeedbackModal submits to `POST /api/feedback/submit`.

### 4.E Submit Server Function

- [x] **4.E1** `apps/web/src/routes/api/feedback/submit.ts` — reads llm_config from system_settings, calls LiteLLM /complete, creates GitHub issue via API. Returns `{issueUrl}` or `{configMissing: true}`.

### 4.F Header Entry Point

- [x] **4.F1** `?` icon button (MessageSquarePlus) in AppBar → `setFeedbackOpen(true)`.
- [x] **4.F2** `open-feedback` command registered (Shift+F1, scope=global, group=workflow).
- [x] **4.F3** FeedbackModal mounted; snapshot captured on open transition.
- [x] **4.F4** `window.onerror` + `window.onunhandledrejection` listeners installed on mount.

### 4.G Admin Config Panel

- [x] **4.G1** `apps/web/src/routes/_auth/app/admin/llm-config.tsx` — Endpoint URL, Model, API Key (show/hide), GitHub Token, GitHub Repo fields. `POST /api/admin/llm-config` saves to system_settings.
- [x] **4.G2** `feedback.*` keys in en.json + de.json.

---

## Phase 5 — Gap Items from 04_redesign.md (Remaining)

- [ ] **5.1** DataGrid `flush?: boolean` prop — still missing (cosmetic only).
- [ ] **5.2** Manual browser test: verify no `console.error` during normal usage.
- [x] **5.3** `duplicate-record` (F8) in documents.tsx — POSTs a copy of the selected document.
- [x] **5.4** `transform-record` (F7) in documents.tsx → wired to `/api/documents/:id/convert` (1.E2).

---

## Verification Checklist

### Document Module

- [x] Three-level sidebar tree: OUTBOUND / INBOUND / ADJUSTMENT → Type → Group
- [x] Lagerbuchungen (ADJUSTMENT) section collapsed by default
- [x] Selecting a tree node filters the document list by type + group (server-side)
- [x] DocumentEditor: 4-column header layout — Rechnungsadresse / Lieferadresse / Logistik / Datum+Währung
- [x] DocumentEditor: AddressPickerField with type-ahead search, address card, manual edit mode
- [x] DocumentEditor: group defaults pre-fill warehouse / Zahlungsbedingung / Versandart / Währung on new documents
- [x] DocumentEditor: F3 on selected group opens editor in new-document mode (`__new__` + `documentGroupId`)
- [x] DocumentEditor: Post button calls `POST /api/documents/:id/post`, disabled after posting
- [x] DocumentEditor: Wandeln button calls `POST /api/documents/:id/convert`, closes on success
- [x] DocumentEditor: Stornieren button visible only for posted documents, calls `POST /api/documents/:id/storno`
- [x] DocumentEditor: keyboard shortcuts F10 (save), F9 (post), Escape (close), Ctrl+Delete (delete line)
- [x] Document lines: inline editable table, article quick-search via `/api/articles/search`
- [x] Document lines: selecting article triggers pricing lookup → pre-fills netPrice + taxCodeId
- [x] Document lines: Tab flow Qty → EP → R% → next line (or new line if last)
- [x] Document lines: live Netto / MwSt / Brutto totals computed client-side
- [x] Article dialog: InventoryBalanceTable visible below form fields
- [x] InventoryBalanceTable: reserved_qty in amber, available_qty in green, total row when > 1 warehouse
- [x] Address dialog: CustomerStatsSection visible when `is_customer = true`
- [x] CustomerStatsSection: shows last 10 documents + annual revenue (only when invoices exist)
- [x] Type "b" posting: `available_qty` recalculated correctly
- [x] Lines view: "Korrektur" button visible on posted documents, calls `POST /api/documents/lines/:lineId/delta` (1.F1)
- [x] Seed data: document type names match canonical table — all 13 German types (1.A1)

### Settings

- [ ] Settings route renders SettingsView with grouped 2-column layout
- [ ] Sidebar shows 20 entities in 5 groups: Organisation / Vertrieb / Lager & Artikel / Finanzen / Geodaten
- [ ] Firmenstamm: renders inline form (no modal) for the first active company
- [ ] Firmenstamm: Save (F10) PATCHes the company record in-place
- [ ] Firmenstamm: no "New" button present
- [ ] All 19 list entities: DataGrid + Create/Edit dialogs working
- [ ] F3 creates new record, F2 opens edit, F4 archives for list entities
- [ ] subCrumb reflects selected settings category in ActionBar

### Statistics Module

- [ ] `fiscal_period` table exists, periods generated on company creation
- [ ] `fact_purchase_event` table exists
- [ ] `fact_sales_event.cogs_delta` and `fact_sales_event.fiscal_period_id` columns exist
- [ ] `document.is_paid`, `document.paid_at`, `document.paid_amount` columns exist
- [ ] Posting type `r`: AVCO updated in `inventory_balance.gld_purchase` after posting
- [ ] Posting type `R`: `cogs_delta` written to `fact_sales_event`
- [ ] `pg_notify` emitted after each successful `postDocument`
- [ ] 8 Materialized Views exist with UNIQUE indexes
- [ ] StatisticsModule drawer shows real KPIs (not mocked stub data)
- [ ] Article detail: Statistik / Lagerjournal / Bewegungen / Belege tabs present
- [ ] StockLedgerTable: shows running balance per warehouse with window function
- [ ] Address detail: Statistik / Offene Posten tabs present for customers

### AI Feedback Service

- [ ] `?` button in AppBar header triggers feedback modal
- [ ] Shift+F1 opens feedback modal
- [ ] Snapshot captures: url, userId, tenantId, locale, focusState, lastError, viewport
- [ ] Snapshot context section is collapsible and read-only
- [ ] Submit calls LiteLLM microservice → GitHub API → shows issue URL
- [ ] If LLM config missing: modal shows "KI-Service nicht konfiguriert" message
- [ ] Admin config panel visible only to `is_system_admin`
- [ ] API key + GitHub PAT stored AES-256-GCM encrypted in system_settings
- [ ] Python microservice starts via dev.sh; `GET /health` returns 200

---

## Recommended Execution Order

**P0 bugs (do first — data correctness):**

1. **1.A1** — Seed name/prefix fix
2. **1.B1** — available_qty for type b

**Domain wiring (unblocks full document workflow):** 3. ~~**1.E1–1.E5**~~ ✓ DocumentEditor real posting/conversion/storno wiring 4. ~~**1.E6–1.E7**~~ ✓ New-document flow + address/article search endpoints 5. ~~**1.C1–1.C4**~~ ✓ Three-level sidebar tree + server-side filtering 6. ~~**1.D1–1.D2**~~ ✓ Document list filtering 7. ~~**1.G1**~~ ✓ Article autocomplete → price+tax wired in DocumentLinesEditor

**Child section features (high user value, self-contained):** 7. **1.H1–1.H3** — InventoryBalanceTable in EntityMask 8. **1.I1–1.I3** — CustomerStatsSection in address dialog

**Settings redesign (medium effort, important for admin UX):** 9. **2.A1** — EntityMask inline prop 10. **2.B1–2.B2** — SettingsView component 11. **2.C1–2.C3** — Sidebar 20 entities in 5 groups 12. **2.D1–2.D3** — Firmenstamm pseudo-singleton form 13. **2.E1** — List entity DataGrid + dialog 14. **2.F1–2.F2** — DB migration: seed tenant_fields 15. **2.G1–2.G2** — Settings i18n keys

**Statistics — DB first, then domain, then UI:** 16. **3.A1–3.A5** — Schema: fiscal_period + fact_purchase_event + extensions 17. **3.B1–3.B3** — Materialized views + pg_cron 18. **3.C1–3.C2** — Fiscal period generator 19. **3.D1–3.D4** — Posting extensions (AVCO, COGS, pg_notify) 20. **3.E1–3.E4** — Server functions for stats 21. **3.F1** — StatisticsModule real KPIs 22. **3.F2** — StockLedgerTable component 23. **3.F3–3.F5** — Article/address stats tabs + period comparison route 24. **3.G1–3.G2** — Stats i18n keys

**AI Feedback (self-contained, can be done in parallel):** 25. **4.A1–4.A3** — Python microservice 26. **4.B1–4.B3** — Config storage + server functions 27. **4.C1** — captureFeedbackSnapshot function 28. **4.D1–4.D2** — FeedbackModal component 29. **4.E1** — submitFeedbackFn 30. **4.F1–4.F4** — Header entry point + error listener 31. **4.G1–4.G2** — Admin config panel + i18n

**Gap closure:** 32. **5.1–5.4** — Remaining 04_redesign.md items 33. **1.F1** — applyDeltaEffect UI trigger
