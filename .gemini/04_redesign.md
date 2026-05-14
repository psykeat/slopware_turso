# 04 — Frontend Redesign Checklist

## Source of Truth
- **Visual spec**: `/tmp/design2/slopware-v2/project/` (triview.jsx, forms.jsx, appbar.jsx, bars.jsx, tokens.css)
- **Architecture spec**: `.gemini/00_core_architecture.md` + `.gemini/01_project_foundation.md` + `.gemini/02_entity_introspection_and_generic_ui.md` + `.gemini/03_frontend_basedesign.md`
- **Design language**: `.gemini/design.md`

## What Is Already Done (do not touch)
- [x] `packages/ui/styles/base.css` — design tokens, dark mode, 10 accent themes
- [x] `packages/ui/lib/theme-provider.tsx` — AccentTheme + Mode, localStorage, ScriptOnce anti-flash
- [x] `packages/ui/platform/command-registry.tsx` — CommandProvider + global keyboard listener
- [x] `packages/ui/platform/focus-manager.tsx` — FocusProvider + focus state tracking
- [x] `packages/ui/platform/global-commands.tsx` — Alt+1/2/3/0 navigation commands
- [x] `apps/web/src/routes/_auth/app/route.tsx` — AppBar, TenantSwitcher, AvatarMenu, SystemOverflow shell
- [x] `apps/web/src/routes/__root.tsx` — ThemeProvider + CommandProvider + FocusProvider nesting
- [x] Backend: DB schema, `/api/data/$`, `/api/metadata/$`, `/api/admin/data/$`, Drizzle services

---

## Phase 0 — Internationalization (i18n)

> Use `react-i18next` + `i18next`. The UI package consumes translations via `useTranslation()`; the web app owns initialization and locale files.

- [ ] **0.1** Add to `pnpm-workspace.yaml` catalog: `i18next: ^24.0.0`, `react-i18next: ^15.0.0`
- [ ] **0.2** Add `i18next` and `react-i18next` to `apps/web/package.json` dependencies via `catalog:`
- [ ] **0.3** Add `react-i18next` to `packages/ui/package.json` dependencies via `catalog:` (components call `useTranslation` but don't own init)
- [ ] **0.4** Create `apps/web/src/lib/i18n.ts`:
  ```ts
  import i18next from "i18next";
  import { initReactI18next } from "react-i18next";
  import en from "../locales/en.json";
  import de from "../locales/de.json";
  i18next.use(initReactI18next).init({
    lng: "en", fallbackLng: "en",
    resources: { en: { ui: en }, de: { ui: de } },
    interpolation: { escapeValue: false },
  });
  export default i18next;
  ```
- [ ] **0.5** Create `apps/web/src/locales/en.json` with keys:
  ```json
  {
    "nav": { "addresses": "Addresses", "articles": "Articles", "documents": "Documents", "settings": "Settings", "administration": "Administration", "baseTenant": "Base Tenant" },
    "modules": { "addresses": "Addresses", "articles": "Articles", "documents": "Documents" },
    "actions": { "new": "New", "archive": "Archive", "duplicate": "Duplicate", "save": "Save", "cancel": "Cancel", "post": "Post", "edit": "Edit", "close": "Close" },
    "shortcuts": { "title": "Keyboard Shortcuts", "navigation": "Navigation", "recordOps": "Record Operations", "workflow": "Workflow", "navKeys": "Navigation Keys" },
    "status": { "online": "System Online", "offline": "Offline" },
    "empty": { "title": "No results.", "subtitle": "Try a different filter, or create a new record." },
    "grid": { "records": "{{count}} records" },
    "tree": { "categories": "Categories", "groups": "Groups", "types": "Types" },
    "tenant": { "switch": "Switch Tenant", "new": "New Tenant…" },
    "avatar": { "language": "Language", "appearance": "Appearance", "theme": "Theme", "day": "Day", "night": "Night", "auto": "Auto", "signOut": "Sign Out", "userConfig": "User Config" },
    "form": { "required": "Required fields marked *. Press F10 to save.", "saving": "Saving…" }
  }
  ```
- [ ] **0.6** Create `apps/web/src/locales/de.json` with German equivalents for all keys in 0.5
- [ ] **0.7** Import `"../lib/i18n"` in `apps/web/src/routes/__root.tsx` (side-effect import, initializes i18next)
- [ ] **0.8** Wrap app in `<I18nextProvider i18n={i18next}>` inside `RootDocument` in `__root.tsx`
- [ ] **0.9** In `apps/web/src/routes/_auth/app/route.tsx`: AvatarMenu language toggle calls `i18n.changeLanguage("de")` (import `i18next` from `"../../lib/i18n"`)
- [ ] **0.10** In components that show UI strings, use `const { t } = useTranslation("ui")` and `t("nav.addresses")` etc.

---

## Phase 1 — Standard Component Rewrites

> Each component is a full rewrite to match the design prototype exactly. Do not patch — replace the file content.

### 1.1 DataGrid (`packages/ui/components/data-grid.tsx`)

- [ ] **1.1.1** Props: add `title?: string`, `toolbar?: boolean` (default true), `emptyTitle?: string`, `emptySubtitle?: string`, `emptyAction?: { label: string; kbd?: string; onClick: () => void }`, `flush?: boolean`
- [ ] **1.1.2** Toolbar (36px, `bg-canvas-soft`, `border-b border-hairline`): left = `title` (13px font-medium text-ink) + "{n} records" (12px text-ink-mute); right = Filter/Refresh/Export/MoreHorizontal icon buttons (`size-7 grid place-items-center rounded text-ink-mute hover:bg-canvas hover:text-ink`)
- [ ] **1.1.3** Loading skeleton: render `<table>` + `<thead>` (Skeleton cells matching column widths) + 8 `<tbody>` rows each with per-cell Skeleton of varying width (numeric: 60px, text: `80 + (col_idx*23 + row_idx*17) % 60` px)
- [ ] **1.1.4** Empty state: centered icon-ring div (`size-12 rounded-full border-2 border-hairline grid place-items-center`) with InboxIcon (size-5, strokeWidth 1.2) + title (14px text-ink-secondary) + subtitle (12px text-ink-mute) + action pill button (primary, PlusIcon + label + kbd badge if provided)
- [ ] **1.1.5** Selected row: `borderLeft: "2px solid var(--primary)"` + `backgroundColor: "color-mix(in oklab, var(--primary) 9%, transparent)"` (inline style)
- [ ] **1.1.6** Table layout: no outer `rounded-lg border border-hairline` when `flush={true}`; header cells `h-9 text-[12px] font-medium text-ink-mute uppercase tracking-tight`; body rows `h-10 border-b border-hairline`; numeric cells `text-right font-mono text-[13px] tabular-nums`
- [ ] **1.1.7** Use `useTranslation("ui")` for "No results." and "{n} records" strings
- [ ] **1.1.8** Keep FocusManager integration: row click → `setFocus({ entity, recordId, panel, area: "grid", row })`, keyboard ↑/↓/Home/End active when `focusState.area === "grid" && focusState.panel === panelId`

### 1.2 NavigationTree (`packages/ui/components/navigation-tree.tsx`)

- [ ] **1.2.1** Add `count?: number` to `TreeNode` interface; add `header?: string` prop
- [ ] **1.2.2** Render header div (32px, `bg-canvas-soft`, `border-b border-hairline`, `text-[11px] uppercase tracking-wider font-medium text-ink-mute px-3`) above tree list
- [ ] **1.2.3** Node row (28px): `paddingLeft: 8 + level * 14`, chevron icon (12px), folder icon (13px, strokeWidth 1.4), label (`flex-1 truncate`), count span (`ml-auto mr-2 text-[11px] text-ink-mute tabular-nums` when count defined)
- [ ] **1.2.4** Selected: `style={{ background: "var(--primary)", color: "var(--primary-fg)" }}` — overrides all inline text colors
- [ ] **1.2.5** Loading skeleton: 7 rows with paddingLeft values `[8, 22, 14, 28, 8, 22, 14]`; each row: chevron-sized Skeleton + label Skeleton (80–140px varying) + count Skeleton (22px)
- [ ] **1.2.6** Use `useTranslation("ui")` for header defaults ("Categories", "Groups", "Types")

### 1.3 ContextTabs (`packages/ui/components/context-tabs.tsx`)

- [ ] **1.3.1** Add `count?: number` to `TabDef`; add MoreHorizontal action button in tab bar right side
- [ ] **1.3.2** Tab bar (32px, `bg-canvas-soft`, `border-b border-hairline`): tabs left-aligned, each `h-8 px-3 text-[13px] border-b-2 border-transparent` inactive (`text-ink-mute hover:text-ink`) / active (`text-ink border-primary`)
- [ ] **1.3.3** Count badge: `<span class="ml-1 text-[11px] text-ink-mute">({count})</span>` inside tab button when defined
- [ ] **1.3.4** Content area: `flex-1 overflow-auto` — no internal padding (each tab's content owns padding)
- [ ] **1.3.5** More button: `size-7 grid place-items-center rounded text-ink-mute hover:bg-canvas hover:text-ink ml-auto`

### 1.4 InspectorPanel (`packages/ui/components/inspector-panel.tsx`)

- [ ] **1.4.1** Add `recordId?: string`, `actions?: React.ReactNode`, `sections?: { title: string; fields: InspectorField[] }[]` to props
- [ ] **1.4.2** Header (40px, `bg-canvas-soft`, `border-b border-hairline`): title (13px font-medium text-ink) + optional `<span class="ml-1 font-mono text-[10px] text-ink-mute">{recordId}</span>` + `<div class="ml-auto flex items-center gap-1">{actions}</div>`
- [ ] **1.4.3** Body: when `sections` provided, render each section with `<div class="text-[10px] uppercase tracking-wider text-ink-mute mb-2">{section.title}</div>` + fields grid + `<div class="h-px bg-hairline my-3"/>` between sections
- [ ] **1.4.4** Field row: label `text-[11px] uppercase tracking-wider text-ink-mute`, value `text-[13px] text-ink`

### 1.5 EntityMask (`packages/ui/components/entity-mask.tsx`)

- [ ] **1.5.1** Props: add `mode?: "create" | "edit"` (default "create" when no recordId), `onCancel?: () => void`, `onSaved?: (record: any) => void`, `embedded?: boolean` (true = no card wrapper)
- [ ] **1.5.2** Card layout when `!embedded`: `bg-canvas rounded-xl border border-hairline shadow-lg p-6 max-w-2xl mx-auto`; title 18px font-300 text-ink; subtitle `text-[13px] text-ink-mute mb-6` using `t("form.required")`
- [ ] **1.5.3** Field row: label `text-[12px] uppercase tracking-wide text-ink-mute mb-1` + required `<span class="text-primary">*</span>`
- [ ] **1.5.4** Input: `h-9 w-full border border-hairline-input bg-canvas rounded-md px-3 text-[13px] text-ink focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-[color-mix(in_oklab,var(--primary)_12%,transparent)]`
- [ ] **1.5.5** Error state: `border-destructive focus:ring-[color-mix(in_oklab,var(--destructive)_12%,transparent)]` + error text `text-[11px] text-destructive mt-1`
- [ ] **1.5.6** Help text: `text-[11px] text-ink-mute mt-1` (below input, only when no error)
- [ ] **1.5.7** Footer (when `!embedded`): `mt-6 pt-5 border-t border-hairline flex justify-end gap-3` — Cancel pill (outline) + Save pill (primary) with `t("actions.save")` / `t("actions.cancel")`
- [ ] **1.5.8** F10 → save (local keydown listener, NOT global command to avoid conflicts); Esc → `onCancel?.()`
- [ ] **1.5.9** `useEffect(() => { setFormData({}) }, [recordId])` — form reset on record switch
- [ ] **1.5.10** Fix import: `useMutation, useQueryClient` from `@tanstack/react-query`
- [ ] **1.5.11** Use `useLang` pattern: pick `f.labelEn` vs `f.labelDe` based on `i18next.language`

### 1.6 TriViewWorkspace (`packages/ui/components/triview-workspace.tsx`)

- [ ] **1.6.1** Remove `p-2` from primaryGrid wrapper — change to `<div className="h-full w-full overflow-hidden">`
- [ ] **1.6.2** Remove `rounded-lg border border-hairline` from ResizablePanelGroup (TriView is flush inside the viewport, no outer card border)
- [ ] **1.6.3** Left panel: `bg-canvas-soft` (already correct), no internal padding (NavigationTree owns its layout)
- [ ] **1.6.4** Lower right panel: remove `border-t border-hairline bg-canvas` wrapper — ContextTabs owns its own borders

### 1.7 ActionBar (`packages/ui/components/action-bar.tsx`)

- [ ] **1.7.1** Never return `null` — always render the 36px bar even if no crumbs and no commands
- [ ] **1.7.2** Add `subCrumb?: string` prop for second-level breadcrumb (e.g., selected category label from tree)
- [ ] **1.7.3** Breadcrumb rendering: `crumbs` items + `subCrumb` as last item; all but last in `text-ink-mute`, last in `text-ink`
- [ ] **1.7.4** Command pills: filter out `scope === "global"` (nav commands don't show in ActionBar); style `h-6 px-3 rounded-full text-[13px] border border-hairline bg-canvas text-ink-secondary hover:border-primary hover:text-primary`
- [ ] **1.7.5** Use `t("actions.*")` for command label display

### 1.8 StatusBar (`packages/ui/components/status-bar.tsx`)

- [ ] **1.8.1** Import `useFocus` to get `focusState.recordId` and `focusState.entity`
- [ ] **1.8.2** Left segment: `{tenantName}` · `{displayModule}` · `{focusState.recordId in font-mono}` (· separator only when next segment present)
- [ ] **1.8.3** Right segment: `v0.1.0` · online dot (`size-1.5 rounded-full bg-ok`) · `t("status.online")`
- [ ] **1.8.4** Module name: derive from pathname `location.pathname.split("/app/")[1]?.split("/")[0]`, capitalized; use `t("modules.{name}")` for display

### 1.9 ShortcutHelp (`packages/ui/components/shortcut-help.tsx`)

- [ ] **1.9.1** Group shortcuts into 4 sections: Navigation, Record Operations, Workflow, Navigation Keys
- [ ] **1.9.2** Static navigation key rows (not from command registry): ↑/↓ "Move up / down", Home/End "First / last row", Tab/⇧Tab "Next / previous field", Enter "Confirm"
- [ ] **1.9.3** Kbd rendering: split shortcut string on `+`, render each token as separate `<kbd class="h-5 px-1 font-mono text-[10px] border border-hairline-input bg-canvas-soft rounded text-ink-mute">`
- [ ] **1.9.4** Section header: `text-[10px] uppercase tracking-wider text-ink-mute mb-2 mt-4`
- [ ] **1.9.5** Use `t("shortcuts.*")` for section labels and dialog title

### 1.10 DocumentEditor (`packages/ui/components/document-editor.tsx`)

- [ ] **1.10.1** Props: `documentId: string`, `onClose: () => void`
- [ ] **1.10.2** Full-screen overlay: `fixed inset-0 z-40 bg-canvas flex flex-col`
- [ ] **1.10.3** Header area: embedded EntityMask for document header fields, compact 2-col form inside a `border border-hairline rounded-lg p-4 m-4`
- [ ] **1.10.4** Lines area: `flex-1 min-h-0 mx-4` containing DataGrid for `documentLine` (cols: position, article, description, qty, unitPrice, lineAmount)
- [ ] **1.10.5** Footer (48px): Close (Esc, outline pill) left + Save (F10, primary pill) + Post (F9, primary, disabled when status ≠ draft) right
- [ ] **1.10.6** Register local commands in `useEffect`: `save-document` (F10), `post-document` (F9, isEnabled when status=draft), Esc → `onClose()`
- [ ] **1.10.7** Fetch document header: `GET /api/data/document/{documentId}`; fetch lines: `GET /api/data/documentLine` filtered by documentId

### 1.11 StatisticsModule (`packages/ui/components/statistics-module.tsx`)

- [ ] **1.11.1** Register `open-statistics` command in `GlobalCommands` (Alt+I)
- [ ] **1.11.2** Implement as a right-side Drawer (`packages/ui/components/drawer.tsx`)
- [ ] **1.11.3** Content: KPI cards based on `focusState.entity` — addresses (total, new this month), articles (total, low stock), documents (draft count, total value)
- [ ] **1.11.4** KPI card: label (12px uppercase) + value (26px font-300 tabular-nums) + delta indicator

---

## Phase 2 — Module Route Rewrites

### 2.1 Addresses (`apps/web/src/routes/_auth/app/addresses.tsx`)

- [ ] **2.1.1** Register `create-record` command (F3, scope="context", isEnabled when entity="address") → open Dialog with EntityMask mode="create" entityName="address"
- [ ] **2.1.2** Register `archive-record` command (F4, isEnabled when `!!focusState.recordId && entity="address"`) → PATCH `{ archived: true }` to `/api/data/address/{id}`
- [ ] **2.1.3** Register `duplicate-record` command (F8, isEnabled when `!!focusState.recordId`) → POST copy of selected record
- [ ] **2.1.4** DataGrid props: `title={t("modules.addresses")}`, `emptyAction={{ label: t("actions.new")+" Address", kbd: "F3", onClick: () => executeCommand("create-record") }}`
- [ ] **2.1.5** Contacts tab: `useQuery(["data","addressContact", focusState.recordId])` fetching `/api/data/addressContact`; render DataGrid with columns firstName, lastName, email, phone
- [ ] **2.1.6** NavigationTree: pass `header={t("tree.categories")}`, pass `count` on each node from category record count
- [ ] **2.1.7** ActionBar: pass `crumbs={[t("modules.addresses")]}` and `subCrumb={selectedCategoryLabel}` when tree item selected
- [ ] **2.1.8** Create EntityMask Dialog: state `showCreate`, on save → `setShowCreate(false)` + invalidate query

### 2.2 Articles (`apps/web/src/routes/_auth/app/articles.tsx`)

- [ ] **2.2.1** Register `create-record` (F3) + `archive-record` (F4) + `duplicate-record` (F8) commands for entity="article"
- [ ] **2.2.2** Inventory Movements tab: fetch `inventoryMovement` filtered by articleId; DataGrid cols: movementType, qty, warehouseId, reference, createdAt
- [ ] **2.2.3** DataGrid: `title={t("modules.articles")}`, `emptyAction` with F3
- [ ] **2.2.4** NavigationTree: `header={t("tree.groups")}`
- [ ] **2.2.5** ActionBar: `crumbs={[t("modules.articles")]}` + `subCrumb={selectedGroupLabel}`

### 2.3 Documents (`apps/web/src/routes/_auth/app/documents.tsx`)

- [ ] **2.3.1** Register `create-record` (F3, new document), `open-document` (F9, open DocumentEditor, isEnabled when `!!focusState.recordId`), `transform-record` (F7, stub)
- [ ] **2.3.2** Document Lines tab: fetch `documentLine` filtered by documentId; DataGrid cols: position, articleId, description, qty, unitPrice, lineAmount (numeric cols right-aligned mono)
- [ ] **2.3.3** When `focusState.mode === "edit"`, render `<DocumentEditor documentId={focusState.recordId} onClose={() => setFocus({ mode: null })} />`
- [ ] **2.3.4** DataGrid: `title={t("modules.documents")}`, `emptyAction` with F3
- [ ] **2.3.5** NavigationTree: `header={t("tree.types")}`
- [ ] **2.3.6** ActionBar: `crumbs={[t("modules.documents")]}` + `subCrumb={selectedTypeLabel}`

---

## Phase 3 — New Routes

### 3.1 Admin Route (`apps/web/src/routes/_auth/app/admin/index.tsx`)

- [ ] **3.1.1** `beforeLoad`: check `context.user.isSystemAdmin`; if false, `throw redirect({ to: "/app/addresses" })`
- [ ] **3.1.2** Full-page layout (no TriView): `<div class="h-full flex flex-col">`
- [ ] **3.1.3** Tabs: Organizations | Users | Tenants (using ContextTabs)
- [ ] **3.1.4** Each tab: DataGrid fetching `/api/admin/data/{organization|user|tenant}` with metadata-derived columns
- [ ] **3.1.5** ActionBar: `crumbs={[t("nav.administration")]}`

### 3.2 Settings Route (`apps/web/src/routes/_auth/app/settings/index.tsx`)

- [ ] **3.2.1** Left sidebar (NavigationTree-style, static categories): Helper Tables, Layout Overrides, Field Config
- [ ] **3.2.2** Main area: DataGrid for selected category using `/api/data/{entity}`
- [ ] **3.2.3** Helper Table entities: `paymentTerm`, `taxCode`, `shippingMethod`, `warehouse`, `costCenter`
- [ ] **3.2.4** ActionBar: `crumbs={[t("nav.settings")]}` + `subCrumb={selectedCategory}`

---

## Phase 4 — Global Command Completions

### 4.1 GlobalCommands (`packages/ui/platform/global-commands.tsx`)

- [x] **4.1.1** Register `open-statistics` (Alt+I) → dispatches `slopware:open-statistics` CustomEvent
- [x] **4.1.2** Register `open-palette` (Ctrl+K) → dispatches `slopware:open-palette` CustomEvent
- [ ] **4.1.3** Register `save-close` (F10) as global fallback (only fires if no component-level F10 listener consumed it)
- [ ] **4.1.4** Shortcut grouping metadata: add `group` field to Command interface for ShortcutHelp categorization

### 4.2 Command Palette (`packages/ui/components/command-palette.tsx`) — DONE

- [x] **4.2.1** Dialog with autoFocus `<input>` search field
- [x] **4.2.2** Lists all registered commands matching search (filter by `cmd.label[lang].toLowerCase().includes(query)`)
- [x] **4.2.3** ↑/↓ keyboard navigation, Enter executes, Esc closes
- [x] **4.2.4** Render inside `__root.tsx` as `<CommandPalette />`
- [x] **4.2.5** Command row: label + shortcut kbd chip right-aligned

---

## Phase 5 — TenantSwitcher Wiring

- [x] **5.1** Inspect `authQueryOptions` result shape — tenant info not in auth session, added `getUserTenantInfo` to DB service
- [x] **5.2** Created `/api/me` endpoint returning `{ tenantName, orgName }` from DB join
- [x] **5.3** TenantSwitcher uses `useQuery(["me","tenant"])` to fetch real tenant+org names
- [x] **5.4** AppLayout uses same query; passes real `tenantName` to `<StatusBar />`
- [x] **5.5** TenantSwitcher shows current tenant from DB; static "new tenant" stub retained

---

## Phase 6 — Typography

- [ ] **6.1** Add JetBrains Mono font import at top of `packages/ui/styles/base.css`:
  ```css
  @import url("https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap");
  ```
- [ ] **6.2** Add `--font-mono: 'JetBrains Mono', ui-monospace, monospace;` to `@theme inline`
- [ ] **6.3** Verify `font-mono` Tailwind utility resolves to JetBrains Mono in: kbd elements, record IDs, StatusBar record segment, numeric DataGrid cells, code displays

---

## Verification Checklist

### Visual
- [ ] AppBar: 48px, brand mark, tenant pill, 3 module tabs with ⌥1/2/3 kbd badges, ⋯ overflow, search bar with ⌘K badge, help icon, avatar initials
- [ ] Active module tab: primary fill background, white text, visible kbd badge
- [ ] ActionBar: always visible 36px bar with breadcrumbs left + command pills right
- [ ] StatusBar: 32px, tenant name · module · record ID (mono) left; v0.1.0 · dot · "System Online" right
- [ ] DataGrid: toolbar with title + record count + 4 icon buttons; 40px rows; selected row primary tint + 2px left accent
- [ ] DataGrid empty: icon ring + subtitle + action pill with F3 badge
- [ ] DataGrid loading: table-shaped skeletons (not generic blocks)
- [ ] NavigationTree: header label row + 28px nodes + count badges + indent-aware skeleton
- [ ] NavigationTree selected: solid primary bg, white text
- [ ] ContextTabs: 32px tab bar, underline active indicator (primary), optional count badge
- [ ] InspectorPanel: 40px header with title + mono ID + actions
- [ ] EntityMask: 2-col form grid, correct error styling (destructive), F10/Esc wired, cancel button
- [ ] ShortcutHelp: 4 grouped sections, multi-part kbd chips
- [ ] DocumentEditor: full-screen overlay, header form + lines grid + footer actions
- [ ] All 10 accent themes apply correctly via `data-theme` attribute
- [ ] Dark mode: canvas inverts, sidebar stays brand-dark-900

### Keyboard
- [ ] `Alt+1` → Addresses, `Alt+2` → Articles, `Alt+3` → Documents, `Alt+0` → Settings
- [ ] `Alt+I` → StatisticsModule drawer opens
- [ ] `Ctrl+K` → Command palette opens
- [ ] `?` → ShortcutHelp dialog opens with grouped sections
- [ ] `F3` (in module) → create new record dialog opens
- [ ] `F4` (with record selected) → archive action triggers
- [ ] `F8` (with record selected) → duplicate action triggers
- [ ] `F9` (in Documents with record selected) → DocumentEditor opens
- [ ] `F10` (in EntityMask) → saves form
- [ ] `Esc` → closes topmost overlay in priority order
- [ ] `↑/↓` in DataGrid → navigates rows when grid focused
- [ ] `Home/End` in DataGrid → jumps to first/last row

### Data
- [ ] Addresses: contacts tab shows real `addressContact` records
- [ ] Articles: inventory tab shows real `inventoryMovement` records
- [ ] Documents: lines tab shows real `documentLine` records
- [ ] Documents: F9 opens DocumentEditor with header form + lines grid
- [ ] Admin route: Organizations/Users/Tenants tabs load from `/api/admin/data/`
- [ ] Settings route: helper tables load from `/api/data/`

### i18n
- [ ] Language toggle EN → DE switches all UI labels (nav, buttons, field labels, section headings)
- [ ] Field labels from metadata API use `labelDe` when language is DE
- [ ] Language preference persists across page reload (localStorage via i18next)

### Quality
- [ ] `pnpm lint` (vp lint --type-aware --type-check) passes with zero errors
- [ ] No hardcoded color strings in components (all use design tokens)
- [ ] No console errors in browser dev tools during normal usage
