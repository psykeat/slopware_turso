# Design System & UI Patterns

## 1. Design Tokens

### Colors (Light Mode)

- `--primary`: `#533afd` (CTA, active nav, focus rings, primary buttons)
- `--primary-deep`: `#4434d4` (Hover/press states)
- `--primary-soft`: `#7d6efd` (Tinted fills, selected-row accents)
- `--primary-fg`: `#ffffff` (Text/icon on solid primary background)
- `--brand-dark-900`: `#1c1e54` (AppBar background - always dark in both modes)
- `--ink`: `#0d253d` (Default body text - never pure black)
- `--ink-secondary`: `#273951` (Secondary body text)
- `--ink-mute`: `#64748d` (Labels, captions, placeholders)
- `--canvas`: `#ffffff` (Main panel/work surface background)
- `--canvas-soft`: `#f6f9fc` (Panel headers, table headers, tree background)
- `--hairline`: `#e3e8ee` (Borders and dividers)
- `--hairline-input`: `#a8c3de` (Input field borders)
- `--destructive`: `#c43c4d` (Errors, danger menus)
- `--ok`: `#2fa770` (Success/status dots)
- `--warn`: `#d6a416` (Warning status)

### Colors (Dark Mode - `data-mode="dark"`)

- `--canvas`: `#0e1426` | `--canvas-soft`: `#161d33`
- `--ink`: `#eef2f9` | `--ink-secondary`: `#b4bdd1` | `--ink-mute`: `#7c8aa6`
- `--hairline`: `#1f2741` | `--hairline-input`: `#3b4566`
- `--destructive`: `#ff6b7d` | `--ok`: `#4ec98e` | `--warn`: `#eab64b`

### Typography (Inter, Weight 300 throughout)

- **Display**: 26px, tracking −0.26px (Page/section titles)
- **Body**: 15px (Default UI text)
- **Tabular**: 14px, tracking −0.42px, `tnum` active (All numbers, prices, dates, IDs)
- **Caption**: 13px, weight 400 (Labels, column headers)
- **Mono**: JetBrains Mono, weight 400 (Record codes, `<kbd>` badges)
  > **Rule**: Enable `font-variant-numeric: tabular-nums` globally on all numeric data.

### Radii & Shadows

- `xs`: 4px | `sm`: 6px (Inputs) | `md`: 8px (Dropdowns) | `lg`: 12px (Cards/panels) | `pill`: 9999px (CTAs)
- **Cards**: `box-shadow: 0 1px 3px rgba(13,37,61,.08), 0 1px 2px rgba(13,37,61,.06)`
- **Modals**: `box-shadow: 0 20px 60px rgba(0,0,0,.18)`

---

## 2. Layout Structure (Day/Night Shell)

```
┌─ AppBar (48px, brand-dark-900) ─────────────────────────────────────────────┐
│  ◇ slopware  │  Acme Corp ▾  │  [Addresses ⌥1]  Articles ⌥2  Documents ⌥3  ⋯ │  search  │  EN  ☀  ?  ●  │
├─ ActionBar (36px, canvas-soft, hairline bottom) ────────────────────────────┤
│  Customers › Key Accounts › Vorwerk & Söhne        +New F3 │ Edit │ Archive… │
├─ Workspace (TriView Layout) ────────────────────────────────────────────────┤
│  NavigationTree (22%)       DataGrid (upper-right, 60% of right col)        │
│  ⌐ Customers                AMS-00042  Vorwerk & Söhne GmbH  …               │
│  InspectorPanel or EntityMask (lower-right context area, 40%)               │
├─ StatusBar (32px, canvas-soft, hairline top) ───────────────────────────────┤
│  Tenant: Acme Corp · Module: Addresses · Record: AMS-00042     ● Online     │
└─────────────────────────────────────────────────────────────────────────────┘
```

- **AppBar (48px)**: Logo + Tenant switcher + Module pills + Settings/Admin overflow (`⋯`) + Right rail (i18n, mode switch, avatar dropdown).
- **ActionBar (36px)**: Breadcrumbs (left, omits active module) + Pill-shaped action buttons with hotkey labels (right).
- **StatusBar (32px)**: Fixed bottom bar showing tenant, module, record ID, and connection state.
- **TriViewWorkspace**: Left Navigation Tree (~22% width) + Upper-right DataGrid (60% height) + Lower-right InspectorPanel/EntityMask (40% height).

---

## 3. Platform Components

### NavigationTree

- 28px nodes, 12px indents, chevron + folder icon + count badge.
- Focus/commands wired; no local mutation logic.

### DataGrid

- **Header**: 36px, `--canvas-soft` bg, `--ink-mute` text.
- **Rows**: 40px, hairline dividers. Selected row gets `color-mix(primary 9%)` bg and 2px `--primary-soft` left border.
- Numeric columns right-aligned with `tabular-nums`.

### EntityMask & Inputs

- `lg` radius card, canvas bg. Input fields: h-9, `hairline-input` border, focus gets `--primary` border + 3px primary ring.
- Save: contextual action (F10), cancel via Esc.

---

## 4. Keyboard Shortcuts

| Hotkey  | Action                                               |
| ------- | ---------------------------------------------------- |
| `Alt+1` | Open Addresses                                       |
| `Alt+2` | Open Articles                                        |
| `Alt+3` | Open Documents                                       |
| `Alt+0` | Open Settings / Master Data                          |
| `Alt+I` | Open Statistics Drawer                               |
| `F3`    | Create new record in active context                  |
| `F4`    | Archive/delete current record                        |
| `F5`    | Open lookup table in lookup-capable fields           |
| `F9`    | Execute primary contextual action (post)             |
| `F10`   | Save active EntityMask / Form                        |
| `?`     | Open keyboard shortcut help overlay                  |
| `Esc`   | Close overlay $\rightarrow$ form $\rightarrow$ panel |
