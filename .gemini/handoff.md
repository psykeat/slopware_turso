# Session Handoff — slopware

**Date**: 2026-05-15
**Branch**: main (all changes uncommitted)

---

## What Is This

Metadata-driven, keyboard-first B2B ERP shell. Three core modules: Addresses, Articles, Documents. TanStack Start + React 19 + Drizzle ORM + Better Auth + Tailwind v4.

Monorepo:
- `apps/web` — TanStack Start app (routes, API endpoints)
- `packages/ui` — shared components, platform (command/focus system), styles
- `packages/db` — Drizzle schema + services

---

## Dev Environment Setup

### Start sequence
```bash
sudo docker compose up -d && pnpm dev
```
Use `docker compose` directly — `dev.sh` uses podman-compose which is not installed.

### Known env issues (already fixed)
- `BETTER_AUTH_SECRET` is set in `apps/web/.env` — was previously empty. Now stable.
- `VITE_BASE_URL=http://localhost:3000` — server must bind port 3000. If vite increments, Better Auth rejects all auth requests silently.
- Test user `test@user.com` exists with `email_verified=true`. Password was set during initial registration.

---

## Architecture Facts (critical — differs from old handoff)

- **No `packages/domain`** — domain logic lives in `packages/db/src/services/document-service.ts`
- **No `apps/web/src/server/server-functions.ts`** — all server logic in route-based API handlers at `apps/web/src/routes/api/`
- **`db.execute()` returns array directly** (postgres-js) — use `result[0]`, NOT `result.rows[0]`
- **Schema imports**: use `@repo/db/schema` (re-exported index), NOT `@repo/db/schema/app.schema` directly
- **Path alias**: `#/lib/...` (NOT `~/lib/...`) for `apps/web` internal imports
- **`article.taxClassId`** (not taxCodeId), **no `article.salesPrice`** — pricing returns "0" until priceList configured
- **`document.documentType`** is the single-char movement code directly (N/A/L/R/G/b/l/r/g/Z/E/V/q/p/U), not a foreign key

---

## What Is Working (as of 2026-05-15)

### Phase 04 (complete from previous session)
Shell: AppBar, ActionBar (always-render, subCrumb from context, i18n labels), StatusBar, ThemeProvider (10 themes), i18n (EN/DE), CommandProvider, FocusProvider, GlobalCommands, ShortcutHelp, CommandPalette.

All 3 modules: Addresses, Articles, Documents — TriViewWorkspace, NavigationTree, DataGrid (explicit columns with formatters), ContextTabs, InspectorPanel (Details tab), EntityMask (create/edit dialogs), F2/F3/F4/F8 commands.

### Phase 05 Session 1 (2026-05-15) — all implemented

**Document Domain Layer** (`packages/db/src/services/document-service.ts`):
- `postDocument` — all 13 movement types, AVCO for `r` (WE invoice), COGS for `R` (sales invoice), `pg_notify('stats_refresh')` on success
- `stornoDocument` — creates reversal document (R→G, r→g, L→l etc.), posts it, marks original cancelled
- `convertDocument` — follows `documentGroup.nextGroupId`, generates documentNo from numberSequence, copies lines
- `getDocumentTree` — groups documentGroups by direction with label mapping
- `resolveArticlePricing` — article + priceListItem lookup
- `applyDeltaEffect` — single-line inventory delta with audit trail

**Fiscal Period Generator** (`packages/db/src/services/fiscal-period-generator.ts`):
- `generateFiscalPeriods(companyId, tenantId, fiscalYear)` — idempotent, respects `company.fiscalYearStartMonth`
- `resolveFiscalPeriodId(tenantId, companyId, date)` — lazy generation, handles cross-year fiscal years

**API routes** (all under `apps/web/src/routes/api/`):
- `documents/tree.ts` — GET tree data
- `documents/$documentId/post.ts` — POST to trigger posting
- `documents/$documentId/storno.ts` — POST storno
- `documents/$documentId/convert.ts` — POST conversion
- `documents/$documentId/delta.ts` — POST delta correction
- `articles/$articleId/pricing.ts` — GET pricing resolution
- `stats/dashboard.ts` — GET KPIs from materialized views
- `stats/address/$addressId.ts` — GET address revenue + recent docs
- `stats/article/$articleId.ts` — GET article revenue + stock ledger (window function)
- `feedback/submit.ts` — POST to LiteLLM + GitHub Issues
- `admin/llm-config.ts` — POST to save LLM config in system_settings

**DataService improvements** (`packages/db/src/services/data.ts`):
- `list()` now accepts `options: { limit?, orderBy? }` — passed from `?limit=N&orderBy=col:dir` query params

**Documents UI**:
- `documents.tsx` — 3-level inline tree (direction → type → group), ADJUSTMENT collapsed by default, tree selection drives document list filter (`?documentGroupId=...`)
- `document-editor.tsx` — real mutations: Post→`/api/documents/:id/post`, Wandeln→`/api/documents/:id/convert`, Stornieren (R/r only when posted)→`/api/documents/:id/storno`; status-based button visibility

**New UI components** (all in `packages/ui/components/`):
- `inventory-balance-table.tsx` — stock per warehouse (Bestand/Reserviert/Verfügbar/Erwartet, Gesamt row)
- `customer-stats-section.tsx` — last-10 docs + annual revenue for customer addresses
- `stock-ledger-table.tsx` — running balance per warehouse from window-function SQL
- `feedback-modal.tsx` — textarea, collapsible system context JSON, submit/success/error states

**EntityMask additions** (`packages/ui/components/entity-mask.tsx`):
- `inline?: boolean` — no modal wrapper, no Cancel button, renders in document flow
- `childSection?: (record) => ReactNode` — renders below form fields when record is loaded

**childSection wiring**:
- `articles.tsx` edit dialog → `<InventoryBalanceTable articleId={record.articleId} />`
- `addresses.tsx` edit dialog → `<CustomerStatsSection addressId={record.addressId} />` (when `record.isCustomer`)

**Statistics tabs**:
- `articles.tsx` — "Umsatz" (period revenue/qty table) + "Lagerstandsjournal" (`StockLedgerTable`)
- `addresses.tsx` — "Umsatz" (period revenue/profit table) + "Offene Posten" (recent docs DataGrid)
- `statistics-module.tsx` — real KPIs from `/api/stats/dashboard`: Revenue (YoY ▲/▼), Gross Profit, Open Orders, Drafts, Inventory Value

**Phase 3 — Schema + DB** (migration `20260515021817_curious_katie_power` applied):
- New tables: `fiscal_period`, `fact_purchase_event`
- Extended: `fact_sales_event.cogs_delta`, `fact_sales_event.fiscal_period_id`, `document.is_paid/paid_at/paid_amount`
- 6 materialized views applied via raw SQL: `mv_sales_period`, `mv_sales_period_customer`, `mv_sales_period_article`, `mv_purchase_period`, `mv_purchase_period_supplier`, `mv_purchase_period_article`

**Phase 4 — AI Feedback**:
- `services/llm/` — Python FastAPI + LiteLLM microservice (GET /health, POST /complete)
- `apps/web/src/lib/feedback-snapshot.ts` — `captureFeedbackSnapshot()`
- AppBar `?` button + Shift+F1 command → FeedbackModal → calls LiteLLM → creates GitHub issue
- LLM config stored in `system_settings` (key=`llm_config`, scope=`global`)
- Admin LLM config panel at `/app/admin/llm-config` (isSystemAdmin only)

**i18n additions** (en.json + de.json):
- `settings.*` — 20 entity labels, 5 group headings
- `stats.*` — revenue, profit, cogs, openOrders, inventoryValue, stockLedger, etc.
- `feedback.*` — modal labels
- `documentDirections.*` — OUTBOUND/INBOUND/ADJUSTMENT labels

**Settings seed script**: `packages/db/src/scripts/seed-settings-fields.ts` — idempotent, inserts `tenant_fields` for all 20 settings entities. **NOT YET RUN against DB.**

**Lint**: `pnpm lint` → 0 errors, 19 pre-existing warnings.

---

## What Remains

### P0 / Functional gaps
| Item | What |
|---|---|
| `1.A1` | Seed data: `seed-document-defaults.ts` doesn't exist; `seed.ts` uses long codes (LS/LK/AB) not canonical single-char (N/A/L/R/G/b...) — no code change needed yet since these only affect new companies |
| `1.F1` | Delta correction UI: `/api/documents/:id/delta` endpoint exists, but no "Korrektur" button in DocumentEditor lines view |
| `1.G1` | Article autocomplete → pricing: `/api/articles/:id/pricing` exists, but no UI wire in the line entry form |
| `2.F2` | Run settings seed: `npx tsx packages/db/src/scripts/seed-settings-fields.ts` |
| `3.F5` | Period comparison route (`/app/statistics/period-comparison`) — full-page fiscal year comparison view |
| `4.x` | Python LiteLLM service not in docker compose — must be started manually: `cd services/llm && uvicorn main:app --port 11435` |

### Verification (manual browser)
- `7.L2` — No `console.error` during normal usage
- All DataGrid metadata fetches resolve without 404
- Statistics tabs show real data after posting a document
- FeedbackModal submit flow (requires LLM config in admin panel)

---

## Key File Map

```
packages/db/src/services/
  document-service.ts        ← DocumentService (posting, storno, convert, tree, pricing, delta)
  fiscal-period-generator.ts ← generateFiscalPeriods, resolveFiscalPeriodId
  data.ts                    ← DataService (generic CRUD, now with limit/orderBy)

apps/web/src/routes/api/
  documents/$documentId/     ← post.ts, storno.ts, convert.ts, delta.ts
  articles/$articleId/       ← pricing.ts
  stats/                     ← dashboard.ts, address/$addressId.ts, article/$articleId.ts
  feedback/submit.ts
  admin/llm-config.ts

packages/ui/components/
  inventory-balance-table.tsx ← stock per warehouse in article dialog
  customer-stats-section.tsx  ← last-10-docs + annual revenue in address dialog
  stock-ledger-table.tsx      ← running balance ledger from window function SQL
  feedback-modal.tsx          ← AI-powered bug/feedback reporting
  document-editor.tsx         ← real post/convert/storno mutations
  statistics-module.tsx       ← real KPIs from /api/stats/dashboard

apps/web/src/
  lib/feedback-snapshot.ts   ← captureFeedbackSnapshot()
  routes/_auth/app/
    documents.tsx             ← 3-level tree, group filter, document list
    addresses.tsx             ← childSection CustomerStatsSection, Umsatz/Offene-Posten tabs
    articles.tsx              ← childSection InventoryBalanceTable, Umsatz/Lagerstandsjournal tabs
    admin/llm-config.tsx      ← LLM config form for system admin

services/llm/
  main.py                    ← FastAPI LiteLLM microservice (start manually on port 11435)
  requirements.txt
```

---

## Common Pitfalls

- **`db.execute()` rows**: postgres-js returns `result` as an array directly — NOT `result.rows`
- **Schema import path**: always `@repo/db/schema`, never `@repo/db/schema/app.schema`
- **document.documentType** is the movement char (N/A/L...), not a documentType FK — there is also `document.documentTypeId` as a proper FK
- **article has no `salesPrice`** — pricing returns "0" from base article; configure via priceList
- **materialized views** are NOT in the Drizzle schema — query them with raw `db.execute(sql\`...\`)`
- **Port must be 3000** — `VITE_BASE_URL` hardcoded; if vite increments, auth breaks silently
- **LiteLLM service** must be running on port 11435 for feedback submission to work
