# slopware — Project Map

Fast-path reference for agents. No prose, no repetition. Read this first; drill into linked files only when needed.

---

## Monorepo Layout

```
apps/web/          TanStack Start SSR app (entry point)
packages/auth/     Better Auth config + TanStack helpers
packages/db/       Drizzle ORM schema, migrations, services
packages/ui/       Shared React component library
tooling/tsconfig/  Base tsconfig
vite.config.ts     Oxlint + Oxfmt config (root, affects all)
```

**Import aliases:**
- `@repo/ui/*` → `packages/ui/*`
- `@repo/auth/*` → `packages/auth/src/*`
- `@repo/db/*` → `packages/db/src/*`
- `#/` → `apps/web/src/`

---

## Route Hierarchy (`apps/web/src/routes/`)

```
__root.tsx                     Shell: ThemeProvider, I18nextProvider, CommandProvider, FocusProvider
index.tsx                      → redirect to /app/addresses
_auth/route.tsx                Guard: ensureQueryData(authQueryOptions()), returns { user } to context
_auth/app/route.tsx            AppBar + ActionBar + StatusBar shell; AppLayout component
_auth/app/index.tsx            → redirect to /app/addresses
_auth/app/addresses.tsx        Addresses module (TriView)
_auth/app/articles.tsx         Articles module (TriView)
_auth/app/documents.tsx        Documents module (TriView)
_auth/app/settings/index.tsx   Settings (helper tables sidebar + DataGrid)
_auth/app/admin/route.tsx      Admin tab shell (Tenants / Users / Organizations)
_auth/app/admin/index.tsx      beforeLoad: isSystemAdmin check → redirect
_auth/app/admin/tenants.tsx    Admin: tenant list grid
_auth/app/admin/users.tsx      Admin: user list grid
_auth/app/admin/organizations.tsx  Admin: org list grid
_guest/route.tsx               Guard: redirect if already authed
_guest/login.tsx               Login form
_guest/signup.tsx              Signup form

api/auth/$.ts                  Better Auth handler (catch-all)
api/data/$.ts                  Tenant-scoped CRUD: GET/POST/PATCH /api/data/{entity}[/{id}]
api/metadata/$.ts              Field metadata: GET /api/metadata/fields/{entity}
api/admin/data/$.ts            System-admin CRUD: /api/admin/data/{entity}
api/me.ts                      GET /api/me → { tenantName, orgName }
```

**Route context:** `const { user } = Route.useRouteContext()` — available in all `_auth/**` routes.

---

## API Quick Reference

| Endpoint | Auth | Returns |
|---|---|---|
| `GET /api/data/{entity}` | session | `T[]` — tenant-scoped list |
| `POST /api/data/{entity}` | session | created record |
| `PATCH /api/data/{entity}/{id}` | session | patched record |
| `GET /api/metadata/fields/{entity}` | session | `FieldDef[]` |
| `GET /api/admin/data/{entity}` | isSystemAdmin | `T[]` — cross-tenant |
| `GET /api/me` | session | `{ tenantId, tenantName, orgName }` |

**Fetch pattern used in module routes:**
```ts
const { data = [], isLoading } = useQuery({
  queryKey: ["data", "address"],
  queryFn: async () => {
    const res = await fetch("/api/data/address");
    return res.ok ? res.json() : [];
  },
});
```

**After mutation — invalidate:**
```ts
queryClient.invalidateQueries({ queryKey: ["data", entityName] });
```

---

## Auth

| File | Purpose |
|---|---|
| `packages/auth/src/auth.ts` | betterAuth server config |
| `packages/auth/src/auth-client.ts` | authClient (browser) |
| `packages/auth/src/tanstack/queries.ts` | `authQueryOptions()` |

**Access user in a route:**
```ts
const { user } = Route.useRouteContext(); // _auth/** only
const name = (user as any)?.name ?? (user as any)?.user?.name;
const isSystemAdmin = (user as any)?.isSystemAdmin ?? false;
```

---

## Database

**Schema files:** `packages/db/src/schema/app.schema.ts` + `auth.schema.ts`

**Services:**
```
packages/db/src/services/data.ts      DataService — tenant-scoped CRUD (list/create/patch)
packages/db/src/services/metadata.ts  MetadataService — field defs per entity
packages/db/src/services/tenant.ts    getTenantContext(), getUserTenantInfo()
```

**Key entities (tenant-scoped):**

| Domain | Entities |
|---|---|
| Addresses | `address`, `addressContact`, `addressCategory`, `addressSeq` |
| Articles | `article`, `articleGroup`, `articleBom` |
| Documents | `document`, `documentLine`, `documentType`, `documentGroup` |
| Inventory | `inventoryMovement`, `inventoryBalance` |
| Finance | `glAccount`, `journalEntry`, `journalLine`, `paymentTerm`, `taxCode`, `taxRule` |
| Helpers | `warehouse`, `costCenter`, `shippingMethod`, `unit`, `currency`, `country` |
| Infra | `organization`, `tenant`, `company`, `userTenant` |

**Migrations:**
```bash
pnpm db generate   # generate migration from schema changes
pnpm db migrate    # apply migrations
```

---

## UI Components (`packages/ui/`)

### Platform (import from `@repo/ui/platform/*`)

| File | Export | Purpose |
|---|---|---|
| `command-registry.tsx` | `CommandProvider`, `useCommands`, `Command` | Register/execute keyboard commands |
| `focus-manager.tsx` | `FocusProvider`, `useFocus`, `FocusContextState` | Track active entity/record/area |
| `global-commands.tsx` | `GlobalCommands` | Alt+1/2/3/0 navigation, Ctrl+K, Alt+I |

**Register a command (inside useEffect):**
```ts
const { registerCommand } = useCommands();
useEffect(() => {
  return registerCommand({
    id: "create-record", scope: "context",
    label: { en: "New", de: "Neu" }, shortcut: "F3",
    isEnabled: (s) => s.entity === "address",
    handler: () => setShowCreate(true),
  });
}, [registerCommand]);
```

**Read/set focus:**
```ts
const { state, setFocus } = useFocus();
// state: { entity, recordId, panelId, area, rowIndex }
setFocus({ entity: "address", recordId: row.addressId, area: "grid" });
```

### Components (import from `@repo/ui/components/*`)

| Component | Key Props | Notes |
|---|---|---|
| `DataGrid` | `entityName`, `data`, `keyExtractor`, `title`, `emptyAction`, `panelId` | Auto-fetches column metadata; skeleton loading; empty state |
| `NavigationTree` | `entityName`, `data: TreeNode[]`, `header`, `onSelect` | Left panel tree; selected = primary fill |
| `ContextTabs` | `tabs: TabDef[]`, `defaultValue` | Tab bar + content area; count badge support |
| `InspectorPanel` | `title`, `recordId`, `fields`, `sections`, `actions` | Right-side detail panel |
| `EntityMask` | `entityName`, `recordId`, `mode`, `onCancel`, `onSaved`, `embedded` | Create/edit form; F10 save, Esc cancel |
| `TriViewWorkspace` | `left`, `upperRight`, `lowerRight` | 3-panel layout via react-resizable-panels |
| `ActionBar` | `crumbs`, `subCrumb` | Always-visible 36px breadcrumb + command pills |
| `StatusBar` | `tenantName` | 32px footer: tenant · module · recordId · version |
| `DocumentEditor` | `documentId`, `onClose` | Full-screen overlay: header form + lines grid |
| `ShortcutHelp` | — | `?` key → shortcut overlay (auto-wired via GlobalCommands) |
| `CommandPalette` | — | Ctrl+K → searchable command list (auto-wired) |
| `StatisticsModule` | — | Alt+I → right drawer with KPI cards (auto-wired) |

**Module route pattern** (all three modules follow this):
```tsx
// 1. Register commands in useEffect
// 2. Fetch data via useQuery
// 3. Render TriViewWorkspace:
<TriViewWorkspace
  left={<NavigationTree ... />}
  upperRight={<DataGrid ... />}
  lowerRight={
    <ContextTabs tabs={[
      { id: "detail", label: "Details", content: <InspectorPanel ... /> },
      { id: "contacts", label: "Contacts", content: <DataGrid entityName="addressContact" ... /> },
    ]} />
  }
/>
```

### Lib

| File | Exports |
|---|---|
| `lib/theme-provider.tsx` | `ThemeProvider`, `useTheme`, `AccentTheme` |
| `lib/utils.ts` | `cn(...)` — clsx + tailwind-merge |
| `styles/base.css` | All CSS variables + Tailwind v4 theme |

---

## i18n

**Setup:** `apps/web/src/lib/i18n.ts` — initializes i18next with EN/DE from `apps/web/src/locales/{en,de}.json`.

**In components:**
```ts
const { t, i18n } = useTranslation("ui");
const lang = i18n.language === "de" ? "de" : "en";
t("nav.addresses")          // → "Addresses" / "Adressen"
cmd.label[lang]             // → command label in current language
```

**Change language:**
```ts
i18n.changeLanguage("de");
localStorage.setItem("lang", "de");
```

---

## Design Tokens (Most-Used)

```
--primary         #533afd  CTAs, active states, focus rings
--canvas          #fff     Work surface
--canvas-soft     #f6f9fc  Headers, tree bg, table headers
--ink             #0d253d  Body text
--ink-mute        #64748d  Labels, captions
--hairline        #e3e8ee  Borders/dividers
--hairline-input  #a8c3de  Input borders
--destructive     #c43c4d  Errors
--ok              #2fa770  Online dot
--brand-dark-900  #1c1e54  AppBar (always dark)
```

**Selected row (DataGrid/Tree):**
```ts
// Tinted (DataGrid):
style={{ background: "color-mix(in oklab, var(--primary) 9%, transparent)", borderLeft: "2px solid var(--primary)" }}
// Solid (NavigationTree):
style={{ background: "var(--primary)", color: "var(--primary-fg)" }}
```

**Typography:** Inter 300 (body), JetBrains Mono (mono/kbd/IDs). All numbers: `tabular-nums`.

---

## Commands Cheatsheet

```bash
pnpm dev              # start dev server (runs docker compose too)
sudo docker compose up -d  # start postgres
pnpm lint             # oxlint type-aware — use as correctness check
vp fmt                # oxfmt format (runs auto on commit)
pnpm db generate      # generate migration
pnpm db migrate       # apply migrations
pnpm ui add <name>    # add shadcn component to packages/ui
```

---

## Key Conventions

- **No hard delete** — use `{ archived: true }` PATCH for business data
- **Tenant isolation** — always resolved server-side from session; never trust client payload
- **Commands not raw keys** — register via `CommandProvider`, never intercept `keydown` ad hoc (except F10/Esc inside EntityMask which owns its own form lifecycle)
- **Lint = correctness** — `pnpm lint` passing means changes work; don't build manually
- **Unused variables** — prefix with `_` to silence oxlint warnings
- **Type casting** — avoid `as`; fix at source or use `(x as any)` only for Better Auth's non-exported user extensions (`isSystemAdmin`)
- **Deps** — always add via `catalog:` in `pnpm-workspace.yaml`, then reference in package.json

---

## Deep-Dive Docs

| Topic | File |
|---|---|
| Architecture invariants | `.gemini/00_core_architecture.md` |
| Entity + metadata system | `.gemini/02_entity_introspection_and_generic_ui.md` |
| Full design token spec | `.gemini/design.md` |
| DB schema reference | `.gemini/schema.md` |
| Postgres patterns | `.gemini/postgres.md` |
| Implementation checklist | `.gemini/04_redesign.md` |
