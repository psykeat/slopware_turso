# 04 — Frontend Redesign Checklist

## Source of Truth
- **Visual spec**: `/tmp/design2/slopware-v2/project/` (triview.jsx, forms.jsx, appbar.jsx, bars.jsx, tokens.css)
- **Architecture spec**: `.gemini/00_core_architecture.md` + `.gemini/01_project_foundation.md` + `.gemini/02_entity_introspection_and_generic_ui.md` + `.gemini/03_frontend_basedesign.md`
- **Design language**: `.gemini/design.md`

## What Is Already Done (do not touch)
- [x] `packages/ui/styles/base.css` — design tokens, dark mode, 10 accent themes, JetBrains Mono import
- [x] `packages/ui/lib/theme-provider.tsx` — AccentTheme + Mode, localStorage, ScriptOnce anti-flash
- [x] `packages/ui/platform/command-registry.tsx` — CommandProvider + global keyboard listener
- [x] `packages/ui/platform/focus-manager.tsx` — FocusProvider + focus state tracking
- [x] `packages/ui/platform/global-commands.tsx` — Alt+1/2/3/0 + Alt+I + Ctrl+K
- [x] `apps/web/src/routes/_auth/app/route.tsx` — AppBar, TenantSwitcher, AvatarMenu, SystemOverflow shell
- [x] `apps/web/src/routes/__root.tsx` — ThemeProvider + CommandProvider + FocusProvider + I18nextProvider nesting
- [x] Backend: DB schema, `/api/data/$`, `/api/metadata/$`, `/api/admin/data/$`, Drizzle services
- [x] `apps/web/src/lib/i18n.ts` — i18next init with localStorage lang persistence
- [x] `apps/web/src/locales/en.json` — full EN locale
- [x] `apps/web/src/locales/de.json` — full DE locale
- [x] `packages/ui/components/command-palette.tsx` — Ctrl+K palette with search + kbd chips
- [x] `packages/ui/components/shortcut-help.tsx` — 4-section grouped shortcut dialog
- [x] `packages/ui/components/statistics-module.tsx` — Alt+I drawer (stub KPIs)
- [x] `apps/web/src/routes/_auth/app/admin/` — route layout + tenants/users/organizations sub-routes
- [x] `apps/web/src/routes/_auth/app/settings/index.tsx` — helper table sidebar + DataGrid

---

## Phase 0 — Internationalization (i18n) ✅ COMPLETE

- [x] **0.1** `i18next` + `react-i18next` in `pnpm-workspace.yaml` catalog
- [x] **0.2** Dependencies in `apps/web/package.json` via `catalog:`
- [x] **0.3** `react-i18next` in `packages/ui/package.json` via `catalog:`
- [x] **0.4** `apps/web/src/lib/i18n.ts` — init with localStorage lang, en+de resources
- [x] **0.5** `apps/web/src/locales/en.json` — nav, modules, actions, shortcuts, status, empty, grid, tree, tenant, avatar, form, commands, stats
- [x] **0.6** `apps/web/src/locales/de.json` — German equivalents for all EN keys
- [x] **0.7** Import `"../lib/i18n"` in `__root.tsx` as side-effect
- [x] **0.8** `<I18nextProvider i18n={i18next}>` wrapping app in `RootDocument`
- [x] **0.9** AvatarMenu language toggle calls `i18n.changeLanguage()` + `localStorage.setItem("lang")`
- [x] **0.10** All UI strings use `useTranslation("ui")` + `t("key")` pattern

---

## Phase 1 — Standard Component Rewrites

### 1.1 DataGrid (`packages/ui/components/data-grid.tsx`) ✅ DONE EXCEPT 1.1.1

- [x] **1.1.2** Toolbar (36px, bg-canvas-soft, border-b): title + record count left; Filter/Refresh/Export/More icon buttons right
- [x] **1.1.3** Loading skeleton: table + thead skeleton cells + 8 tbody rows with per-cell Skeleton
- [x] **1.1.4** Empty state: icon-ring + title + subtitle + action pill with kbd badge
- [x] **1.1.5** Selected row: 2px primary left accent + color-mix primary 9% background
- [x] **1.1.6** Table layout: 9px header, 40px body rows, numeric right-aligned mono tabular-nums
- [x] **1.1.7** `useTranslation("ui")` for empty/records strings
- [x] **1.1.8** FocusManager integration: row click → `setFocus`, keyboard ↑/↓/Home/End
- [x] **1.1.1** Add `flush?: boolean` prop — default now adds `rounded-lg border border-hairline`; `flush={true}` suppresses it. Existing callers that pass `className="... border-none rounded-none"` are unaffected via `twMerge`.

### 1.2 NavigationTree (`packages/ui/components/navigation-tree.tsx`) ✅ COMPLETE

- [x] **1.2.1** `count?: number` on TreeNode; `header?: string` prop
- [x] **1.2.2** Header div (32px, bg-canvas-soft, border-b, 11px uppercase)
- [x] **1.2.3** 28px node rows with paddingLeft indent, chevron, folder icon, label, count
- [x] **1.2.4** Selected: `style={{ background: "var(--primary)", color: "var(--primary-fg)" }}`
- [x] **1.2.5** Loading skeleton: 7 rows with varying indent + label skeleton + count skeleton
- [x] **1.2.6** `useTranslation("ui")` for header fallback

### 1.3 ContextTabs (`packages/ui/components/context-tabs.tsx`) ✅ COMPLETE

- [x] **1.3.1** `count?: number` on TabDef; MoreHorizontal button right
- [x] **1.3.2** 32px tab bar, underline active indicator, inactive muted
- [x] **1.3.3** Count badge `(n)` inside tab when defined
- [x] **1.3.4** `flex-1 overflow-auto` content area
- [x] **1.3.5** More button icon-btn style

### 1.4 InspectorPanel (`packages/ui/components/inspector-panel.tsx`) ✅ COMPLETE

- [x] **1.4.1** `recordId?`, `actions?`, `sections?` props
- [x] **1.4.2** 40px header with mono recordId + actions slot
- [x] **1.4.3** Section eyebrow divider + fields grid
- [x] **1.4.4** Field row label 11px uppercase / value 13px

### 1.5 EntityMask (`packages/ui/components/entity-mask.tsx`) ✅ COMPLETE

- [x] **1.5.1** `mode?`, `onCancel?`, `onSaved?`, `embedded?` props
- [x] **1.5.2** Card layout when not embedded: max-w-2xl, title 18px, subtitle from `t("form.requiredHint")`
- [x] **1.5.3** Label 12px uppercase + required `*` in destructive color
- [x] **1.5.4** Input: h-9, border-hairline-input, focus ring color-mix primary 20%
- [x] **1.5.5** Error state: destructive border + error text 11px
- [x] **1.5.6** Help text: 11px ink-mute below input when no error
- [x] **1.5.7** Footer: Cancel (outline) + Save (primary) pills
- [x] **1.5.8** F10 → save, Esc → `onCancel?.()`
- [x] **1.5.9** `useEffect(() => setFormData({}), [recordId])` reset on switch
- [x] **1.5.10** `useMutation, useQueryClient` from `@tanstack/react-query`
- [x] **1.5.11** `useLang` via `i18next.language` for labelEn/labelDe pick

### 1.6 TriViewWorkspace (`packages/ui/components/triview-workspace.tsx`) ✅ COMPLETE

- [x] **1.6.1** primaryGrid wrapper: `h-full w-full overflow-hidden` (no p-2)
- [x] **1.6.2** No `rounded-lg border border-hairline` on ResizablePanelGroup
- [x] **1.6.3** Left panel: `bg-canvas-soft`
- [x] **1.6.4** Lower right: no extra border/bg wrapper

### 1.7 ActionBar (`packages/ui/components/action-bar.tsx`) ✅ COMPLETE

- [x] **1.7.1** Remove null-return guard — always render the 36px bar even when no crumbs/commands
- [x] **1.7.2** `subCrumb?: string` prop; appended as last breadcrumb item
- [x] **1.7.3** All-but-last crumbs in `text-ink-mute`, last in `text-ink`
- [x] **1.7.4** Filter out `scope === "global"` commands; pill style correct
- [x] **1.7.5** Command label uses `i18n.language === "de" ? cmd.label.de : cmd.label.en`

### 1.8 StatusBar (`packages/ui/components/status-bar.tsx`) ✅ COMPLETE

- [x] **1.8.1** `useFocus` for `focusState.recordId` + `focusState.entity`
- [x] **1.8.2** Left: tenantName · displayModule · recordId (mono)
- [x] **1.8.3** Right: v0.1.0 · ok dot · `t("status.online")`
- [x] **1.8.4** Module from `location.pathname`, uses `t("modules.{name}")`

### 1.9 ShortcutHelp (`packages/ui/components/shortcut-help.tsx`) ✅ COMPLETE

- [x] **1.9.1** 4 sections: Navigation, Record Operations, Workflow, Navigation Keys
- [x] **1.9.2** Static nav key rows (↑/↓, Home/End, Tab/⇧Tab, Enter)
- [x] **1.9.3** Kbd split on `+`, each token as separate `<kbd>`
- [x] **1.9.4** Section header 10px uppercase tracking-wider
- [x] **1.9.5** `t("shortcuts.*")` for section labels
- [x] **1.9.6** Renamed `"navKeys"` → `"gridNavigation"` in en.json + de.json (Option A)

### 1.10 DocumentEditor (`packages/ui/components/document-editor.tsx`) ✅ COMPLETE

- [x] **1.10.1** Props: `documentId: string`, `onClose: () => void`
- [x] **1.10.2** Full-screen overlay: `fixed inset-0 z-40 bg-canvas flex flex-col`
- [x] **1.10.3** Embedded EntityMask for document header fields inside a rounded border card
- [x] **1.10.4** Lines DataGrid filling remaining space
- [x] **1.10.5** Footer: Close (Esc) left + Save (F10) + Post (F9) right (buttons present)
- [x] **1.10.6** Esc → `onClose()`; F10 → key handler present
- [x] **1.10.7** Lines fetch uses server-side filter: `/api/data/documentLine?documentId=${documentId}`
- [x] **1.10.8** Footer Save button dispatches synthetic `F10` KeyboardEvent → EntityMask's own window listener catches and saves; `onSaved` invalidates `["data","document"]`
- [x] **1.10.9** Post button shown only when `docStatus === "draft"` (`canPost` guard); pending state adds `opacity-40 pointer-events-none`
- [x] **1.10.10** `post-document` command (F9, scope=context, group=workflow) registered via `useEffect` with `isEnabled: () => docStatus === "draft"`; handler calls `postMutation.mutate()`

### 1.11 StatisticsModule (`packages/ui/components/statistics-module.tsx`) ✅ COMPLETE

- [x] **1.11.1** `open-statistics` (Alt+I) registered in GlobalCommands
- [x] **1.11.2** Right-side Drawer implemented
- [x] **1.11.3** Entity-aware KPI cards via `focusState.entity` + `useQueryClient().getQueryData()` (no re-fetch): address → Total + New This Month; article → Total + Low Stock (<10); document → Drafts + Total Value; default → no-context message
- [x] **1.11.4** Inline `KpiCard`: label 11px uppercase + value 26px font-light tabular-nums + optional delta 11px

---

## Phase 2 — Module Route Rewrites

### 2.1 Addresses (`apps/web/src/routes/_auth/app/addresses.tsx`) ⚠️ PARTIAL

- [x] **2.1.1** `create-record` (F3) → Dialog with EntityMask mode="create"
- [x] **2.1.2** `archive-record` (F4) → PATCH `{ archived: true }` + invalidate
- [x] **2.1.4** DataGrid `title` + `emptyAction` with F3
- [x] **2.1.5** Contacts tab: fetch `addressContact`, DataGrid
- [x] **2.1.6** NavigationTree `header={t("tree.categories")}`
- [x] **2.1.8** Create dialog state `showCreate`, invalidate on save
- [ ] **2.1.3** Register `duplicate-record` (F8, `isEnabled` when `!!focusState.recordId && entity="address"`) → POST copy of selected address to `/api/data/address`
- [ ] **2.1.7** Pass `subCrumb={selectedCategoryLabel}` to ActionBar — requires wiring (see 7.B)

### 2.2 Articles (`apps/web/src/routes/_auth/app/articles.tsx`) ⚠️ PARTIAL

- [x] **2.2.1** `create-record` (F3) + `archive-record` (F4) commands
- [x] **2.2.2** Inventory Movements tab: DataGrid for `inventoryMovement` filtered by articleId
- [x] **2.2.3** DataGrid `title` + `emptyAction` with F3
- [x] **2.2.4** NavigationTree `header={t("tree.groups")}`
- [ ] **2.2.1b** Register `duplicate-record` (F8) for article entity
- [ ] **2.2.5** Pass `subCrumb={selectedGroupLabel}` to ActionBar (see 7.B); track `selectedGroupLabel` state

### 2.3 Documents (`apps/web/src/routes/_auth/app/documents.tsx`) ⚠️ PARTIAL

- [x] **2.3.1** `create-record` (F3), `open-document` (F9), `transform-record` (F7) commands
- [x] **2.3.2** Document Lines tab: DataGrid for `documentLine` filtered by documentId
- [x] **2.3.3** DocumentEditor overlay when `editorDocId` set
- [x] **2.3.4** DataGrid `title` + `emptyAction` with F3
- [x] **2.3.5** NavigationTree `header={t("tree.types")}`
- [ ] **2.3.1b** Add `queryClient` import + `queryClient.invalidateQueries({ queryKey: ["data", "document"] })` in EntityMask `onSaved` callback
- [ ] **2.3.1c** Register `duplicate-record` (F8) for document entity
- [ ] **2.3.6** Pass `subCrumb={selectedTypeLabel}` to ActionBar (see 7.B); track `selectedTypeLabel` state

---

## Phase 3 — New Routes

### 3.1 Admin Route (`apps/web/src/routes/_auth/app/admin/`) ✅ COMPLETE

- [x] **3.1.1** `beforeLoad` checks `context.user.isSystemAdmin`; redirects to `/app/addresses` if false, to `/app/admin/tenants` if true
- [x] **3.1.2** Admin layout: tab bar (Organizations | Users | Tenants) + Outlet
- [x] **3.1.3** Tab links using ContextTabs-style underline navigation
- [x] **3.1.4** Each tab: DataGrid fetching `/api/admin/data/{organization|user|tenant}` + EntityMask detail panel
- [ ] **3.1.5** ActionBar in admin layout (admin/route.tsx): add `<ActionBar crumbs={[t("nav.administration")]} />` above the tab bar; import ActionBar + useTranslation

### 3.2 Settings Route (`apps/web/src/routes/_auth/app/settings/index.tsx`) ✅ COMPLETE

- [x] **3.2.1** Left sidebar (static categories): Payment Terms, Tax Codes, Shipping Methods, Warehouses, Cost Centers
- [x] **3.2.2** Main area: DataGrid for selected category using `/api/data/{entity}`
- [x] **3.2.3** Helper table entities wired
- [x] **3.2.4** ActionBar uses module-level `crumbs` via app layout (subCrumb would be selected category — see 7.B)

---

## Phase 4 — Global Command Completions

### 4.1 GlobalCommands (`packages/ui/platform/global-commands.tsx`) ✅ COMPLETE

- [x] **4.1.1** `open-statistics` (Alt+I) → dispatches `slopware:open-statistics`
- [x] **4.1.2** `open-palette` (Ctrl+K) → dispatches `slopware:open-palette`
- [x] **4.1.3** `save-close` (F10) registered as no-op global fallback. Propagation fixed: `command-registry.tsx` checks `e.defaultPrevented` first; EntityMask calls `e.preventDefault()` + `e.stopPropagation()` on F10/Esc so global handler never fires when a form is active
- [x] **4.1.4** `group?: string` on `Command` interface; stamped on all registrations across global-commands, all 3 module routes

### 4.2 Command Palette (`packages/ui/components/command-palette.tsx`) ✅ COMPLETE

- [x] **4.2.1–4.2.5** All done: search, filter, ↑/↓ nav, Enter execute, Esc close, shortcut kbd chips

---

## Phase 5 — TenantSwitcher Wiring ✅ COMPLETE

- [x] **5.1–5.5** TenantSwitcher + StatusBar using `/api/me` for real tenant+org names

---

## Phase 6 — Typography ✅ COMPLETE

- [x] **6.1** JetBrains Mono `@import` at top of `packages/ui/styles/base.css`
- [x] **6.2** `--font-mono: 'JetBrains Mono', ui-monospace, monospace` in `@theme inline`
- [x] **6.3** `font-mono` utility resolves to JetBrains Mono in kbd elements, record IDs, StatusBar, numeric DataGrid cells

---

## Phase 7 — Gap Closure (NEW — actual work remaining)

> All items below were identified by auditing the current codebase against the spec. These are the tasks needed to fully wire up the interface.

### 7.A ActionBar Always-Render + i18n label ✅ DONE

- [x] **7.A1** `action-bar.tsx`: Removed early-return null guard — always renders 36px bar.
- [x] **7.A2** `action-bar.tsx`: Command label uses `i18n.language === "de" ? cmd.label.de : cmd.label.en`.

### 7.B SubCrumb Passthrough Architecture

Current problem: ActionBar is rendered in `app/route.tsx` layout but modules need to push `subCrumb` (selected category/group/type label) into it. There is no mechanism.

**Solution**: Create an `ActionBarContext` in `packages/ui/platform/action-bar-context.tsx`:

- [x] **7.B1** Created `packages/ui/platform/action-bar-context.tsx` — `ActionBarProvider` + `useActionBar()`.
- [x] **7.B2** `app/route.tsx`: Wrapped with `ActionBarProvider`; `AppLayoutInner` reads `subCrumb` from context → `<ActionBar>`.
- [x] **7.B3** `addresses.tsx`: `setSubCrumb(cat?.label)` on tree select; cleanup on unmount.
- [x] **7.B4** `articles.tsx`: `setSubCrumb(group?.label)` on tree select; cleanup on unmount.
- [x] **7.B5** `documents.tsx`: `setSubCrumb(docType?.label)` on tree select; cleanup on unmount.
- [x] **7.B6** `settings/index.tsx`: `setSubCrumb(tableLabel)` on category change; cleanup on unmount.

### 7.C Missing F8 Duplicate Commands ✅ DONE

- [x] **7.C1** `addresses.tsx`: `duplicate-record` (F8, entity=address) registered.
- [x] **7.C2** `articles.tsx`: `duplicate-record` (F8, entity=article) registered.
- [x] **7.C3** `documents.tsx`: `duplicate-record` (F8, entity=document) registered.

### 7.D Documents: queryClient Missing + Post Command ✅ DONE

- [x] **7.D1** `documents.tsx`: `useQueryClient` added; `onSaved` invalidates `["data","document"]` + closes dialog.
- [x] **7.D2** `documents.tsx`: `post-document` registered (no shortcut — F9 taken by open-document; stub PATCH).

### 7.E ShortcutHelp i18n Key Fix ✅ DONE

- [x] **7.E1** Renamed `"navKeys"` → `"gridNavigation"` in en.json + de.json.

### 7.F DocumentEditor: Real Save + Post Status

- [x] **7.F1** `document-editor.tsx`: Wire F10 / Save button to real `useMutation`:
  ```ts
  const saveMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await fetch(`/api/data/document/${documentId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Save failed");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["data", "document", documentId] }),
  });
  ```
  Save button onClick → `saveMutation.mutate(/* form state from EntityMask */)`.
  > Note: EntityMask currently owns its own formData state. Simplest approach: EntityMask `onSaved` callback from the embedded form already fires on its own F10 — remove duplicate F10 from DocumentEditor or coordinate via a ref.
- [x] **7.F2** `document-editor.tsx`: Post button `disabled` + `opacity-40 pointer-events-none` when not draft.

### 7.G StatisticsModule: Real KPIs

- [x] **7.G1** `statistics-module.tsx`: Entity-aware KPIs — address/article/document sets via cached query data.
  ```tsx
  // When focusState.entity === "address": show total address count + new this month
  // When focusState.entity === "article": show total articles + low stock (qty < 10 stub)
  // When focusState.entity === "document": show draft count + total value sum
  // Default: show generic "no context" message
  ```
  Fetch data from existing query keys (`["data", "address"]` etc.) via `useQueryClient().getQueryData()` to avoid re-fetching.
- [x] **7.G2** `KpiCard` component inline — label 11px uppercase + value 26px font-light tabular-nums + delta 11px.

### 7.H Admin: ActionBar Crumb ✅ DONE

- [x] **7.H1** `admin/route.tsx`: `<ActionBar crumbs={[t("nav.administration")]} />` added above tab bar.

### 7.I API Filtering (Backend)

Currently all relation fetches (contacts per address, lines per document, movements per article) fetch ALL records and filter client-side. This works for small datasets but will break at scale.

- [x] **7.I1** `data.ts` service + `api/data/$.ts`: FK query param filtering via Drizzle `eq()` WHERE clause.
- [x] **7.I2** `addresses.tsx`: contacts fetch uses `?addressId=${focusState.recordId}`.
- [x] **7.I3** `articles.tsx`: movements fetch uses `?articleId=${focusState.recordId}`.
- [x] **7.I4** `documents.tsx`: lines fetch uses `?documentId=${focusState.recordId}`.

### 7.J Command Registry: group field ✅ DONE

- [x] **7.J1** `command-registry.tsx`: `group?: string` added to `Command` interface.
- [x] **7.J2** `group` stamped on all command registrations across global-commands, shortcut-help, all 3 module routes.

### 7.K GlobalCommands: save-close F10 Fallback ✅ DONE

- [x] **7.K1** `global-commands.tsx`: `save-close` (F10, scope=global, no-op handler) registered.

### 7.L Lint + Type Check

- [x] **7.L1** `pnpm lint` — 0 errors, 19 warnings (all pre-existing). Pre-existing TS2741 in metadata/$.ts and TS2307 in set-admin.ts also fixed as a bonus.
- [ ] **7.L2** Verify no `console.error` in browser (requires manual test).
- [x] **7.L3** `shortcuts.gridNavigation` key renamed — no missing-key warnings.

---

## Phase 8 — Items from 04.1_implementation_list.md Not Yet Covered

> These were in the design prototype spec but not addressed in the redesign checklist. All are real functional gaps.

### 8.A Module Details Tabs: InspectorPanel vs EntityMask ✅ DONE

- [x] **8.A1** `addresses.tsx`: Details tab → InspectorPanel (Identification / Postal Address / Commercial).
- [x] **8.A2** `articles.tsx`: Details tab → InspectorPanel (Identification / Inventory).
- [x] **8.A3** `documents.tsx`: Header Details tab → InspectorPanel (Document / Parties / Totals).

### 8.B Address Module: Missing Tabs ✅ DONE

- [x] **8.B1** `addresses.tsx`: "Delivery Addresses" tab added (DataGrid, entityName=deliveryAddress, 5 cols).
- [x] **8.B2** `addresses.tsx`: "Related Documents" tab added (DataGrid, entityName=document, toolbar=false, 5 cols).

### 8.C DataGrid Column Renderers (cell-level formatting)

All current DataGrids use raw metadata-derived columns with no custom renderers. Spec requires specific formatting for mono IDs, money, tabular nums, and status dots.

- [x] **8.C1** Created `packages/ui/lib/formatters.ts` — `formatMoney`, `formatDate`, `StatusDot`.

- [x] **8.C2** `addresses.tsx`: Explicit columns — addressNo (mono), companyName, city, countryCode, phone (mono), addressType.
- [x] **8.C3** `articles.tsx`: Explicit columns — articleNo (mono), name, baseUnit, salesPrice (money), stockQty (tnum), defaultWarehouseId (mono).
- [x] **8.C4** `documents.tsx`: Explicit columns — documentNo (mono), documentDate (formatDate), customerId, totalGross (money), status (StatusDot).
- [x] **8.C5** `StatusDot` component in `packages/ui/lib/formatters.ts`.

### 8.D Shared Primitives: useDismiss Hook ✅ DONE

- [x] **8.D1** Created `packages/ui/lib/use-dismiss.ts`.
- [x] **8.D2** `app/route.tsx`: replaced inline definition with import from `@repo/ui/lib/use-dismiss`.
- [x] **8.D3** Package exports resolve via `"./*": "./*.ts"` glob — no index change needed.

### 8.E Document Lines DataGrid: Proper Columns

Spec: Lines DataGrid cols = Pos (zero-padded tnum), Article (mono), Description, Qty (tnum + unit), Unit Price (tnum), Disc (%), Line Total (tnum).

- [x] **8.E1** `documents.tsx` Lines tab: explicit columns (lineNo/Pos, articleId mono, description, qty/unit, netPrice money, discountPct, lineTotalNet money).
- [x] **8.E2** `document-editor.tsx` lines grid: same columns.

### 8.G F2 Edit Command ✅ DONE

- [x] **8.G1** `addresses.tsx`: `edit-record` (F2) + `showEdit` state + edit Dialog with EntityMask mode="edit".
- [x] **8.G2** `articles.tsx`: same pattern.
- [x] **8.G3** `documents.tsx`: same pattern (F2=quick edit dialog, F9=full DocumentEditor).
- [x] **8.G4** `shortcut-help.tsx`: `"edit-record"` added to recordOps group ids.

### 8.H Non-Negotiables Audit (from 04.1 §8)

Verify each hard rule from the spec is enforced in current code:

- [x] **8.H1** StatusDot uses `text-ink-mute` — no colored badge text. ✓
- [x] **8.H2** All numeric cells use `tabular-nums`; DataGrid `isNumeric` path also applies it. ✓
- [x] **8.H3** `font-mono` only on IDs/codes — non-ID fields verified clean. ✓
- [x] **8.H4** No `bg-gradient-*` on work surface components. ✓
- [x] **8.H5** `command-registry.tsx`: `isInput` guard is now an unconditional early return (except Escape), applied before command lookup — inputs swallow all shortcuts. Also: `e.defaultPrevented` checked first so EntityMask F10/Esc never double-fires with global handler.

### 8.F DocumentEditor Lines: Add New Line

Spec: DocumentEditor lines DataGrid needs ability to add lines (not just view them). Minimum viable: Add Line button in DocumentEditor footer that POSTs to `/api/data/documentLine` with `{ documentId, position: lines.length + 1 }` and invalidates lines query.

- [x] **8.F1** `document-editor.tsx`: "Add Line" button in footer — POST stub + invalidate documentLine query.

---

## Updated Recommended Execution Order

**Quick wins (< 10 min each):**
1. **7.E1** — ShortcutHelp i18n key fix
2. **7.A1** — ActionBar remove null guard
3. **7.A2** — ActionBar command label i18n
4. **7.H1** — Admin ActionBar crumb
5. **7.K1** — save-close global F10 registration
6. **8.C1** — `formatters.ts` + `StatusDot` (foundation for 8.C2-8.E)

**Medium (15–45 min):**
7. **7.B1–7.B6** — SubCrumb context architecture
8. **7.C1–7.C3** — F8 duplicate in all 3 modules
9. **7.D1–7.D2** — Documents queryClient + post-document
10. **7.J1–7.J2** — Command group field
11. **8.A1–8.A3** — Details tabs → InspectorPanel
12. **8.B1–8.B2** — Address: Delivery + Related Documents tabs
13. **8.C2–8.C4** — DataGrid explicit column props (uses formatters from 8.C1)
14. **8.E1–8.E2** — Document Lines columns
15. **8.D1–8.D3** — useDismiss shared hook

**Medium continued:**
16. **8.G1–8.G4** — F2 Edit command + dialog in all 3 modules
17. **8.H1–8.H5** — Non-negotiables audit pass

**Larger (30–60 min):**
18. **7.F1–7.F2** — DocumentEditor real save + post status
19. **7.G1–7.G2** — StatisticsModule real KPIs
20. **7.I1–7.I4** — API FK filtering (backend + frontend)
21. **8.F1** — DocumentEditor add line
22. **7.L1–7.L3** — Lint + verification

---

## Verification Checklist

### Shell
- [ ] AppBar: 48px, brand mark, tenant pill, 3 module tabs with ⌥1/2/3 kbd badges, ⋯ overflow, search bar with ⌘K badge, help icon, avatar initials
- [ ] Active module tab: primary fill background, white text, visible kbd badge
- [ ] ActionBar: **always** visible 36px bar — never collapses/hides
- [ ] ActionBar subCrumb: reflects selected tree node in Addresses / Articles / Documents / Settings
- [ ] ActionBar command pills: show correct DE/EN label based on active language
- [ ] StatusBar: 32px, tenant · module · record ID (mono) left; v0.1.0 · online dot · "System Online" right

### Components
- [ ] DataGrid: toolbar with title + record count + 4 icon buttons; 40px rows; selected row primary tint + 2px left accent
- [ ] DataGrid empty: icon ring + subtitle + action pill with F3 kbd badge
- [ ] DataGrid loading: table-shaped skeletons matching column widths (not generic blocks)
- [ ] DataGrid columns: explicit renderers — mono for IDs/codes, `tabular-nums` for dates/money/qty, StatusDot for status
- [ ] NavigationTree: 32px header + 28px nodes + count badges + indent-aware skeleton
- [ ] NavigationTree selected: solid primary bg, white text (including count)
- [ ] ContextTabs: 32px tab bar, primary underline on active, count badge when `count` defined
- [ ] InspectorPanel: 40px header with title + mono recordId + actions slot; 2-col field grid with section eyebrows
- [ ] EntityMask: 2-col grid, required `*` marker, focus ring, error state (destructive), F10/Esc, footer pills
- [ ] ShortcutHelp: 4 grouped sections (Navigation / Record Ops / Workflow / Grid Nav), multi-token kbd chips, no missing-key console warns
- [ ] DocumentEditor: fixed full-screen overlay, header EntityMask + lines DataGrid + footer (Close / Add Line / Save / Post)
- [ ] DocumentEditor: Post button disabled when `doc.status !== "draft"`
- [ ] StatisticsModule: right-side drawer, entity-aware KPI cards (not hardcoded stub)
- [ ] All 10 accent themes apply via `data-[theme]` on `<html>` — verify each one in AvatarMenu
- [ ] Dark mode: canvas inverts, AppBar + NavigationTree stay dark-surfaced

### Module: Addresses
- [ ] NavigationTree shows address categories with header "Categories"
- [ ] DataGrid columns: No. (mono), Company, City, Country, Phone (mono), Segment
- [ ] Details tab: InspectorPanel with sections Identification / Postal Address / Commercial (NOT EntityMask edit form)
- [ ] Contacts tab: DataGrid of addressContact records filtered by selected addressId
- [ ] Delivery Addresses tab: DataGrid or placeholder
- [ ] Related Documents tab: DataGrid toolbar=false or placeholder
- [ ] Create dialog (F3): EntityMask mode="create"
- [ ] Edit dialog (F2): EntityMask mode="edit" with recordId pre-filled

### Module: Articles
- [ ] NavigationTree shows article groups with header "Groups"
- [ ] DataGrid columns: No. (mono), Name, Unit, Price (money + tnum), Stock (tnum), Location (mono)
- [ ] Details tab: InspectorPanel with sections Identification / Pricing & Stock
- [ ] Inventory Movements tab: DataGrid filtered by selected articleId
- [ ] Create dialog (F3) + Edit dialog (F2)

### Module: Documents
- [ ] Document Triview Navigation: Implemented according to the [Beleggruppen-Redesign PRD](_toimplement/document_group_redesign.md)
- [ ] DataGrid columns: No. (mono), Date (tnum), Customer, Lines (tnum), Total (money), Status (dot only — no colored badge)
- [ ] Lines tab: DataGrid toolbar=false with columns: Pos (zero-padded mono), Article (mono), Description, Qty (tnum), Unit Price (tnum), Disc (%), Line Total (tnum)
- [ ] Header Details tab: InspectorPanel with sections Document / Parties / Totals
- [ ] F9 opens DocumentEditor overlay
- [ ] DocumentEditor: Add Line button in footer works

### Module: Admin
- [ ] ActionBar shows "Administration" breadcrumb
- [ ] Tab bar: Tenants / Users / Organizations
- [ ] Each tab loads from `/api/admin/data/{entity}`
- [ ] Only visible to `isSystemAdmin`

### Module: Settings
- [ ] Left sidebar: Payment Terms / Tax Codes / Shipping Methods / Warehouses / Cost Centers
- [ ] Main area: DataGrid for selected helper table from `/api/data/{entity}`

### Keyboard
- [ ] `Alt+1/2/3/0` → correct module navigation
- [ ] `Alt+I` → StatisticsModule drawer
- [ ] `Ctrl+K` → Command palette
- [ ] `?` → ShortcutHelp dialog
- [ ] `F2` (record selected) → edit dialog opens with record data
- [ ] `F3` → create dialog opens
- [ ] `F4` (record selected) → archive triggers + grid refreshes
- [ ] `F8` (record selected) → duplicate triggers + grid refreshes
- [ ] `F9` (in Documents, record selected) → DocumentEditor overlay
- [ ] `F10` (in EntityMask) → saves form; does NOT fire when cursor in input field
- [ ] `Esc` → closes topmost overlay; does NOT bubble to close multiple layers
- [ ] `↑/↓/Home/End` in DataGrid → row navigation when grid has focus
- [ ] Shortcuts do NOT fire when focus is inside `<input>`, `<textarea>`, or `contenteditable`

### Data Wiring
- [ ] Addresses contacts filtered by addressId (not all contacts)
- [ ] Articles inventory movements filtered by articleId
- [ ] Documents lines filtered by documentId
- [ ] Documents DocumentEditor header fetch by documentId
- [ ] Admin: real data from `/api/admin/data/` endpoints
- [ ] Settings: real data from `/api/data/` helper table endpoints

### i18n
- [ ] EN → DE toggle: all nav labels, module titles, action button labels, section headings switch
- [ ] Metadata field labels use `labelDe` when DE active
- [ ] Language persists across reload (localStorage)
- [ ] No missing-key `i18next` warnings in console

### Non-Negotiables (04.1 §8)
- [ ] One accent color only — no secondary accent on interactive elements
- [ ] No pure black — all text uses `--ink`, `--ink-secondary`, or `--ink-mute`
- [ ] No colored status badges — status conveyed by dot color + ink-mute label text only
- [ ] No gradients on work surface (AppBar brand mark excepted — it's chrome)
- [ ] All row heights ≤ 40px (forms excepted)
- [ ] All IDs, dates, money, quantities use `tabular-nums` / `font-mono` as appropriate
- [ ] No hardcoded hex/rgb color strings in component files — all via CSS tokens or `color-mix()`

### Quality
- [ ] `pnpm lint` zero errors
- [ ] No `console.error` in browser during normal usage
- [ ] No i18n missing-key warnings in console
- [ ] All DataGrid metadata fetches resolve without 404 (entity names match API routes)
