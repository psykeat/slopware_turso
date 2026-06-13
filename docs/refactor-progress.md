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
| 5 Read migration + delete /api/data | ⏭ NEXT | see below |
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

## Phase 5 — next step (start here)
5a. Build read-capability `queryOptions` factories for business reads/lookups
    (`sales.document.{list,get,tree}`, `/api/articles/search`,
    `/api/addresses/search`, addressContact search) using
    `capabilityQueryOptions` from `apps/web/src/queries/capability.ts`.
5b. Generic TriView grids: an `entityListOptions(entityName, filters)` that maps
    to `${module}.${entity}.list`; add any missing list/get/create/patch/delete
    capabilities (the CRUD factories in `accounting.core.ts` / `sales.document-line.ts`
    show the pattern); migrate the `/api/data` consumers; then `git rm` the
    `/api/data/$` route. Decide `/api/admin/data/$` (keep as admin exception).
First action for a fresh session: launch one Explore agent to enumerate all
`/api/data` consumers and which entities already have list/get/create/patch
capabilities vs. which are missing.
