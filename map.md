# slopware — Project Map

Fast-path reference for agents. No prose, no repetition. Read this first; drill into linked files only when needed.

---

## Monorepo Layout

```
apps/web/          TanStack Start SSR app (entry point)
packages/auth/     Better Auth config + TanStack helpers
packages/db/       Drizzle ORM schema, migrations, services
packages/ui/       Shared React component library
services/llm/      Python-based LLM service
tooling/tsconfig/  Base tsconfig
vite.config.ts     Oxlint + Oxfmt config (root, affects all)
```

**Import aliases:**

- `@repo/ui/*` → `packages/ui/*`
- `@repo/auth/*` → `packages/auth/src/*`
- `@repo/db/*` → `packages/db/src/*`
- `#/` → `apps/web/src/`

## Quick Docs

- [`AGENTS.md`](AGENTS.md) — startup rules and doc routing
- [`.agents/decision-index.md`](.agents/decision-index.md) — short current decision summary
- [`.agents/archive/`](.agents/archive/) — historical docs only

---

## Route Hierarchy (`apps/web/src/routes/`)

```
__root.tsx                     Shell: ThemeProvider, I18nextProvider, CommandProvider, FocusProvider
index.tsx                      → redirect to /app
_auth/route.tsx                Guard: ensureQueryData(authQueryOptions()), returns { user } to context
_auth/app/route.tsx            AppBar + ActionBar + StatusBar shell; AppLayout component
_auth/app/index.tsx            → redirect to /app/addresses
_auth/app/addresses.tsx        Addresses module (TriView)
_auth/app/articles.tsx         Articles module (TriView)
_auth/app/documents.tsx        Documents module (TriView)
_auth/app/settings/index.tsx   Settings (helper tables sidebar + DataGrid)
_auth/app/settings/account.tsx Account self-service page
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
api/stats/dashboard.ts         KPI summaries
api/stats/address/{id}.ts      Address-specific stats
api/stats/article/{id}.ts      Article-specific stats
api/documents/tree.ts          Hierarchical document relations
api/me.ts                      GET /api/me → { tenantName, orgName }
```

**Route context:** `const { user } = Route.useRouteContext()` — available in all `_auth/**` routes.

---

## API Quick Reference

| Endpoint                            | Auth          | Returns                             |
| ----------------------------------- | ------------- | ----------------------------------- |
| `GET /api/data/{entity}`            | session       | `T[]` — tenant-scoped list          |
| `POST /api/data/{entity}`           | session       | created record                      |
| `PATCH /api/data/{entity}/{id}`     | session       | patched record                      |
| `GET /api/metadata/fields/{entity}` | session       | `FieldDef[]`                        |
| `GET /api/admin/data/{entity}`      | isSystemAdmin | `T[]` — cross-tenant                |
| `GET /api/stats/dashboard`          | session       | Global KPIs                         |
| `GET /api/me`                       | session       | `{ tenantId, tenantName, orgName }` |
| `GET /api/capabilities`             | session       | Capability catalog + JSON Schemas   |
| `POST /api/capabilities/{key}/execute` | session    | `CapabilityResult` envelope — see `.agents/07_api.md` |

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

---

## Auth

| File                                    | Purpose                  |
| --------------------------------------- | ------------------------ |
| `packages/auth/src/auth.ts`             | betterAuth server config |
| `packages/auth/src/auth-client.ts`      | authClient (browser)     |
| `packages/auth/src/tanstack/queries.ts` | `authQueryOptions()`     |

---

## Database

**Schema files:** `packages/db/src/schema/app.schema.ts` + `auth.schema.ts`

**Services:**

```
packages/db/src/services/data.ts              DataService — tenant-scoped CRUD
packages/db/src/services/document-service.ts  DocumentService — line items, totals, status
packages/db/src/services/metadata.ts          MetadataService — field defs per entity
packages/db/src/services/tenant.ts            getTenantContext(), getUserTenantInfo()
```

**Key entities (tenant-scoped):**

| Domain    | Entities                                                             |
| --------- | -------------------------------------------------------------------- |
| Addresses | `address`, `addressContact`, `addressCategory`                       |
| Articles  | `article`, `articleGroup`, `articleBom`                              |
| Documents | `document`, `documentLine`, `documentType`, `documentGroup`          |
| Inventory | `inventoryMovement`, `inventoryBalance`                              |
| Finance   | `glAccount`, `journalEntry`, `journalLine`, `paymentTerm`, `taxCode` |
| Infra     | `organization`, `tenant`, `company`, `userTenant`                    |

---

## UI Components (`packages/ui/`)

### Platform (import from `@repo/ui/platform/*`)

| File                   | Export                                      | Purpose                           |
| ---------------------- | ------------------------------------------- | --------------------------------- |
| `command-registry.tsx` | `CommandProvider`, `useCommands`, `Command` | Keyboard commands                 |
| `focus-manager.tsx`    | `FocusProvider`, `useFocus`                 | Focus tracking                    |
| `global-commands.tsx`  | `GlobalCommands`                            | Global Hotkeys (Alt+1..9, Ctrl+K) |

### Components (import from `@repo/ui/components/*`)

| Component               | Purpose                                         |
| ----------------------- | ----------------------------------------------- | ---- | ----- |
| `DataGrid`              | Entity list with auto-columns, filters, sorting |
| `NavigationTree`        | Hierarchical sidebar (groups, categories)       |
| `EntityMask`            | Create/Edit form with F10/Esc handlers          |
| `InspectorPanel`        | Right-side detail view                          |
| `DocumentEditor`        | Full-screen header/lines editor                 |
| `StatisticsModule`      | Alt+I drawer with KPI cards                     |
| `InventoryBalanceTable` | Aggregated stock levels                         |
| `StockLedgerTable`      | Detailed movement history                       |
| `CustomerStatsSection`  | Sales history + top articles                    |
| `TriViewWorkspace`      | 3-panel layout (Tree                            | Grid | Tabs) |
| `ActionBar`             | Breadcrumbs + Command pills                     |
| `FeedbackModal`         | Report bugs/improvements                        |

---

## i18n

**Setup:** `apps/web/src/lib/i18n.ts` — EN/DE support.

**In components:** `const { t } = useTranslation("ui");`

---

## Design Tokens

- `--primary`: `#533afd` (Action)
- `--canvas`: `#ffffff` (BG)
- `--ink`: `#0d253d` (Text)
- `--hairline`: `#e3e8ee` (Border)
- Typography: Inter (UI), JetBrains Mono (Data).

---

## Commands

`pnpm dev`, `pnpm lint`, `pnpm db generate/migrate`, `pnpm ui add <name>`
