# Capability Registry & Execution API

## Purpose

This document specifies the tenant-scoped capability layer: a code-first registry of official business operations and a single execution path that serves UI routes, AI agents, automated tests, import interfaces, and (phase 3) external programs. It implements the "controlled domain commands" requirement from `00_core_architecture.md` and the "server owns command execution" invariant from `ai.md`.

Status: Phases 1–2 implemented (2026-06-11). Phase 3+ items are listed at the end.

## Position in the architecture

```
Domain Services (packages/db/src/services/*)        ← business truth, own transactions
        ▲
Capability Registry (packages/db/src/capabilities/) ← describes + validates official operations
        ▲
executeCapability(key, ctx, input)                  ← the ONE execution path
        ▲                ▲                ▲                ▲
   HTTP routes      AI agents        node:test        ImportService
   (apps/web)       (@repo/agent,    (in-process)     (phase 3+,
                     phase 3)                          actorMode "system")
```

Principles:

- **Domain services stay the truth.** Capabilities are thin, validated wrappers around existing service functions/classes. No business logic lives in the capability layer.
- **Code-first registry.** Capabilities are TypeScript values defined next to the services they wrap. The `entity_commands` table is a *projection* of the registry, never a second source of truth.
- **One validation point.** Input is validated exactly once, in `executeCapability`, with Zod schemas. Services that self-validate (e.g. variant templates) share the *same imported schema* — schemas are never duplicated.
- **Tenant context is server-built.** An `ExecutionContext` is constructed only from session, API-key metadata (phase 3), or test fixtures. Capability inputs never contain `tenantId`.

## Source layout

```
packages/db/src/capabilities/
  core/types.ts            ExecutionContext, CapabilityDefinition, CapabilityResult,
                           CapabilityError, toCapabilityRole()
  core/define.ts           defineCapability() — derives the key, rejects writes without writesTables
  core/registry.ts         registerCapabilities(), getCapability(), listCapabilities()
  core/execute.ts          executeCapability() — gates, validation, error mapping
  core/json-schema.ts      capabilityDescriptor(), Zod→JSON-Schema via z.toJSONSchema (Zod v4)
  modules/masterdata.article.ts            wraps DataService for the article entity
  modules/masterdata.variant-template.ts   wraps services/variant-template.ts
  index.ts                 static module imports → registration; public exports
  sync-entity-commands.ts  registry → entity_commands projection
  manifest-build.ts        manifest generation and serialization logic
  sdk-build.ts             Client SDK generation and serialization logic
  capabilities.contract.test.ts   registry-wide invariants (no fixtures)
  capabilities.scenario.test.ts   real-DB scenarios with throwaway tenant fixtures
  capabilities.coverage.test.ts   coverage ratchet over audited services
  capabilities.smoke.test.ts      live-data smoke test against the base tenant
  http/capability-client.ts       thin HTTP client for tests (login + 3 endpoints)
  http/article-capability.smoke.test.ts   HTTP surface smoke test (needs dev server)

apps/web/src/lib/capability-auth.ts             resolveExecutionContext(request)
apps/web/src/lib/sdk.generated.ts               generated E2E type-safe Client SDK
apps/web/src/routes/api/capabilities.ts         GET  /api/capabilities
apps/web/src/routes/api/capabilities/$key.ts    GET  /api/capabilities/{key}
apps/web/src/routes/api/capabilities/$key/execute.ts  POST /api/capabilities/{key}/execute

packages/db/src/scripts/sync-capabilities.ts    script entry; chained into `migrate`
packages/db/src/scripts/generate-client-sdk.ts  Client SDK generation entry point
```

Import path: `@repo/db/capabilities` (export added in `packages/db/package.json`).

## Core types

```ts
type ActorMode = "user" | "assistant" | "system" | "test" | "external";

interface ExecutionContext {
  tenantId: string;
  organizationId: string;
  userId: string | null;            // null for system/test/external actors
  actorMode: ActorMode;
  role: "tenant_user" | "tenant_admin" | "system"; // resolved server-side, never from caller input
  requestId?: string;
  dryRun?: boolean;
}

interface CapabilityDefinition<I extends z.ZodType, O extends z.ZodType> {
  key: string;            // ALWAYS `${module}.${entityName}.${operation}` — derived, not declared
  module: "masterdata" | "sales" | "logistics" | "accounting" | "system";
  entityName: string;     // schema export name, e.g. "articleVariantTemplate"
  operation: string;      // becomes entity_commands.command_key
  kind: "read" | "create" | "update" | "archive" | "process";
  summary: { en: string; de: string };
  description?: { en: string; de: string };
  input: I;               // Zod schema — the single validation point
  output: O;              // Zod schema — checked outside production / for test actors
  writesTables: string[]; // entity names; required (enforced) for every non-read capability
  sideEffects: string[];
  idempotent: boolean;
  supportsDryRun: boolean;
  minRole: "tenant_user" | "tenant_admin";
  exposure: {
    llm: "safe" | "confirm" | "hidden";  // confirm = needs human approval in agent flows
    http: boolean;                       // false = in-process only, invisible over HTTP
    ui?: { placement?: string; icon?: string };
  };
  schemaVersion: number;  // bump ONLY on breaking changes; additive-optional changes don't count
  handler: (ctx: ExecutionContext, input: z.output<I>) => Promise<z.output<O>>;
}

type CapabilityResult<T> =
  | { ok: true; data: T; meta: { capability; schemaVersion; dryRun; durationMs } }
  | { ok: false; error: { code: CapabilityErrorCode; message: string;
        issues?: { path: string; message: string }[] } };

type CapabilityErrorCode =
  "unknown_capability" | "forbidden" | "validation" | "not_found" | "conflict" | "internal";
```

`defineCapability()` derives `key` from `module.entityName.operation`, making key drift impossible by construction, and throws at registration time if a non-read capability declares no `writesTables`.

## Defining a capability

```ts
// packages/db/src/capabilities/modules/masterdata.variant-template.ts
export const variantTemplateCreate = defineCapability({
  module: "masterdata",
  entityName: "articleVariantTemplate",
  operation: "create",
  kind: "create",
  summary: { en: "Create a variant template", de: "Variantenvorlage anlegen" },
  input: z.object({
    slug: z.string().trim().min(1),
    label: z.string().trim().min(1),
    articleGroupId: z.uuid().nullable().optional(),
    definition: variantTemplateDefinitionSchema, // REUSED from variant-template-schema.ts
  }),
  output: templateRecordSchema,
  writesTables: ["articleVariantTemplate"],
  sideEffects: [],
  idempotent: false,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: (ctx, input) => createVariantTemplate(ctx.tenantId, input),
});
```

Registration is static: a capability exists exactly when its module array is imported in `capabilities/index.ts`. A renamed or removed service function is a compile error in the handler — that is the primary drift defense.

For handlers, throw `CapabilityError(code, message, issues?)` for typed non-internal errors (`not_found`, `conflict`, `validation`, `forbidden`). Untyped errors are mapped heuristically (see below) or become `internal`.

## Execution semantics

`executeCapability(key, ctx, rawInput)` runs these gates **in order**:

1. **Registry lookup** → `unknown_capability`.
2. **Role gate**: `actorMode` `system`/`test` always passes; otherwise `ctx.role` must rank ≥ `minRole` → `forbidden`.
3. **Input validation**: `input.safeParse(rawInput)` → `validation` with Zod issues mapped to `{ path, message }`. Routes never re-validate.
4. **dryRun check**: `ctx.dryRun` without `supportsDryRun` → `validation`.
5. **Handler** in try/catch. Error mapping:
   - `CapabilityError` → its code/issues, as thrown.
   - `VariantTemplateValidationError` (has `errors: string[]`) → `validation`.
   - postgres.js SQLSTATE `23505` (unique violation) → `conflict`.
   - message matching `/not found/i` → `not_found`; `/is archived/i` → `conflict`.
   - everything else → `internal` (message replaced with `"Internal error"` for `actorMode: "external"`).
6. **Output contract guard**: `output.safeParse(data)` runs only when `NODE_ENV !== "production"` or `actorMode === "test"`. A mismatch returns `internal` with `"violated its output contract"` — catches contract drift in dev/CI at zero production cost.

**Transactions**: the capability layer NEVER opens transactions. `DataService`/`DocumentService` own `db.transaction` internally; wrapping would nest on the postgres.js driver. An operation that needs multi-step atomicity must become its own capability backed by one service method.

**Idempotency**: `idempotent: true` is currently descriptive (natural-key upsert, merge-only apply). The HTTP envelope accepts `idempotencyKey` for forward compatibility; enforcement via an execution-log table is phase 4.

## Implemented capabilities (current registry)

The registry is now fully populated for the inventory already enumerated in the codebase. Capability families are grouped below by domain.

### Masterdata

- `masterdata.article.*`: `get`, `list`, `upsert`, `archive`
- `masterdata.articleVariantTemplate.*`: `list`, `get`, `create`, `update`, `applyToArticle`
- `masterdata.address.*`: `list`, `get`, `upsert`, `archive`
- `masterdata.addressCategory.*`: `list`, `get`, `create`, `update`, `archive`
- `masterdata.addressContact.*`: `list`, `get`, `create`, `update`, `archive`
- `masterdata.deliveryAddress.*`: `list`, `get`, `create`, `update`, `archive`
- `masterdata.articleGroup.*`: `list`, `get`, `create`, `update`, `archive`
- `masterdata.articleBom.*`: `list`, `get`, `create`, `update`, `archive`
- `masterdata.articleCategory.*`: `list`, `get`, `create`, `update`, `archive`
- `masterdata.articleImage.*`: `list`, `get`, `create`, `update`, `archive`
- `masterdata.articleMedia.*`: `list`, `get`, `create`, `update`, `archive`
- `masterdata.articleOption.*`: `list`, `get`, `create`, `update`, `archive`
- `masterdata.articleOptionValue.*`: `list`, `get`, `create`, `update`, `archive`
- `masterdata.articleVariant.*`: `list`, `get`, `update`, `archive`, `generateVariants`, `previewVariants`, `copyVariantAxes`, `pricing`
- `masterdata.articleVariantOptionValue.*`: `list`, `get`, `create`, `delete`
- `masterdata.bankAccount.*`: `list`, `get`, `create`, `update`, `archive`
- `masterdata.category.*`: `list`, `get`, `create`, `update`, `archive`
- `masterdata.country.*`: `list`, `get`, `upsert`, `archive`
- `masterdata.currency.*`: `list`, `get`, `upsert`, `archive`
- `masterdata.fiscalPeriod.*`: `list`, `get`, `create`, `update`
- `masterdata.incoterm.*`: `list`, `get`, `create`, `update`, `archive`
- `masterdata.industry.*`: `list`, `get`, `create`, `update`, `archive`
- `masterdata.numberSequence.*`: `list`, `get`, `create`, `update`, `archive`
- `masterdata.paymentTerm.*`: `list`, `get`, `create`, `update`, `archive`
- `masterdata.postalCode.*`: `list`, `get`, `create`, `update`, `archive`
- `masterdata.priceList.*`: `list`, `get`, `upsert`, `archive`
- `masterdata.priceListItem.*`: `list`, `get`, `create`, `update`
- `masterdata.productionOrder.*`: `list`, `get`, `create`, `update`, `archive`
- `masterdata.shippingMethod.*`: `list`, `get`, `create`, `update`, `archive`
- `masterdata.taxClass.*`: `list`, `get`, `create`, `update`, `archive`
- `masterdata.taxCode.*`: `list`, `get`, `create`, `update`, `archive`
- `masterdata.taxRule.*`: `list`, `get`, `create`, `update`
- `masterdata.unit.*`: `list`, `get`, `upsert`, `archive`
- `masterdata.warehouse.*`: `list`, `get`, `create`, `update`, `archive`

Notes:

- `upsert` is only used where a natural key is clearly defined and stable (`articleNo`, `addressNo`, `code`, `name`, etc.).
- `archive` is always soft delete.
- `priceListItem` is CRUD-only because the table has no archive column.
- `articleVariantOptionValue` is intentionally a link/unlink capability, not a normal row-level CRUD slice.

### Sales

- `sales.document.*`: `list`, `get`, `create`, `update`, `saveDraft`, `post`, `storno`, `duplicate`, `convert`, `delete`, `tree`, `audit`, `shipment`, `delta`, `pricing`
- `sales.documentLine.*`: `list`, `get`, `create`, `update`, `archive`, `tracking`, `delta`

### Logistics

- `logistics.inventoryItem.*`
- `logistics.inventoryBalance.*`
- `logistics.inventoryMovement.*`
- `logistics.serialNumber.*`
- `logistics.documentShipment.*`
- `logistics.documentShipmentPackage.*`

### Accounting

- `accounting.glAccount.*`
- `accounting.journalEntry.*`
- `accounting.journalLine.*`
- `accounting.accountDeterminationRule.*`
- `accounting.accountingExportBatch.*`
- `accounting.accountingExportRow.*`

### System

- `system.organization.*`
- `system.tenant.*`
- `system.company.*`
- `system.userTenant.*`
- `system.modules.*`
- `system.connectorDefinition.*`
- `system.systemSettings.*`
- `system.tenantConnector.*`
- `system.tenantConnectorMapping.*`
- `system.tenantFields.*`
- `system.tenantGroups.*`
- `system.tenantLayouts.*`
- `system.tenantRules.*`
- `system.tenantLlmConfig.*`

Output record schemas intentionally remain light-weight in several places (`z.looseObject` or narrow identity-only schemas) to keep the capability layer aligned with the underlying services without duplicating full domain schemas.

## HTTP surface

All three routes follow the repo's one-file-per-endpoint convention and build their context exclusively through `resolveExecutionContext(request)` (`apps/web/src/lib/capability-auth.ts`):

session via `auth.api.getSession` → 401 · `resolveTenantContext` → 403 · `getUserTenantRole` + `toCapabilityRole` ("owner"/"admin" → `tenant_admin`, else `tenant_user`; system admins → `tenant_admin`) → `actorMode: "user"`. The x-api-key branch for external callers (phase 3) plugs in here and nowhere else.

### `GET /api/capabilities?module=&entityName=`

Discovery. Returns `{ capabilities: CapabilityDescriptor[] }` filtered to `exposure.http: true` and the caller's role (a `tenant_user` never sees `tenant_admin` capabilities). Each descriptor carries the input schema as JSON Schema (`z.toJSONSchema`, Zod v4) — the surface is fully self-describing; external clients need no SDK.

### `GET /api/capabilities/{key}`

Full descriptor for one capability, including `outputSchema`. Unknown, non-HTTP, or above-role keys are indistinguishable: 404.

### `POST /api/capabilities/{key}/execute`

```json
{ "input": { ... }, "dryRun": false, "idempotencyKey": "optional" }
```

Returns the `CapabilityResult` envelope verbatim. Status mapping:

| error.code | HTTP |
| --- | --- |
| (ok) | 200 |
| `validation` | 422 |
| `forbidden` | 403 |
| `unknown_capability`, `not_found` | 404 |
| `conflict` | 409 |
| `internal` | 500 |

Example session:

```
POST /api/capabilities/masterdata.article.upsert/execute
{"input":{"articleNo":"HTTP-CAP-001","name":"Test"}}
→ 200 {"ok":true,"data":{"article":{...},"created":true},"meta":{"capability":"masterdata.article.upsert","schemaVersion":1,"dryRun":false,"durationMs":5.4}}

POST /api/capabilities/masterdata.article.get/execute
{"input":{"articleId":"nope"}}
→ 422 {"ok":false,"error":{"code":"validation","message":"Invalid input for \"masterdata.article.get\"","issues":[{"path":"articleId","message":"Invalid UUID"}]}}
```

## entity_commands projection

`pnpm db sync:capabilities` (`packages/db/src/scripts/sync-capabilities.ts`, chained into the `migrate` script after `seed:metadata`) projects the registry into `entity_commands`:

- One **global-scope** row per capability (`scope='global'`, `organization_id`/`tenant_id` NULL), matched by `(entityName, commandKey=operation)`. Sets `handlerkey` = capability key, `input_schema` = JSON Schema, `route_pattern` = `/api/capabilities/{key}/execute`, plus label/description/minRole/writesTables/sideEffects/ui hints. `exposure.llm: "hidden"` maps to `visibility: "hidden"`.
- Rows whose `handlerkey` is set but whose capability no longer exists → `command_state = 'archived'` (never deleted).
- Tenant/org-scope rows (label/visibility overrides) are never touched by the sync.

Implementation constraints worth knowing:

- **Manual upsert, not ON CONFLICT**: the unique constraint includes the nullable `organization_id`/`tenant_id` columns and NULLs never conflict in Postgres, so ON CONFLICT would duplicate global rows on every run.
- **Order-insensitive change detection**: jsonb normalizes key order, so the sync compares via a recursive `stableStringify`, keeping reruns idempotent (`unchanged`, not `updated`).

`AIDiscoveryService.getSemanticCommandCatalog` now reads tenant rows **plus** global rows (tenant rows win on `entityName::commandKey` clashes), skips `visibility: "hidden"`, and exposes `capabilityKey` on each `SemanticCommand`. A command with a `capabilityKey` is executable via the execute endpoint; `BOOTSTRAPPED_COMMANDS` still supplements the catalog until phase 4 retires it.

## Type-Safe Client SDK

To ensure compile-time type safety in the frontend when communicating with capabilities, we compile a nested Client SDK from the capability registry.

- **Generation command**: `pnpm db:generate-client-sdk` (runs `packages/db/src/scripts/generate-client-sdk.ts`).
- **Target File**: [apps/web/src/lib/sdk.generated.ts](file:///home/ubuntu/slopware/apps/web/src/lib/sdk.generated.ts).
- **Structure**: It outputs a nested object `sdk` mapping to the dot-separated key hierarchy:
  - `sdk.[module].[entity].[operation]`: Direct Promise-based execution.
  - `sdk.[module].[entity].use[Operation]`: Integrated React Query hooks (which delegate to generic helpers `useCapabilityQuery` and `useCapabilityMutation` under `apps/web/src/queries/capability.ts`).
- **Drift Safety**: A contract test inside `capabilities.contract.test.ts` regenerates the client SDK in-memory and compares it byte-for-byte against the generated file on disk, preventing any client-backend drift in CI.

## Testing

All tests use `node:test` against the real local Postgres (`DATABASE_URL` from `apps/web/.env` via `src/scripts/load-env`). Run from `packages/db`:

```
pnpm exec tsx --test src/capabilities/*.test.ts
```

Four layers, mirroring their distinct purposes:

1. **Contract** (`capabilities.contract.test.ts`) — registry-wide invariants without fixtures: keys unique and canonical, non-read capabilities declare `writesTables`, every schema converts to JSON Schema, garbage input rejected, plus gate behavior (forbidden/dryRun/output-contract/meta) exercised via test-only probe capabilities registered inside the test file.
2. **Scenario** (`capabilities.scenario.test.ts`) — the canonical pattern for deterministic feature tests: create a **throwaway org/tenant fixture** (random UUID suffix), build `ctx = { tenantId, organizationId, userId: null, actorMode: "test", role: "system" }`, call `executeCapability` in-process, assert envelope and DB state. No HTTP involved. Covers upsert-create/patch, merge-idempotent applyToArticle, archive + conflict on resurrection, cross-tenant `not_found`, validation issue paths.
3. **Coverage ratchet** (`capabilities.coverage.test.ts`) — every export of audited service modules (`variant-template.ts`) and every prototype method of audited classes (`DataService`, `DocumentService`) must appear in an allowlist mapping to either a capability key or `null` (= consciously not exposed, with reason comment). A new service function/method fails the test until someone makes that decision. This is the second drift defense.
4. **Smoke** (`capabilities.smoke.test.ts`) — minimal live-data check: resolve the base tenant **by slug `"base"`** (never hardcode tenant ids — the dev DB gets reseeded), list articles, assert structure only. The minimum requirement for any first test is exactly: load-env import + hand-built ExecutionContext + one `executeCapability` call + `after(closeDb)`.
5. **HTTP smoke** (`http/article-capability.smoke.test.ts`) — proves the HTTP surface end to end against the running dev server: login → discovery → descriptor → execute → read-back. Uses `http/capability-client.ts` and the dedicated test user (`CAPABILITY_TEST_EMAIL`/`CAPABILITY_TEST_PASSWORD` in `apps/web/.env`), which owns its own isolated tenant. Deliberately outside the `src/capabilities/*.test.ts` glob; run with `pnpm exec tsx --test src/capabilities/http/*.test.ts`. Agent-facing quickstart: `AI_TESTING.md` at the repo root.

## Invariants (non-negotiable)

- `tenantId` never appears in capability input schemas and is never read from client payloads. Context is built server-side only (`capability-auth.ts`, fixtures, key metadata).
- Business logic lives in domain services; capability handlers wire context + call services.
- The capability layer never opens transactions.
- One Zod schema per concept, shared by import — no schema duplication between services and capabilities.
- Code is the source of truth; `entity_commands` is a projection. Never hand-edit global-scope rows with a `handlerkey`.
- No hard deletes: `archive` capabilities and the sync both archive only.
- Breaking schema changes require a new operation key (e.g. `upsertV2`) or a `schemaVersion` bump; additive-optional changes are the default evolution path.

## Roadmap (phase 3+)

- **External callers / sandboxes** (decided: API keys before MCP): Better Auth `apiKey()` plugin in `packages/auth/src/auth.ts` (⚠️ `auth:generate` uses the pinned generator `pkg.pr.new/auth@9489` — review the schema diff), key-mint route storing `{ tenantId, role }` in key metadata, `actorMode: "external"` branch in `resolveExecutionContext`. External clients then need only the discovery GET + execute POST with `x-api-key`.
- **AI tools from the registry**: `createCapabilityTools(ctx)` in `@repo/agent` generating one `toolDefinition` per `exposure.llm !== "hidden"` capability (same Zod schemas, no tenantId) — replaces the hand-written duplicates in `packages/agent/src/tools.ts`/`mutations.ts`, which currently leak `tenantId` into LLM-visible schemas.
- **Capability modules**: `masterdata.address.*`, `sales.document.*`, `sales.documentLine.*` (wrap `DataService`/`DocumentService`; flip the corresponding ratchet entries from `null` to keys).
- **Imports**: `ImportService.postBatch` dispatching rows through `executeCapability` with `actorMode: "system"`.
- **Phase 4**: idempotency enforcement (execution-log table, unique `(tenantId, idempotencyKey)`), MCP server over the same registry, lint rule preventing `api/` routes from importing services directly, retire `BOOTSTRAPPED_COMMANDS`, migrate existing entity routes to thin capability wrappers.
