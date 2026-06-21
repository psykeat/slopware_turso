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

| Phase                                    | State        | Commit / note                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 Protect tests                          | ✅           | `881135dd` document lifecycle + email compose tests; fixed `duplicateDocument` line-copy bug                                                                                                                                                                                                                                                            |
| 1 Core types                             | ✅           | `05f26f2c` literal-key `defineCapability`, `exposure.ai`, meta `entityName`/`writesTables`, `type-map.ts`                                                                                                                                                                                                                                               |
| 2 Server-fn + query layer                | ✅           | `b82d7c7f` `$executeCapability`, `capability(key)`, `queries/{keys,invalidate,capability}.ts`, `useCapabilityMutation`                                                                                                                                                                                                                                  |
| 3 Capability gaps                        | ✅           | `a39bf2af` communication.email, import.core, articleVariant.archiveBulk                                                                                                                                                                                                                                                                                 |
| 4 UI write migration                     | ✅           | `eff85be5` documents, `167887d4` import+accounting, `d6e0cfbc` variant-templates. **All duplicate ad-hoc business-write routes deleted.**                                                                                                                                                                                                               |
| 5 Read migration + delete /api/data      | ✅           | manifest+resolver+helpers, gap read-caps, by-id write-caps, enhanced list contract (orderBy/pagination/total/filterRules), all consumers migrated incl. document-editor + articles/addresses/documents/settings + email template reads; **`/api/data/$.ts` deleted** (`f9abe012`), `/api/admin/data` kept. `vp lint`: 0 errors, 7 pre-existing warnings |
| 6 AI projection + /api/ai/execute        | ✅           | `4df40639` 20 caps annotated (`exposure.ai`) + tool-name uniqueness test; `5aa71a15` `buildCapabilityTools` generator + tests; `26b33304` `/api/ai/execute` orchestrator; `be9347d1` deleted dead hand-written CRUD/mutation tools (kept bespoke mail-resolution scorers)                                                                               |
| 7 Idempotency enforcement                | ✅           | `35f56de0` `capability_execution_log` table (unique tenant+key) + migration `20260613134402`; `executeCapability` claim-pending/replay/conflict for non-read writes; Idempotency-Key header wired; `capabilities.idempotency.test.ts` (5 cases)                                                                                                         |
| 8 RLS pilot                              | ✅ (dormant) | `76f91803` ALS db proxy + tx-local GUC in `executeCapability` behind `CAPABILITY_RLS=1`; `e7c50f3b` migration `20260613173607_rls_pilot` (app_runtime role + ENABLE RLS + NULLIF policies on 5 tables) + `capabilities.rls.test.ts`. **Connection cutover (DATABASE_URL → app_runtime) NOT done — see follow-ups.**                                     |
| 9 Cleanup + guardrails + docs            | ✅           | `cd1d0052` schema docs regen; `b38e8c2f` `/api/data` fetch-regression guardrail test (runs in the tsx --test glob — chose a deterministic scan over an oxlint-native rule to avoid perturbing the vp lint baseline); AI_TESTING.md updated with `/api/ai/execute` + Idempotency-Key                                                                     |
| (deferred) email.tsx + doc email-compose | ⬜           | tangled w/ OAuth/webhooks/PDF render/job-queue; own phase; `/api/email/$` must survive                                                                                                                                                                                                                                                                  |

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
  POST/PATCH/DELETE on a _dynamic_ `entityName`, but capability ops are
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
4. **Add the 3 missing read caps** (emailTemplate\*) + an `addressContact.search`
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

RESOLVED — list-capability surface gap (user-approved "enhance shared contract").
`core/list.ts` adds a shared list contract: optional `orderBy`, `filterRules`,
offset pagination, and `withTotal` → `{ items, total? }`, all delegating to
DataService.list. Migrated the CRUD factories + the bespoke main lists
article/address/document. Helpers gained `entityListPage` (+ EntityListOptions
orderBy/filterRules/withTotal).

Consumers migrated so far (commits through `77a83645`): inline-edit-grid,
langtext-record-panel, customer-stats-section, inventory-balance-table,
address-picker-field, article-image-strip, article-images-tab, data-grid (export
pages through 200-row windows), lookup-field (search via entityList, resolve via
entityGet for the PK / filtered list for custom column), entity-mask (caps for
`/api/data`, raw fetch kept for `/api/admin/data`, postalCode→city via
entityList), accounting, email-templates, settings/variant-templates,
ai/useAiData, RecipientAutosuggest, setup/SetupGuide.

PHASE 5 COMPLETE. `/api/data/$.ts` is deleted; every consumer runs on the
capability runtime. `documentLine` create routes through a standalone cap backed
by `DocumentService.createDocumentLine` (returns `{ lines }`, incl. exploded BOM
rows). `sales.documentLine.create` reverted to plain insert for tracking/
allocation only. KEPT: `/api/admin/data/$.ts` (system-admin introspection; the
entity-mask branches to raw fetch when `apiBase === "/api/admin/data"`), the
`-address-contact-lookup` pure helper, `/api/me`, `/api/stats/*`, `/api/articles/*`
(binary/pricing/bom), `/api/setup/initialize`, `/api/metadata/*`.

Known follow-ups (not blocking): the `CapabilityKey` `no-redundant-type-
constituents` lint warning is inherent to factories typing `entityName` as
`string` (keys widen to `module.${string}.op`); harmless but could be tightened
later. The new `masterdata.editable` by-id caps and the `documentLine.create`
array shape mean generic `entitySave` is not used for documentLine.

Verify reminder: `base` tenant id in CLAUDE.md is stale for the local docker DB —
resolve by slug `base` (as capabilities.smoke.test.ts does) for in-process checks.

## Phase 6 — DONE (AI projection + /api/ai/execute)

- **Annotations** (`4df40639`): 20 caps carry `exposure.ai` across three groups —
  `sales-documents` (list/get/create/update/post/storno/convert/convertCandidates
  /pricing), `mail` (emailThread list/get/archive/markRead/link + addressContact
  .search), `catalog` (article/address get + search, address upsert). Confirmation
  stays derived from `exposure.llm === "confirm"`. Contract test guards AI
  tool-name uniqueness under the default `module_operation_entity` naming.
- **Generator** (`5aa71a15`): `buildCapabilityTools(ctx, options)` in
  `packages/agent/src/capability-tools.ts` projects AI-exposed caps into
  `@tanstack/ai` server tools that delegate to `executeCapability` with a
  server-built ctx (no `tenantId` reaches the model). Options: `group`, `keys`,
  `activeByDefaultOnly` (default true), `confirmMode` (`approval`|`exclude`|`allow`).
  `needsApproval` derived from `llm === "confirm"`. Tests in
  `capability-tools.test.ts` (incl. fail-closed delegation + no-tenantId-leak).
- **Orchestrator** (`26b33304`): `apps/web/src/routes/api/ai/execute.ts` (POST).
  Resolves the tenant/actor ctx via `resolveExecutionContext` (overridden to
  `actorMode:"assistant"`), builds the toolset, runs the agent loop, returns JSON
  or SSE. Confirm-gated caps EXCLUDED by default (no interactive approval channel
  on a REST call); opt in with `confirmMode`.
- **Deletion** (`be9347d1`): removed `tools.ts` + `mutations.ts` (dead generic
  CRUD/mutation tools duplicating caps). Kept the bespoke mail candidate-resolution
  tools (score/reason ranking, a read-layer concern) in `mail-resolution-tools.ts`.

Verify: 14 contract + 10 agent tests green; `pnpm run build:web` ✅; `vp lint`
0 errors, 7 pre-existing warnings.

### Phase 6 follow-ups (not blocking)

- **Live LLM smoke not run**: `/api/ai/execute` round-trip needs a running
  dev server + a configured provider (real API key). Wiring is build- and
  unit-verified; do a manual smoke when credentials are available (see
  `AI_TESTING.md`).
- **Legacy mail pipeline untouched**: `AIOrchestratorService` (interpret/resolve
  /review) + `runMailAgentLoop` (which uses the kept mail-resolution tools) remain
  the production mail path. `/api/ai/execute` is the new general capability path;
  folding the mail flow onto it (and onto generated tools) is a separate effort.
- The by-id `masterdata.editable` create/update caps stay `llm:"hidden"` — the AI
  write path is the natural-key `upsert`.

## Phase 7 — DONE (idempotency enforcement)

- **Table** (`35f56de0`): `capability_execution_log` (migration
  `20260613134402_rich_may_parker`, applied locally) — `uuidv7` pk, `tenant_id`
  FK, `idempotency_key`, `capability_key`, `input_hash` (sha256 of canonicalized
  input), `status` (`pending`|`completed`), `result` jsonb (stored `{data,meta}`),
  timestamps. Unique index `uq_capability_execution_log_key` on
  (`tenant_id`,`idempotency_key`) is the concurrency guard.
- **Enforcement** (`core/execute.ts`): when `ctx.idempotencyKey` is set and the
  capability is a non-read, non-dryRun op, `runWithIdempotency` inserts a pending
  claim (`onConflictDoNothing`). Owner runs the handler then completes the row
  (or deletes it on failure — only successes are cached). A conflict means
  replay (`meta.replayed = true`), in-flight (`conflict`), or key-reuse with a
  different request (`conflict`, hash/key mismatch). Reads + dryRuns never touch
  the log.
- **Wiring**: HTTP `/api/capabilities/$key/execute` reads the standard
  `Idempotency-Key` header (body field fallback); `$executeCapability` server fn
  accepts an optional `idempotencyKey`. `ExecutionContext.idempotencyKey` +
  `CapabilityMeta.replayed` added to the core types.

Verify: 34 in-process capability tests green (incl. 5 new idempotency cases);
`pnpm run build:web` ✅; `vp lint` 0 errors, 7 pre-existing warnings. NOTE: the
generated `.agents/schema*` docs were deliberately NOT regenerated here (a
`pnpm run docs` pass surfaces pre-existing drift in unrelated tables — keep that
a separate housekeeping commit).

## Phase 8 — DONE but DORMANT (RLS pilot) ⚠️

- **Plumbing** (`76f91803`): `index.ts` exports an AsyncLocalStorage-bound Proxy
  over drizzle — inside `runWithDbTx(tx, fn)` every global-`db` query routes to
  `tx`; with no store it is identical to before. `dbTransaction` opens on the
  base connection. `executeCapability`, behind `CAPABILITY_RLS=1` (default OFF),
  wraps the whole execution in one tx that sets a transaction-local
  `app.tenant_id` via `set_config(..., true)`. Nested service transactions
  become savepoints and inherit the GUC.
- **Migration + policies** (`e7c50f3b`): `20260613173607_rls_pilot` — NOLOGIN
  `app_runtime` role (granted to owner for `SET ROLE`), `ENABLE` (not `FORCE`)
  RLS on address/article/document/document_line/email_thread with policy
  `tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid`. The
  `NULLIF` empty-string guard is load-bearing: a pooled connection reports a
  previously-set local GUC as `''` after the tx, so without it an unscoped query
  would error on `''::uuid` instead of failing closed to zero rows.
- **Proof** (`capabilities.rls.test.ts`, 5 cases via `SET ROLE app_runtime`):
  own-tenant-only visibility, no-GUC→0 rows, `WITH CHECK` blocks cross-tenant
  moves, owner bypasses RLS, proxy routes global `db`→active tx.

Verify: 39 capability tests green flag-off (incl. 5 RLS); 13 write-heavy green
with `CAPABILITY_RLS=1`; `build:web` ✅; `vp lint` 0 errors, 7 pre-existing warns.

### Phase 8 follow-ups before this enforces in production (the risky cutover)

RLS is **dormant**: the app still connects as the owner (bypasses RLS) and
`CAPABILITY_RLS` is off. To actually enforce, all of the below must land first:

1. **Audit every non-capability DB path** (jobs, seeds, scripts, `/api/me`,
   `/api/stats`, `/api/admin/data`, `/api/articles`, auth, the email/AI mail
   pipeline, `AIOrchestratorService`) — under `app_runtime` they'd hit RLS and
   either need the GUC set or to keep using an owner/bypass connection.
2. Grant `app_runtime` DML on **all** tables it must touch (only the 5 pilot
   tables are granted today) and decide owner-vs-app_runtime per connection.
3. Provision an `app_runtime` **LOGIN** role + secret and point a dedicated
   runtime `DATABASE_URL` at it (the migration role stays owner so migrations
   keep bypassing RLS).
4. Flip `CAPABILITY_RLS=1` for the runtime and roll out gradually.
   Consider `FORCE ROW LEVEL SECURITY` only after the cutover is proven.

## Phase 9 — DONE (cleanup + guardrails + docs)

- **Guardrail** (`b38e8c2f`): `capabilities.guardrails.test.ts` scans apps/web,
  packages/ui and packages/agent and fails if a direct `fetch("/api/data…")`
  reappears (the route deleted in Phase 5). Runs in the existing `tsx --test`
  glob. Chose a deterministic scan over an oxlint `no-restricted-syntax` rule
  because `vp lint` has no root `.oxlintrc.json` and adding one risks changing
  the whole-repo lint baseline — a native rule can be layered in later if wanted.
- **Docs** (`cd1d0052`): regenerated `.agents/schema*` / `.gemini/schema.md`
  (adds `capability_execution_log`, clears pre-existing drift). `AI_TESTING.md`
  now documents `/api/ai/execute` and the `Idempotency-Key` header.

## Refactor status: Phases 0–9 complete.

The capability runtime is the single execution path; the only deliberately kept
exceptions are documented (`/api/admin/data`, binary/PDF/OAuth/webhook routes,
the bespoke mail-resolution scorers). Remaining optional/risky work is captured
above: the **RLS connection cutover** (Phase 8 follow-ups — keep RLS dormant
until done), folding the legacy mail pipeline onto `/api/ai/execute`, a live LLM
smoke of `/api/ai/execute`, and (if desired) an oxlint-native no-fetch rule.
