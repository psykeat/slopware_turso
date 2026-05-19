# slopware Design System

> version: 1.0
> name: Stripi-Inspired — slopware Application Design
> description: Metadata-driven, keyboard-first ERP shell. Dense B2B UI built on deep navy shell,
> electric indigo primary, Inter 300 throughout, and tabular figures wherever numbers appear.
> The prototype (`slopware.html` in the design handoff) is the visual reference;
> this file is the contract for implementing it in the TanStack/React codebase.

---

## 1. Design Tokens

### Colors — Light Mode

| Token                        | Hex       | Used for                                      |
| ---------------------------- | --------- | --------------------------------------------- |
| `--primary`                  | `#533afd` | CTA, active nav, focus rings, primary buttons |
| `--primary-deep`             | `#4434d4` | Hover/press state                             |
| `--primary-press`            | `#2e2b8c` | Active/pressed state                          |
| `--primary-soft`             | `#7d6efd` | Tinted fills, avatars, selected-row accent    |
| `--primary-fg`               | `#ffffff` | Text/icon on solid primary surface            |
| `--primary-bg-subdued-hover` | `#b9b9f9` | Subtle primary hover fill                     |
| `--brand-dark-900`           | `#1c1e54` | AppBar background — always dark, both modes   |
| `--ink`                      | `#0d253d` | Default body text — never pure black          |
| `--ink-secondary`            | `#273951` | Secondary text                                |
| `--ink-mute`                 | `#64748d` | Labels, captions, placeholders                |
| `--canvas`                   | `#ffffff` | Work surface background                       |
| `--canvas-soft`              | `#f6f9fc` | Panel headers, table headers, tree background |
| `--canvas-cream`             | `#f5e9d4` | Warm alternate surface (marketing, toasts)    |
| `--hairline`                 | `#e3e8ee` | All non-input borders and dividers            |
| `--hairline-input`           | `#a8c3de` | Input field borders only                      |
| `--destructive`              | `#c43c4d` | Errors, danger menu items                     |
| `--ok`                       | `#2fa770` | Success/online status dot                     |
| `--warn`                     | `#d6a416` | Warning status                                |
| `--ruby`                     | `#ea2261` | Brand accent (marketing only)                 |
| `--magenta`                  | `#f96bee` | Brand accent (marketing only)                 |
| `--lemon`                    | `#9b6829` | Brand accent (marketing only)                 |

### Colors — Dark Mode (`data-mode="dark"`)

```css
--canvas: #0e1426;
--canvas-soft: #161d33;
--ink: #eef2f9;
--ink-secondary: #b4bdd1;
--ink-mute: #7c8aa6;
--hairline: #1f2741;
--hairline-input: #3b4566;
--destructive: #ff6b7d;
--ok: #4ec98e;
--warn: #eab64b;
```

The AppBar (`--brand-dark-900`) stays dark in both modes. Only the work surface inverts.

### Typography — Inter, weight 300 throughout

| Token       | Size           | Weight | Tracking | Feature | Use                               |
| ----------- | -------------- | ------ | -------- | ------- | --------------------------------- |
| Display     | 26px           | 300    | −0.26px  | —       | Section/page titles               |
| Display XXL | 56px           | 300    | −1.4px   | —       | Hero/marketing headlines          |
| Body        | 15px           | 300    | 0        | —       | Default UI text                   |
| Tabular     | 14px           | 300    | −0.42px  | `tnum`  | **All numbers, IDs, dates**       |
| Caption     | 13px           | 400    | −0.39px  | —       | Labels, column headers            |
| Micro       | 11px           | 300    | 0        | —       | Status bar, shortcuts, fine print |
| Mono        | JetBrains Mono | 400    | —        | —       | Record codes, kbd badges          |

> Always enable `font-variant-numeric: tabular-nums` on any numeric data — prices, quantities, dates, IDs.

### Radii

| Name   | Value  | Use                             |
| ------ | ------ | ------------------------------- |
| `xs`   | 4px    | Tight chips, micro badges       |
| `sm`   | 6px    | Inputs                          |
| `md`   | 8px    | Dropdowns, popovers             |
| `lg`   | 12px   | Cards, panels                   |
| `pill` | 9999px | ActionBar buttons, primary CTAs |

### Shadows

- Cards: one subtle level (`box-shadow: 0 1px 3px rgba(13,37,61,.08), 0 1px 2px rgba(13,37,61,.06)`)
- Modal: stronger (`0 20px 60px rgba(0,0,0,.18)`)
- Kbd badges: 1px inset micro shadow
- Dark AppBar: no shadow

---

## 2. Theming — Day/Night + 10 Themes

Applied as HTML attributes: `<html data-mode="light|dark" data-theme="indigo|ocean|…">`.

Both attributes must be set together. Every CSS color goes through `--primary*` tokens;
no component hardcodes a hex color for interactive elements.

### Theme Palette Table

| id        | Light primary | Dark primary | Notes                                     |
| --------- | ------------- | ------------ | ----------------------------------------- |
| `indigo`  | `#533afd`     | `#7466ff`    | **Default** — matches the brand spec      |
| `ocean`   | `#2563eb`     | `#6d97f5`    | Classic enterprise blue                   |
| `cyan`    | `#0e7490`     | `#38c4dc`    | Cool teal-cyan                            |
| `teal`    | `#0f766e`     | `#2dd4bf`    | Mid-spectrum green-blue                   |
| `emerald` | `#047857`     | `#34d399`    | Saturated green                           |
| `forest`  | `#4d7c0f`     | `#a3e635`    | Olive/lime                                |
| `amber`   | `#b45309`     | `#f59e0b`    | Warm; dark-mode uses dark text on primary |
| `rose`    | `#e11d48`     | `#fb7185`    | Warm red                                  |
| `violet`  | `#7c3aed`     | `#a78bfa`    | Cooler than indigo                        |
| `slate`   | `#475569`     | `#94a3b8`    | Neutral/mono mode                         |

### Color-mix rules — keep theme purity

- Tinted fills: `color-mix(in oklab, var(--primary) X%, var(--canvas))` — auto-adapts to theme + mode.
- Primary button text: `var(--primary-fg)`, **never** `#fff` literal.
- Focus rings: `color-mix(in oklab, var(--primary) 22%, transparent)`.
- Status colors (`--ok`, `--warn`, `--destructive`) are neutral across themes; dark-mode values are bumped for legibility.

### Adding a new theme

Add a `[data-theme="id"]` block and a `[data-mode="dark"][data-theme="id"]` block with
four tokens: `--primary`, `--primary-deep`, `--primary-soft`, `--primary-fg`. No other CSS changes needed.

---

## 3. Layout Skeleton

No sidebar. All module navigation lives in the AppBar. In-module hierarchy lives in the
TriView NavigationTree (left panel of the workspace).

```
┌─ AppBar (48px, brand-dark-900) ─────────────────────────────────────────────┐
│  ◇ slopware  │  Acme Corp ▾  │  [Addresses ⌥1]  Articles ⌥2  Documents ⌥3  ⋯ │  search  │  EN  ☀  ?  ●  │
├─ ActionBar (36px, canvas-soft, hairline bottom) ────────────────────────────┤
│  Customers › Key Accounts › Vorwerk & Söhne        +New F3 │ Edit │ Archive… │
├─ Workspace ─────────────────────────────────────────────────────────────────┤
│  NavigationTree (22%)       DataGrid (upper-right, 60% of right col)        │
│  ⌐ Customers                AMS-00042  Vorwerk & Söhne GmbH  …               │
│    Key Accounts             AMS-00043  Helvetia Werkzeuge AG  …              │
│  ⌐ Suppliers                ┌──────────────────────────────────────────────┐ │
│                              ContextTabs / InspectorPanel (lower 40%)       │
├─ StatusBar (32px, canvas-soft, hairline top) ───────────────────────────────┤
│  Tenant: Acme Corp · Module: Addresses · Record: AMS-00042     ● Online     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### AppBar zones (left → right)

1. **Brand** — logo mark + "slopware" wordmark (white, 300)
2. **Tenant switcher** — rounded pill showing `Org › Tenant`; click opens 260px popover of accessible tenants
3. **Module tabs** — primary modules as rounded-md pills: Addresses · Articles · Documents. Active: primary fill. `Alt+1/2/3` kbd badges on hover.
4. **System overflow (`⋯`)** — popover with Settings / Administration / Base Tenant. Admin items gated by `is_system_admin`. Base Tenant gets dashed border (special/global config context).
5. **Search** — decorative for now; will become `⌘K` command palette
6. **Right rail** — Language pill · sun/moon icon · help icon · avatar dropdown
7. **Avatar menu** — User Config · Language toggle · Day/Night toggle · Theme selector · Sign Out

### ActionBar

Single 36px row: breadcrumb (left, omits module name — already in AppBar tab) + action pills (right).
Pills are `pill`-radius, h-8, 12px padding, 13px text, `hairline-input` border.
Hover: primary border + primary text. Kbd badge inside each pill label.

### TriView columns

- Left (NavigationTree): ~22%, min 15%, max 40%
- Upper-right (DataGrid): 60% of right column height
- Lower-right (ContextTabs + InspectorPanel or EntityMask): 40%
- Resize handles: thin hairline with 16px grip dot on hover

### StatusBar

Fixed bottom, 32px, canvas-soft, hairline top. Left: Tenant · Module · Record ID. Right: online dot + label.

---

## 4. Components

### NavigationTree

- 28px node height · 12px indent per level · chevron + folder icon + label + count badge
- **Selected**: solid `--primary` bg + white text
- **Hover**: `--canvas` bg
- **Loading**: ~7 skeleton rows mimicking indent pattern
- Must participate in platform focus/command system; no mutation logic

### DataGrid

- **Header**: 36px, `--canvas-soft` bg, caption-size labels in `--ink-mute`, hairline bottom border
- **Rows**: 40px, ink text 300, hairline divider between rows
- **Selected row**: `color-mix(primary 9%)` bg + 2px `--primary-soft` left accent border
- **Hover**: `--canvas-soft`
- **Numeric columns**: right-aligned, `font-variant-numeric: tabular-nums`
- Flush to panel — no outer border
- **Loading**: 8 skeleton rows with shimmer
- **Empty**: dashed icon ring + ink-mute caption + optional primary "New (F3)" pill

### ContextTabs

- 32px tab bar, underline style
- Inactive: `--ink-mute`; Active: `--ink` + 2px `--primary` bottom border
- Count badges in tab
- Tabs vary by module: Details · Contacts · Delivery Addresses · Documents (Addresses) / Details · Inventory Movements (Articles) / Lines · Header Details (Documents)

### InspectorPanel

- **Header**: 40px, `--canvas-soft`, ink title + mono record ID + edit/more actions
- **Body**: 2-column `(label, value)` pairs; labels in micro uppercase `--ink-mute`; values in body `--ink`
- Use `sections` prop for grouped fields with light dividers
- `full` span for wide fields

### EntityMask

- `lg`-radius card, canvas bg, 24px padding, 2-column grid on md+
- **Input**: h-9, canvas bg, `hairline-input` border, sm radius. Focus: primary border + 3px primary-tinted ring
- **Error field**: destructive border + micro error text below
- **Help text**: micro, `--ink-mute`
- **Footer**: right-aligned Cancel (Esc) + primary pill Create/Update (F10)
- Replaces ContextTabs lower panel while active; no per-entity validation logic — consumes effective metadata

### ActionBar Buttons

- `pill`-radius, h-8, 12px padding, 13px text
- Default: `hairline-input` border, `--ink` text
- Hover: `--primary` border + `--primary` text
- Primary variant: solid `--primary` bg, `--primary-fg` text
- Disabled: 40% opacity
- Kbd badge: mono 10px inside the label

### ShortcutOverlay

- Modal, max-w-xl, canvas bg, `shadow-modal`
- Header: "Keyboard Shortcuts" 20px/300
- 2-column grid: action label (sm ink-secondary) + `<kbd>` badges (mono 11px, canvas-soft bg, hairline-input border, sm radius, micro shadow)
- Groups: Global Navigation · Record Actions · Grid Navigation · Form Controls
- Triggered by `?` key; closed by Esc

---

## 5. Keyboard Contract

Wired platform-wide; inputs/textareas swallow most (except Esc).

| Key     | Action                                               |
| ------- | ---------------------------------------------------- |
| `Alt+1` | Open Addresses                                       |
| `Alt+2` | Open Articles                                        |
| `Alt+3` | Open Documents                                       |
| `Alt+0` | Open Settings / Company master data                  |
| `Alt+I` | Open StatisticsModule for current context            |
| `F3`    | New record in active context                         |
| `F4`    | Archive/delete current record (where allowed)        |
| `F5`    | Open lookup table for active lookup-capable field    |
| `F7`    | Transform (e.g. document conversion)                 |
| `F8`    | Duplicate current record                             |
| `F9`    | Execute primary contextual process (post, etc.)      |
| `F10`   | Save and close                                       |
| `?`     | Open shortcut overlay                                |
| `Esc`   | Contextual close: overlay → form → panel → workspace |

Arrow keys, Home, End, Enter, Tab, Shift+Tab must behave consistently in grids, forms, trees, dialogs.

---

## 6. Module UX Patterns

### Addresses

TriView: category tree (Customer / Supplier / Partner) → Address grid (Company, Contact, City, Country, Phone) → ContextTabs: Details · Contacts · Delivery Addresses · Related Documents.

### Articles

TriView: Article Group tree → Article grid (Number, Name, Unit, Price, Stock) → ContextTabs: Details · Inventory Movements.

### Documents

Two modes:

- **Browse** (TriView): Document type/group tree → Document grid (No., Date, Customer, Total, Status) → ContextTabs: Lines · Header Details
- **Edit** (DocumentEditor): compact header + dedicated line editor — separate route/workspace from browse

### Settings

Generic EntityPage or TriView combinations per helper table. Standard components only — no custom dialogs.

### Administration

List + form orientation is acceptable; must still use standard components, command rules, and focus contracts. Visible only when `is_system_admin = true`.

### Base Tenant

Separate context, visually marked as special (dashed border). Global metadata config only. Never operational tenant data. Accessible only to `is_system_admin`.

---

## 7. Access Model

Three layers — all three must agree:

1. **Navigation visibility**: AppBar tabs and `⋯` overflow hide admin items unless `is_system_admin`.
2. **Route protection**: `/admin/*` and `/base-tenant/*` guarded by middleware/loaders.
3. **Server authorization**: server functions re-check auth independently — never trust client payload for tenant or admin context.

---

## 8. B2B & Data Density Principles

1. **Tabular Figures**: `font-variant-numeric: tabular-nums` on all numeric data.
2. **Visual Hierarchy**: `--ink-mute` for labels; `--ink` for values. No bold for hierarchy — use size and muting.
3. **Dense UI**: 40px rows, 36px action bar, 32px status bar. If a row exceeds 40px, it must be a form input.
4. **AppBar always dark**: `--brand-dark-900` shell regardless of day/night mode.
5. **Decisive actions**: Short pill buttons in ActionBar; no floating FABs.
6. **No decorative surfaces**: No gradients, illustrations, or decorative shadows on work surfaces.
7. **No colored status badges**: Dot indicator + `--ink-mute` text is the only status pattern.

---

## 9. Do's and Don'ts

**DO:**

- Use Inter weight 300 for all UI text including headings.
- Use `--primary` (or active theme primary) as the sole interactive accent color.
- Use `color-mix()` for tinted fills so they theme-adapt automatically.
- Use `var(--primary-fg)` for text on solid primary surfaces — never `#fff` literal.
- Use JetBrains Mono for record codes and kbd badges.
- Enable `ss01` stylistic set globally on Inter.
- Keep NavigationTree as hierarchy-only — no mutation logic inside it.

**DON'T:**

- Use pure black — use `--ink` (`#0d253d`).
- Add a left sidebar. Module navigation is in the AppBar; in-module hierarchy is in the TriView NavigationTree. These are different layers.
- Introduce a secondary accent color for interactive elements.
- Add decorative gradients or illustrations to work surfaces.
- Use colored badges for status. Dot + ink-mute label is the pattern.
- Add padding bloat. This is a dense B2B tool.
- Hand-roll inline SVGs — extend the shared icon set.
- Move posting logic, tenant isolation, or security boundaries into frontend components.
- Hard-delete business master data — use archive/deactivate semantics.

---

## 10. Reference Prototype

The design handoff (`slopware.html` + companion JSX/CSS files) is the pixel-level reference.
Key files to read when implementing a new component:

| Prototype file | What it contains                                                                   |
| -------------- | ---------------------------------------------------------------------------------- |
| `tokens.css`   | All CSS variables, dark mode overrides, 10 theme palettes — single source of truth |
| `appbar.jsx`   | AppBar implementation: brand, tenant switcher, module tabs, overflow, avatar menu  |
| `bars.jsx`     | ActionBar (crumbs + pills) and StatusBar                                           |
| `triview.jsx`  | NavigationTree, DataGrid, ContextTabs, InspectorPanel                              |
| `forms.jsx`    | EntityMask form + ShortcutOverlay modal                                            |
| `modules.jsx`  | Per-module TriView content + AdminUsersView                                        |
| `app.jsx`      | Root state, keyboard wiring, theme/mode, resize logic                              |

When implementing in the actual TanStack codebase, match the visual output of the prototype.
Do not copy prototype internal structure (React/Babel script tags, etc.) — use the project's
component conventions under `packages/ui` and `apps/web/src`.
