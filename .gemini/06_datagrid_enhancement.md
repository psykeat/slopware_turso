# 06 — DataGrid Enhancement

## Goal

Replace the hand-rolled `DataGrid` with a `@tanstack/react-table` + `@tanstack/react-virtual` implementation that supports server-side pagination, server-side sorting, column visibility per user (localStorage), scoped keyboard navigation, and double-click/Enter row opening — while remaining backward-compatible with all existing call sites.

## Why

The current DataGrid fetches entire entity tables into memory. At production volume (10k–100k rows per tenant) this degrades the browser. Virtualization alone does not solve the memory problem — only server-side pagination does. The two must come together.

Keyboard navigation currently uses `window.addEventListener`, which races with the global `CommandRegistry`. Arrow keys must be scoped to the focused scroll container.

---

## Dependency Changes

### 6.A — Catalog + Package

- [ ] **6.A1** `pnpm-workspace.yaml`: add under `catalog:`:
  ```yaml
  "@tanstack/react-table": ^8.21.0
  "@tanstack/react-virtual": ^3.13.0
  ```
- [ ] **6.A2** `packages/ui/package.json`: add to `"dependencies"`:
  ```json
  "@tanstack/react-table": "catalog:",
  "@tanstack/react-virtual": "catalog:"
  ```
- [ ] **6.A3** Run `pnpm install` from repo root — verify no peer warnings

---

## Backend Changes

### 6.B — DataService: offset + count

**File:** `packages/db/src/services/data.ts`

- [ ] **6.B1** Add `count as drizzleCount` to drizzle-orm imports
- [ ] **6.B2** Extend `list()` options type:
  ```typescript
  options: { limit?: number; offset?: number; orderBy?: string; count?: boolean } = {}
  ```
- [ ] **6.B3** In `applyOptions`, add `.offset()` after `.limit()`:
  ```typescript
  if (options.offset) query.offset(options.offset);
  ```
- [ ] **6.B4** `isSystemAdmin` branch: when `count === true`, run parallel count query with same WHERE, return `{ data, total }`:
  ```typescript
  const countQ = db.select({ total: drizzleCount() }).from(table);
  // add same .where(conditions) as data query
  const [data, [{ total }]] = await Promise.all([dataQ, countQ]);
  return options.count ? { data, total: Number(total) } : data;
  ```
- [ ] **6.B5** No-tenantId branch: same pattern
- [ ] **6.B6** Tenanted branch: same pattern — `tenantCondition` + `filterConditions` applied identically to count query
- [ ] **6.B7** When `count === false/undefined`: all three branches return raw array exactly as before (backward-compatible)

### 6.C — API Route: paginated mode

**File:** `apps/web/src/routes/api/data/$.ts`

- [ ] **6.C1** Add `"paginated"` and `"page"` to the `reserved` set (currently line ~42)
- [ ] **6.C2** After existing `limit`/`orderBy` extraction, add:
  ```typescript
  const paginated = url.searchParams.get("paginated") === "true";
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const offset = paginated ? (page - 1) * (limit ?? 50) : undefined;
  ```
- [ ] **6.C3** Replace the single `service.list()` call with a branch:
  ```typescript
  if (paginated) {
    const result = await service.list(entityName, filters, {
      limit: limit ?? 50, offset, orderBy, count: true,
    }) as { data: any[]; total: number };
    return new Response(JSON.stringify(result), {
      headers: { "content-type": "application/json" },
    });
  }
  // else: existing raw array return unchanged
  const data = await service.list(entityName, filters, { limit, orderBy });
  return new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });
  ```
- [ ] **6.C4** Non-paginated callers (sub-grids, relation tabs) verified still return raw arrays

**File:** `apps/web/src/routes/api/admin/data/$.ts`

- [ ] **6.C5** Import `DataService` from `@repo/db/services/data` at top of file
- [ ] **6.C6** Extract `paginated` / `page` / `limit` from `url.searchParams`
- [ ] **6.C7** When `?paginated=true`: instantiate `DataService` with `isSystemAdmin: true`, call `.list(..., { count: true })`, return `{ data, total }` JSON
- [ ] **6.C8** Non-paginated: existing `db.select().from(table)` path unchanged

---

## `useGridState` Hook

**File:** `packages/ui/hooks/use-grid-state.ts` (new)

- [ ] **6.D1** Export `GridSort` interface: `{ key: string; dir: "asc" | "desc" }`
- [ ] **6.D2** Export `useGridState(options?: { defaultPageSize?: number })` returning:
  ```typescript
  {
    page: number;
    pageSize: number;
    sort: GridSort | null;
    setPage: (p: number) => void;
    setPageSize: (s: number) => void;  // resets page to 1
    setSort: (s: GridSort | null) => void;  // resets page to 1
    queryParams: { page: number; limit: number; orderBy: string | undefined };
  }
  ```
- [ ] **6.D3** `queryParams.orderBy` format: `"columnKey:asc"` or `"columnKey:desc"` — matches existing `DataService.list()` `orderBy` format
- [ ] **6.D4** `defaultPageSize` defaults to `50` when not provided

---

## DataGrid Rewrite

**File:** `packages/ui/components/data-grid.tsx` — full rewrite, same file path

### 6.E — Extended interfaces (additive, no breaking changes)

- [ ] **6.E1** Add to `ColumnDef<T>`: `sortable?: boolean`
- [ ] **6.E2** Add to `DataGridProps<T>`:
  ```typescript
  // Pagination — only active when totalCount is provided
  totalCount?: number;
  page?: number;           // 1-based, default 1
  pageSize?: number;       // default 50
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  // Sorting — server-side when onSortChange provided, client-side fallback otherwise
  sort?: { key: string; dir: "asc" | "desc" } | null;
  onSortChange?: (sort: { key: string; dir: "asc" | "desc" } | null) => void;
  // Row opening — double-click + Enter
  onRowOpen?: (row: T) => void;
  ```
- [ ] **6.E3** All existing props (`entityName`, `data`, `columns`, `keyExtractor`, `panelId`, `isLoading`, `title`, `emptyTitle`, `emptySubtitle`, `emptyAction`, `toolbar`, `onRowClick`, `flush`, `className`) preserved unchanged

### 6.F — TanStack Table integration (internal)

- [ ] **6.F1** Import from `@tanstack/react-table`:
  ```typescript
  import {
    useReactTable, getCoreRowModel, getSortingRowModel,
    type ColumnDef as TsColumnDef, type SortingState, type VisibilityState,
  } from "@tanstack/react-table";
  ```
- [ ] **6.F2** Translate `ColumnDef<T>[]` → `TsColumnDef<T>[]` inside the component using `useMemo`. Cell renderer:
  - Call `col.render(row.original)` when defined
  - Else: resolve i18n objects `{ en, de }` using `i18n.language`
  - Else: return raw value
- [ ] **6.F3** `useReactTable` config:
  ```typescript
  {
    data,
    columns: tanstackColumns,
    state: { sorting: tsSorting, columnVisibility },
    onSortingChange: setTsSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortingRowModel: getSortingRowModel(),
    manualSorting: true,
    manualPagination: true,
    rowCount: totalCount,
  }
  ```
- [ ] **6.F4** Controlled sort: derive `tsSorting: SortingState` from `sort` prop; when `setTsSorting` fires, translate back to `onSortChange?.(...)` callback
- [ ] **6.F5** Client-side sort fallback: when `onSortChange` is not provided, remove `manualSorting: true` and let TanStack Table sort the data array in memory (sub-grids benefit from this)

### 6.G — Column visibility (localStorage)

- [ ] **6.G1** Storage key: `` `datagrid-cols-${entityName}` ``
- [ ] **6.G2** Initialize `columnVisibility` state from `localStorage` in `useState` initializer (try/catch for SSR safety)
- [ ] **6.G3** `useEffect` persists `columnVisibility` to `localStorage` on every change
- [ ] **6.G4** Toolbar (when `toolbar === true`) gets a "Columns" icon button (`ColumnsIcon` from lucide-react, size 14) rightmost before existing buttons
- [ ] **6.G5** Click toggles `showColPicker` state → renders absolute popover:
  - `position: absolute; top: 100%; right: 0; z-index: 50`
  - `bg-canvas border border-hairline rounded-[var(--radius-sm)] shadow-sm p-1 min-w-[160px]`
  - One row per column: `<label>` with checkbox + column `header` text (12px, text-ink)
  - `onChange` calls `table.getColumn(col.key)?.toggleVisibility()`
- [ ] **6.G6** Click outside closes popover (add `onMouseDown` on overlay or use `useDismiss` from `@repo/ui/lib/use-dismiss`)

### 6.H — Row virtualization

- [ ] **6.H1** Import: `import { useVirtualizer } from "@tanstack/react-virtual";`
- [ ] **6.H2** `scrollRef = useRef<HTMLDivElement>(null)` on the scroll container div
- [ ] **6.H3** Virtualizer config:
  ```typescript
  const virtualizer = useVirtualizer({
    count: table.getRowModel().rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 40,
    overscan: 10,
  });
  ```
- [ ] **6.H4** `<tbody>` rendered with `style={{ position: "relative", height: virtualizer.getTotalSize() }}`
- [ ] **6.H5** Only `virtualizer.getVirtualItems()` rows rendered; each `<tr>` uses:
  ```tsx
  style={{
    position: "absolute", top: 0, width: "100%",
    transform: `translateY(${vItem.start}px)`,
    height: 40,
  }}
  ```
- [ ] **6.H6** On ArrowUp/Down: `virtualizer.scrollToIndex(newIndex, { behavior: "auto" })` called after `setSelectedIndex` so viewport follows keyboard cursor

### 6.I — Keyboard navigation (scoped)

- [ ] **6.I1** Remove the `window.addEventListener("keydown", handleKeyDown)` block entirely
- [ ] **6.I2** Scroll container div: `tabIndex={0}` + `className="... outline-none"` + `onKeyDown={handleKeyDown}`
- [ ] **6.I3** Row `onClick`: call `scrollRef.current?.focus()` before `setSelectedIndex` — this scopes keyboard to the clicked grid (multi-grid panels like TriViewWorkspace work correctly because only one container gets focus)
- [ ] **6.I4** `handleKeyDown` is a React `KeyboardEvent<HTMLDivElement>` handler:
  ```typescript
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIndex(p => Math.min(p+1, data.length-1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIndex(p => Math.max(p-1, 0)); }
    else if (e.key === "Home") { e.preventDefault(); setSelectedIndex(0); }
    else if (e.key === "End") { e.preventDefault(); setSelectedIndex(data.length-1); }
    else if (e.key === "Enter" && data[selectedIndex]) { onRowOpen?.(data[selectedIndex]); }
  };
  ```
- [ ] **6.I5** `focusState.area/panel` gating is NOT needed anymore (container focus handles isolation naturally). Keep only the FocusManager `setFocus()` call on row click for the inspector/command system.

### 6.J — onRowOpen + double-click

- [ ] **6.J1** `<tr onDoubleClick={() => onRowOpen?.(row.original)} />`
- [ ] **6.J2** Enter key handler in `6.I4` calls `onRowOpen?.(data[selectedIndex])` — uses `selectedIndex` not TanStack row model index (both are the same for non-grouped data)
- [ ] **6.J3** `onRowOpen` is optional — if not provided, double-click and Enter are no-ops

### 6.K — Sort column headers

- [ ] **6.K1** Sortable `<th>` (where `col.sortable === true`) adds `cursor-pointer select-none` classes
- [ ] **6.K2** Sort indicator: `ChevronUpIcon` (size 11) from lucide-react, inline after header text
  - Unsorted: `opacity-20`
  - Asc: `opacity-100 rotate-0`
  - Desc: `opacity-100 rotate-180`
  - Transition: `transition-[opacity,transform] duration-100`
- [ ] **6.K3** Click handler cycles: `null → { key, dir: "asc" } → { key, dir: "desc" } → null`
- [ ] **6.K4** When `onSortChange` not provided: updates local TanStack `sorting` state (client-side sort within loaded rows)

### 6.L — Pagination bar

- [ ] **6.L1** Only rendered when `totalCount !== undefined`
- [ ] **6.L2** Layout: `h-8 shrink-0 flex items-center px-3 gap-2 border-t border-hairline bg-canvas-soft text-[12px] text-ink-mute`
- [ ] **6.L3** Left: record range string `"X–Y of Z records"` using `t("grid.records")` for the noun
- [ ] **6.L4** Center: pagination buttons
  - First `«`, Prev `‹`, up to 5 page numbers (window around current), Next `›`, Last `»`
  - Button style: `h-6 min-w-[24px] px-1 rounded-[3px] border border-hairline bg-canvas text-[11px] hover:bg-canvas-soft`
  - Active page: `bg-primary text-primary-fg border-primary` (use `style={{ background: "var(--primary)", color: "var(--primary-fg)" }}`)
  - Disabled (first/last at boundary): `opacity-40 pointer-events-none`
- [ ] **6.L5** Right: `<select>` for items per page: options 25 / 50 / 100
  - Style: `h-6 px-1 border border-hairline rounded-[3px] bg-canvas text-[12px]`
  - `onChange` calls `onPageSizeChange?.(Number(e.target.value))`
- [ ] **6.L6** `totalPages = Math.ceil(totalCount / pageSize)` — derived, not prop

### 6.M — Skeleton loading (unchanged shape, adapted for virtualization)

- [ ] **6.M1** Loading skeleton path uses column count from resolved `columns` state (same as before)
- [ ] **6.M2** Skeleton rows: 8 rows at `h-10` (40px), matching virtual row height
- [ ] **6.M3** When `totalCount` is provided (pagination mode), show pagination bar skeleton with `Skeleton` placeholders

---

## Route File Adoption

### 6.N — Addresses module

**File:** `apps/web/src/routes/_auth/app/addresses.tsx`

- [ ] **6.N1** Import `useGridState` from `@repo/ui/hooks/use-grid-state`
- [ ] **6.N2** Call `const gridState = useGridState({ defaultPageSize: 50 })` inside `AddressesModule`
- [ ] **6.N3** Update `useQuery` for addresses:
  ```typescript
  queryKey: ["data", "address", selectedCategoryId, gridState.queryParams],
  queryFn: async () => {
    const p = new URLSearchParams({ paginated: "true", page: String(gridState.queryParams.page), limit: String(gridState.queryParams.limit) });
    if (gridState.queryParams.orderBy) p.set("orderBy", gridState.queryParams.orderBy);
    if (selectedCategoryId) p.set("addressCategoryId", selectedCategoryId);
    const res = await fetch(`/api/data/address?${p}`);
    return res.json() as Promise<{ data: any[]; total: number }>;
  },
  ```
- [ ] **6.N4** Pass to primary DataGrid: `data={addressData?.data ?? []}`, `totalCount={addressData?.total}`, `page`, `pageSize`, `sort`, `onPageChange`, `onPageSizeChange`, `onSortChange`, `onRowOpen`
- [ ] **6.N5** `onRowOpen` opens the F2 edit dialog: `(row) => setShowEdit(true)` (selected record already set by row click)
- [ ] **6.N6** Mark sortable columns: `addressNo`, `companyName`, `city`, `addressType`
- [ ] **6.N7** Tree selection (`onSelectCategory`) calls `gridState.setPage(1)` to reset pagination on filter change
- [ ] **6.N8** Sub-grids (contacts, delivery addresses, related docs, open items) — no changes

### 6.O — Articles module

**File:** `apps/web/src/routes/_auth/app/articles.tsx`

- [ ] **6.O1–6.O6** Same pattern as 6.N: `useGridState`, paginated query, DataGrid props, `onRowOpen`, sortable columns (`articleNo`, `name`, `salesPrice`, `stockQty`), tree reset

### 6.P — Documents module

**File:** `apps/web/src/routes/_auth/app/documents.tsx`

- [ ] **6.P1–6.P6** Same pattern: `useGridState`, paginated query, DataGrid props, `onRowOpen` opens `DocumentEditor` overlay (`setEditorDocId(focusState.recordId)`), sortable columns (`documentNo`, `documentDate`, `totalGross`, `status`), group selection resets page

---

## i18n

**Files:** `apps/web/src/locales/en.json` and `de.json`

- [ ] **6.Q1** Under `"grid"` key, add:
  ```json
  "columns": "Columns",
  "of": "of",
  "perPage": "per page"
  ```
  German: `"Spalten"`, `"von"`, `"pro Seite"`

---

## Verification Checklist

### Dependencies
- [ ] `pnpm install` completes — no unresolved peer deps
- [ ] `pnpm lint` — zero errors

### Pagination (primary grids)
- [ ] Addresses module: pagination bar visible at bottom of primary grid
- [ ] Page 1 loads 50 rows; page 2 loads next 50 (different records)
- [ ] Changing page size to 25 reloads with 25 rows
- [ ] Selecting a different address category resets to page 1
- [ ] `?paginated=true` API response has shape `{ data: [...], total: N }`
- [ ] Non-paginated calls (contacts tab, lines tab) still return raw arrays

### Sorting
- [ ] Click sortable column header → rows re-sort ascending; chevron points up
- [ ] Click again → descending; click again → unsorted
- [ ] Sort + page: changing sort resets to page 1
- [ ] Sort state is passed as `?orderBy=col:dir` to API

### Column visibility
- [ ] "Columns" button appears in toolbar when `toolbar={true}`
- [ ] Toggle a column → it disappears from the table immediately
- [ ] Reload page → column preference is restored from `localStorage`
- [ ] Different entityNames have independent preferences

### Virtualization
- [ ] 10k addresses fetched server-side as 50-row page — DevTools heap: ~50 row objects, not 10k
- [ ] Scroll through 50 rows smoothly — DOM inspector shows ~20 `<tr>` elements, not 50
- [ ] No blank gaps or layout shift while scrolling

### Keyboard navigation
- [ ] Click a row to focus grid; ArrowDown/Up moves selection
- [ ] `virtualizer.scrollToIndex` called — selection stays visible during keyboard nav
- [ ] Home/End jump to first/last row in current page
- [ ] Enter opens `onRowOpen` callback (edit dialog in modules)
- [ ] Double-click row → `onRowOpen` fires
- [ ] Arrow keys do NOT fire when focus is in a different panel (contacts sub-grid, search input, etc.)
- [ ] `window.addEventListener` block is gone — no racing with CommandRegistry

### Design constraints
- [ ] Row height exactly 40px; header exactly 36px
- [ ] Selected row: `2px solid var(--primary-soft)` left border + `color-mix(in oklab, var(--primary) 9%, transparent)` background
- [ ] No hardcoded hex colors anywhere in the new DataGrid
- [ ] Pagination bar: `bg-canvas-soft`, `border-hairline`, 32px height
- [ ] Sort chevron uses `opacity` + CSS transform — no colored icon variants

### Backward compatibility
- [ ] `addresses.tsx` sub-grids (contacts, delivery, docs, open items) — no pagination bar, no error
- [ ] `documents.tsx` DocumentEditor lines grid — no pagination bar, no error
- [ ] `admin/users.tsx`, `admin/tenants.tsx` — DataGrid with no new props — renders as before
- [ ] `settings/index.tsx` — DataGrid with no new props — renders as before
- [ ] All `toolbar={false}` grids — no Columns button, no toolbar rendered
