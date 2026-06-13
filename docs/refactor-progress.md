# Capability-Runtime Refactor — Live Progress / Handoff

> Durable resume point. Any fresh session can read this + `git log` + run the
> verify commands and continue at full quality. Update the status table and the
> "next step" note after every committed sub-step.

## Goal (one line)
Route every business operation through the Capability Runtime: UI uses TanStack
Start **server functions** (`capability(key)` from `apps/web/src/server-fns/capabilities.ts`),
shared `packages/ui` uses the **HTTP execute** client (`packages/ui/lib/capability-client.ts`),
external/AI use the same `executeCapability` core. Delete duplicate ad-hoc routes.

## The canonical migration recipe (apply this every time)
1. Find the ad-hoc `fetch("/api/...")` call + its route handler.
2. Confirm a capability exists for that operation (`packages/db/src/capabilities/modules/*`).
   If not, add one that **delegates to the existing service only** (no new business
   logic), register it in `packages/db/src/capabilities/all.ts`, add a scenario test.
3. Replace the fetch:
   - In `apps/web/**` → `import { capability } from "#/server-fns/capabilities"`,
     call `await capability("module.entity.op")(input)`. For meta-driven cache
     invalidation use `callCapability` + `invalidateAfterCapability(queryClient, meta)`.
   - In `packages/ui/**` → `import { executeCapability } from "../lib/capability-client"`,
     call `await executeCapability("module.entity.op", input)` → `{ data, meta }`.
   - Never send `tenantId` — it is resolved server-side.
4. When the route has **no remaining consumers**, `git rm` it. Keep routes that
   serve binary/PDF, OAuth callbacks, webhooks, or external integrations.
5. Verify (below), then commit. One route group per commit.

## Verify commands
```bash
# in-process capability tests (contract/scenario/coverage/smoke)
cd packages/db && pnpm exec tsx --test src/capabilities/*.test.ts
# build the app (catches type + import errors across web+ui)
pnpm run build:web
# keep entity_commands projection in sync after adding capabilities
cd packages/db && pnpm run sync:capabilities
# HTTP smoke needs a running dev server (pnpm run dev:web) + a started Postgres
#   docker compose up -d db   # if connection refused on :5432
```
Lint once at the very end of a phase: `vp lint` (never mid-phase).

## Phase status
| Phase | State | Commit / note |
|---|---|---|
| 0 Protect tests | ✅ | `881135dd` document lifecycle + email compose tests; fixed `duplicateDocument` line-copy bug |
| 1 Core types | ✅ | `05f26f2c` literal-key `defineCapability`, `exposure.ai`, meta `entityName`/`writesTables`, `type-map.ts` |
| 2 Server-fn + query layer | ✅ | `b82d7c7f` `$executeCapability`, `capability(key)`, `queries/{keys,invalidate,capability}.ts`, `useCapabilityMutation` |
| 3 Capability gaps | ✅ | `a39bf2af` communication.email, import.core, articleVariant.archiveBulk |
| 4 UI write migration | ✅ | `eff85be5` documents, `167887d4` import+accounting, `d6e0cfbc` variant-templates. **All duplicate ad-hoc business-write routes deleted.** |
| 5 Read migration + delete /api/data | 🟡 in progress | search caps `89aaac8f`; manifest+helper+grid+gap-caps+by-id-write-caps landed (`7c901a9e`→`1df3de25`). **BLOCKED on list-capability surface gap** for paginated grids — see below |
| 6 AI projection + /api/ai/execute | ⬜ | annotate ~20-25 caps with `exposure.ai`; `packages/agent` tool generator + orchestrator; delete hand-written tools |
| 7 Idempotency enforcement | ⬜ | `capabilityExecutionLog` table; honor `ctx.idempotencyKey` replay |
| 8 RLS pilot | ⬜ HIGH RISK | `runWithTenantContext` + AsyncLocalStorage db proxy in `executeCapability`; then RLS on 5 tables w/ `app_runtime` role |
| 9 Cleanup + guardrails + docs | ⬜ | ESLint no-fetch rules, AI_TESTING.md, finalize plan docs |
| (deferred) email.tsx + doc email-compose | ⬜ | tangled w/ OAuth/webhooks/PDF render/job-queue; own phase; `/api/email/$` must survive |

## Key conventions / gotchas
- `capability(key)` input/output types are inferred from `CapabilityIndex` in
  `packages/db/src/capabilities/type-map.ts` (type-only import; never pulls
  handlers into the client bundle). Cast awkward payloads with `as never` on
  input and `as unknown as T` on output where a hand-written UI type diverges.
- Query-key root stays `["data", entityName, ...]` so capability reads and the
  legacy `/api/data` reads invalidate together during migration.
- `exposure.llm === "confirm"` is the single source of "needs confirmation";
  never add a second flag.
- `articles.tsx` / `addresses.tsx` writes go through the **generic `/api/data`**
  CRUD route (via `patchEntity`/`createEntity` hooks) — they are migrated as
  part of Phase 5, not as separate routes.

## Phase 5 — remaining work (generic TriView grid + delete /api/data)

DONE (commit `89aaac8f`): the three dedicated search endpoints are now
`masterdata.{article,address,deliveryAddress}.search` read capabilities.

### Scope facts (from recon)
- **Capability CRUD coverage is 35/38 entities** — almost everything the grid
  touches already has list/get/create/update/archive caps (via the `crud()` /
  `makeCrud()` / `makeSystemEntityCapabilities()` factories in
  `accounting.core.ts`, `sales.document-line.ts`, `masterdata.remaining.ts`,
  `system.core.ts`). **Missing:** `emailTemplate`, `emailTemplateBinding`,
  `emailTemplateRenderLog` (read-only in UI) and a dedicated `addressContact`
  search (the special `?q=` handler embedded in `/api/data/$.ts` lines ~42-122).
- **THE WRINKLE (why this is the risky piece):** the generic grid does
  POST/PATCH/DELETE on a *dynamic* `entityName`, but capability ops are
  heterogeneous: `article`/`address`/`currency`/`articleGroup` expose
  `upsert`+`archive` (not `create`/`update`/`delete`), the module prefix varies
  (`masterdata.` vs `sales.` vs `system.` vs `logistics.`), and some entities
  are read-only (inventoryBalance/Movement). The introspective `DataService`
  deliberately hid all this; capabilities make it explicit per entity. So a
  generic grid client needs a runtime entity→op→key resolution.

### Recommended approach (manifest-backed, low-risk)
1. **Generate a pure-string manifest** `entityName → { module, ops: { list, get,
   create?, upsert?, update?, archive?, delete? } -> capabilityKey }` from the
   registry. It must import NOTHING at runtime (strings only) so it is
   bundle-safe for the client. Emit `packages/db/src/capabilities/manifest.generated.ts`
   via a script that imports `allCapabilities` at generation time; expose a
   package export `@repo/db/capabilities/manifest`. Guard drift with a contract
   test that regenerates in-memory and compares.
2. **`packages/ui/lib/entity-capabilities.ts`**: `entityList(entityName, filters)`,
   `entityGet(entityName, id)`, `entitySave(entityName, id|null, values)` (picks
   `upsert` if present, else create/update by id presence), `entityDelete(
   entityName, id)` (picks `archive` else `delete`). All resolve via the manifest
   and call `executeCapability` (HTTP).
3. **Migrate the chokepoints** (in this order, commit each):
   - `packages/ui/components/inline-edit-grid.tsx` — the single biggest win
     (~15 sub-grids); replace its POST/PATCH/DELETE `/api/data/...` with
     `entitySave`/`entityDelete`.
   - The 3 TriView page grid reads: `_auth/app/{articles,addresses,documents}.tsx`
     (each has an inline `useQuery` → `fetch("/api/data/<entity>?...")`).
   - `packages/ui/components/langtext-record-panel.tsx` (PATCH `/api/data`).
   - lookup/util components: `lookup-field.tsx`, `entity-mask.tsx`,
     `customer-stats-section.tsx`, `article-images-tab.tsx`,
     `article-image-strip.tsx`, `inventory-balance-table.tsx`, settings/index.tsx.
4. **Add the 3 missing read caps** (emailTemplate*) + an `addressContact.search`
   cap before deletion.
5. **`git rm apps/web/src/routes/api/data/$.ts`** only when no consumer remains.
   **Keep `/api/admin/data/$.ts`** as the deliberate system-admin introspection
   exception.

### Other Phase 5 reads still on fetch (lower priority, migrate opportunistically)
`documents.tsx` still reads `/api/data/{company,address,documentGroup,warehouse}`
and `/api/me`; `document-editor.tsx` reads many lookups via `/api/data`. These
fold into step 3 above once `entityList`/`entityGet` exist.

> Recommended: do step 1-2 (manifest + helper) in one commit, then one
> chokepoint per commit. A fresh session is ideal for this — read this doc,
> `git log`, then start at step 1.

### Phase 5 — progress + the surface gap (live)
DONE (commits `7c901a9e` … `1df3de25`):
- `manifest.generated.ts` (`@repo/db/capabilities/manifest`) + drift test; build
  script `pnpm run generate:manifest`.
- `@repo/db/capabilities/entity-ops` shared resolver. It introspects each input
  schema at generation time and bakes per-op shape facts into the manifest:
  `idParam` (entity-specific record-id key) and `filtersWrapped` (list FK filters
  go under `{filters}` vs. flat fields). Two thin helpers consume it:
  `packages/ui/lib/entity-capabilities.ts` (HTTP) and
  `apps/web/src/lib/entity-capabilities.ts` (server fn `$executeCapability`).
- Read-cap gaps filled: `masterdata.addressContact.search`,
  `sales.documentType/documentGroup` (list/get), `communication.emailTemplate
  /Binding/RenderLog` (list/get).
- **By-id write caps** added for the natural-key entities (article, address,
  currency, articleGroup, country, unit, priceList) — `create`+`update`
  delegating to DataService, `llm:"hidden"` (AI write stays `upsert`). User-
  approved: these are needed because the generic mask/langtext/grids edit those
  by id, exactly as `/api/data` did.
- Migrated to the runtime: `inline-edit-grid`, `langtext-record-panel`,
  `customer-stats-section`, `inventory-balance-table`, `address-picker-field`,
  `article-image-strip`, `article-images-tab`.

⚠️ **BLOCKER — list-capability surface gap.** The paginated/sortable grids can't
migrate yet: apps/web `{articles,addresses,documents}` main lists use
`paginated/page/limit/orderBy/search/filters(JSON filterRules)` and expect
`{ data, total }`; `data-grid` CSV export uses `orderBy`+`filterRules`;
`lookup-field` uses `orderBy`. The capability `list` ops return only `{ items }`
with a fixed `orderBy`, no `total`, no `filterRules`. Resolving this needs a
decision on enhancing the shared list contract (add `orderBy`, pagination+`total`,
`filterRules`) across the factory `list` caps + their output schema — paused for
user input.

STILL ON /api/data (pending the above): `lookup-field`, `data-grid` (export),
`entity-mask`, `document-editor`, apps/web `{articles,addresses,documents}`,
`email-templates`, `accounting`, `settings/index`, `settings/variant-templates`,
`email.tsx` (deferred), `components/ai/hooks/useAiData`, `setup/SetupGuide`,
email recipient autocomplete/suggest, `queries/keys.ts`. Delete `/api/data/$.ts`
(keep `/api/admin/data/$.ts`) once all are migrated.
