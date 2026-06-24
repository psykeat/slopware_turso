# PRD 02: Registry Refactor Completion Plan

## Purpose

Turn the current registry-first bridge state into the architecture described in `docs/prd/01_regestry.md`.

The first implementation slice removed major generated compatibility layers, but the project is still not registry-first end to end. This PRD captures the current health assessment, the remaining gaps, and a concrete sequence of work to finish the pattern without adding another migration layer.

## Current Health Baseline

Last audited: 2026-06-22.

The project is in a partially healthy bridge state:

- Registry-owned generic entity action projection exists in `packages/registry/src/actions.ts`.
- Dynamic CRUD helpers resolve entity operations from `@repo/registry`.
- Generated capability manifest infrastructure appears removed.
- `@repo/db/actions` exists and some app routes already call `executeAction`.
- `pnpm check` passed formatting for 1690 files, then failed because Vite+ panicked while printing lint output.
- `npx fallow dead-code` reports 289 issues: 32 unused files, 217 unused exports, 11 unused type exports, 11 unused class members, 9 unused dependencies, 5 unused dev/optional dependencies, and 1 unlisted dependency.

The project is not yet fully registry-first:

- `@repo/db/actions` is currently a facade over `@repo/db/capabilities`.
- `packages/db/src/capabilities` still owns most action contracts, schemas, roles, exposure metadata, and handler definitions.
- Registry actions are currently a lightweight operation projection, not full action definitions.
- AI has action-named APIs, but capability aliases and `taskScope` planning are still present.
- `/api/capabilities*` remains app-facing.
- Several app routes still import `@repo/db/schema` directly for normal business operations.
- `entity_commands` still exists in schema and migrations, even though the sync implementation appears removed.

## Goal

Make `@repo/registry` the single source of truth for:

- entity metadata
- field projections
- generic entity operations
- action contracts
- input and output validation schemas
- UI action placement
- AI action exposure
- handler identifiers
- side effects and write declarations
- action test expectations

`@repo/db` should execute registry-defined actions through server-only handler bindings. `apps/web`, `packages/ui`, and `packages/agent` should consume action terminology and registry projections, not capability descriptors.

## Non-Goals

- Do not rewrite every domain service.
- Do not introduce a new generated manifest.
- Do not sync registry actions into database command rows as a runtime source of truth.
- Do not keep both capability metadata and registry action metadata permanently.
- Do not remove useful scenario tests just because they still use capability names; migrate them with the runtime.

## Completion Criteria

The PRD is complete when all of these are true:

- `packages/registry/src/types.ts` defines a full `RegistryActionDefinition`.
- Registry exports action APIs: `listActionDefinitions`, `getActionDefinition`, `listEntityActions`, `resolveEntityOperation`, `listAiActionDefinitions`, and `resolveActionProjection`.
- `@repo/db/actions` loads metadata from `@repo/registry`, resolves handlers by `handlerId`, validates input, enforces roles/exposure, and executes in tenant scope.
- `packages/db/src/capabilities` no longer exports app-facing metadata or execution APIs.
- `apps/web` and `packages/ui` do not import `@repo/db/capabilities`.
- `/api/actions*` is the app-facing HTTP action API. `/api/capabilities*` is deleted or explicitly deprecated and backed by the same action runtime.
- AI tools are built from registry action projections. No client `aiCapabilityRegistry` remains.
- AI review rendering is selected by `actionKey`, result kind, or registry projection, not `taskScope`.
- AI command discovery does not query or depend on `entity_commands`.
- Normal business app routes do not import `@repo/db/schema`; they call `executeAction`.
- Guardrails prevent reintroducing capability manifests, capability sync, direct `/api/data` business calls, and app-facing capability imports.
- Project validation completes without a checker crash or hidden type errors.

## Work Plan

### Phase 1: Promote Registry Actions To Full Contracts

Add `RegistryActionDefinition` to `@repo/registry`.

Required fields:

- `key`
- `entityName`
- `operation`
- `kind`
- `summary`
- `description`
- `input`
- `output`
- `handlerId`
- `writesEntities`
- `sideEffects`
- `idempotent`
- `supportsDryRun`
- `minRole`
- `schemaVersion`
- `projections.api`
- `projections.ui`
- `projections.ai`
- `genericOperation`

Acceptance criteria:

- Existing `entityActionManifest` entries are represented as registry action definitions.
- Registry can list all actions and resolve generic entity operations without importing DB code.
- Action definitions are safe to import in client bundles: no handlers, no Drizzle, no server-only imports.
- Tests verify every generic operation points to an action definition.

### Phase 2: Build The Real DB Action Runtime

Replace the current facade in `packages/db/src/actions/index.ts`.

Required runtime behavior:

- load action definitions from `@repo/registry`
- resolve server-only handlers by `handlerId`
- validate input from registry action schema
- validate output where practical
- enforce `minRole`
- enforce API and AI exposure rules at descriptor/tool boundaries
- run tenant-scoped operations through existing Turso tenant context
- preserve the stable result envelope
- support idempotency and dry-run where declared

Acceptance criteria:

- `executeAction`, `getAction`, `listActions`, `actionDescriptor`, `actionInputJsonSchema`, and `actionOutputJsonSchema` no longer call capability metadata APIs.
- Capability handlers may be reused internally during migration, but metadata must come from registry actions.
- Contract tests cover unknown action, invalid input, role denial, output shape, and tenant isolation.

### Phase 3: Migrate Dynamic CRUD Naming And Transport

Replace capability naming in app/shared UI helpers while preserving behavior.

Targets:

- `apps/web/src/lib/entity-capabilities.ts`
- `packages/ui/lib/entity-capabilities.ts`
- `packages/ui/lib/capability-client.ts`
- `apps/web/src/server-fns/capabilities.ts`
- `apps/web/src/server-fns/actions.ts`
- `apps/web/src/queries/capability.ts`

Acceptance criteria:

- Public helper names are action-oriented: `entityList`, `entityListPage`, `entityGet`, `entitySave`, `entityDelete`, `action`, `callAction`.
- Compatibility aliases are either deleted or isolated with deprecation comments.
- UI/shared UI no longer imports or names `executeCapability`.

### Phase 4: Replace HTTP Capability Routes

Move app-facing HTTP routes from capabilities to actions.

Targets:

- `apps/web/src/routes/api/capabilities.ts`
- `apps/web/src/routes/api/capabilities/$key.ts`
- `apps/web/src/routes/api/capabilities/$key/execute.ts`

Acceptance criteria:

- `/api/actions` lists action descriptors from the action runtime.
- `/api/actions/$key` returns an action descriptor.
- `/api/actions/$key/execute` executes through `executeAction`.
- `/api/capabilities*` is either deleted or implemented as a documented deprecated alias.
- Route tree and generated references are updated.

### Phase 5: Finish AI Projection Migration

Replace capability/task-scope AI metadata with registry action projection.

Targets:

- `packages/agent/src/capability-tools.ts`
- `packages/agent/src/capability-tools.test.ts`
- `apps/web/src/lib/ai/ai-capability-registry.tsx`
- `apps/web/src/components/ai/AiOverlayHost.tsx`
- `apps/web/src/components/ai/hooks/useAiTaskStream.ts`
- `apps/web/src/routes/api/ai/$.ts`
- `packages/db/src/services/ai-planning.ts`
- `packages/db/src/services/ai-discovery.ts`

Acceptance criteria:

- Agent package exposes action-named APIs only.
- No `listAiCapabilities`, `buildCapabilityTools`, or `selectOverlayCapabilities` compatibility exports remain.
- Client review cards are selected by `actionKey`, result kind, or registry projection.
- `taskScope` is removed from new execution paths; any remaining persisted historical field is treated as legacy data only.
- `/api/ai/execute` and `/api/ai/chat` build tools from registry action projections.

### Phase 6: Actionize Remaining Business Routes

Convert normal ERP routes that still import DB schema directly.

Initial target list:

- `apps/web/src/routes/api/delivery-addresses/$deliveryAddressId.ts`
- `apps/web/src/routes/api/setup/initialize.ts`
- `apps/web/src/routes/api/setup/year-end.ts`
- `apps/web/src/routes/api/me/company.ts`
- `apps/web/src/routes/api/articles/$articleId/images.ts`
- `apps/web/src/routes/api/articles/$articleId/bom.ts`
- `apps/web/src/routes/api/articles/$articleId/bom/$bomId.ts`
- `apps/web/src/routes/api/articles/$articleId/serial-numbers.ts`
- `apps/web/src/routes/api/articles/$articleId/batches.ts`
- `apps/web/src/routes/api/stats/dashboard.ts`
- `apps/web/src/routes/api/stats/address/$addressId.ts`

Acceptance criteria:

- Each route either calls `executeAction` or is explicitly documented as a true admin/config exception.
- Business SQL and tenant filtering stay in DB handlers/services, not web routes.
- Guardrail tests reject new normal business imports from `@repo/db/schema` in app routes.

### Phase 7: Metadata And Overlay Cleanup

Finish replacing legacy metadata and designer fallback behavior.

Targets:

- `apps/web/src/routes/api/metadata/$.ts`
- metadata history writes
- designer fallback paths
- settings registry projection

Acceptance criteria:

- Base fields and layouts come from `@repo/registry`.
- Tenant-specific customizations are explicit overlays, not fallback introspection.
- Metadata writes either target a real overlay action or are removed.
- No normal runtime UI path introspects DB schema for base metadata.

### Phase 8: Retire Capability Surface

After consumers are on actions, reduce capabilities to private implementation code or delete it.

Acceptance criteria:

- `@repo/db` no longer exports `./capabilities` as an app-facing package surface.
- `packages/agent` has no capability terminology.
- `apps/web` and `packages/ui` have no capability imports.
- Capability descriptor types are removed or renamed to private action handler internals.
- Fallow no longer reports capability modules as unused public exports because the public surface has been clarified.

### Phase 9: Dependency And Dead Code Cleanup

Use Fallow output as a cleanup queue, not as automatic deletion authority.

Acceptance criteria:

- Confirm whether each unused file is truly dead, dynamically loaded, or intended future work.
- Remove stale unused exports created by the refactor.
- Fix unlisted dependency `@tanstack/react-pacer` at the correct workspace package.
- Move dependencies to the package that imports them.
- Suppress only intentional false positives with local comments and reasons.
- `npx fallow dead-code` is either clean or contains only documented intentional suppressions.

### Phase 10: Validation Stabilization

Make project health measurable.

Acceptance criteria:

- `pnpm check` completes without Vite+ panic.
- Lint warnings are either fixed or intentionally configured.
- Typecheck passes for registry, DB, agent, UI, and web.
- Core scenario tests pass against the action runtime.
- Guardrails are updated from capability wording to action wording.

## Guardrails To Add Or Update

- No app/shared UI imports from `@repo/db/capabilities`.
- No app-facing `executeCapability`, `capability()`, or capability query hook names outside deprecated aliases.
- No `manifest.generated`, `manifest-build`, `entity-ops`, `sync-capabilities`, or `syncEntityCommands`.
- No direct fetches to deleted `/api/data` business routes.
- No normal business route imports from `@repo/db/schema`.
- Every registry action with `projections.ai.exposed` has a tool name, input schema, and confirmation policy.
- Every registry action with writes declares `writesEntities`.
- Every registry action `handlerId` resolves in the DB handler registry.
- Every registry entity with CRUD/list projection has executable registry actions.

## First Actionable Slice

Start here:

1. Add full `RegistryActionDefinition` types and registry action APIs.
2. Convert the current `entityActionManifest` into action definitions while preserving its resolver behavior.
3. Change `@repo/db/actions` so descriptors and JSON schemas come from registry actions.
4. Keep execution delegated to existing handlers only through `handlerId` binding.
5. Add tests that prove metadata no longer comes from `@repo/db/capabilities`.

This slice closes the biggest architectural gap: action metadata ownership.
