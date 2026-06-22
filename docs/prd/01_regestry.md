# PRD 01: Registry-First Refactor

## Purpose

Refactor the project toward the architecture described in `architecture_plan.md`: one TypeScript-first registry that owns entity metadata, projections, action contracts, validation, UI exposure, AI exposure, and test specifications.

The current implementation has made useful progress toward Turso and capability-based execution, but it has also introduced a second metadata layer around capabilities. That layer now duplicates registry intent through generated manifests, compatibility CRUD resolvers, synced command rows, AI task registries, legacy metadata fallbacks, and route-level migration patches.

This PRD defines the clean refactor path: remove deprecated capability and legacy metadata layers, make the registry the single source of truth, and keep only a thin server-side execution adapter around registry actions.

## Problem

The current system has two competing sources of truth:

- `@repo/registry` describes entities and basic field projections.
- `packages/db/src/capabilities` describes executable business operations, AI exposure, HTTP exposure, side effects, roles, input/output schemas, generated entity operation manifests, and discovery.

This creates bloat and drift:

- UI dynamic CRUD resolves through `entityCapabilityManifest` instead of registry projections.
- AI discovery depends on capability projections and `entity_commands`.
- `entity_commands` is synced from code instead of being replaced by registry action projections.
- `apps/web/src/routes/api/ai/$.ts` still contains compatibility wrappers and fallback legacy endpoints.
- `apps/web/src/routes/api/metadata/$.ts` and metadata services still depend on old schema introspection and fallback behavior.
- Several app routes still import DB schema directly for normal business operations.

The result is not a clean implementation. It is a migration stack holding old route logic, capability descriptors, generated compatibility maps, registry metadata, and tenant/database transition patches at the same time.

## Goal

Use `@repo/registry` as the only domain metadata and projection layer.

The target flow is:

```text
registry entity definition
  -> field projections
  -> UI projections
  -> API projections
  -> AI projections
  -> action contracts
  -> validation schemas
  -> tests
  -> server-side handler binding
```

`@repo/db` should execute registry actions. It should not define a parallel capability metadata model.

`apps/web` and `packages/ui` should consume registry projections and call a single action executor. They should not know about capability manifests, generated operation maps, or legacy `/api/data` compatibility.

## Non-Goals

- Do not add another migration compatibility layer.
- Do not keep capability descriptors as a permanent abstraction.
- Do not preserve `entity_commands` as a synced projection of capability metadata.
- Do not rewrite all domain services at once.
- Do not change Turso physical tenancy back toward Postgres/RLS assumptions.
- Do not use git diff as the source of truth for this refactor.

## Architecture Decision

Capabilities are no longer the long-term source of truth.

They are treated as a temporary execution adapter until their metadata has been absorbed into registry actions.

The registry owns:

- entities
- fields
- relations
- behaviors
- constraints
- list/form/lookup/api/ai projections
- action contracts
- UI action placement
- AI tool exposure
- validation schemas
- test fixtures and test expectations

The DB package owns:

- persistence
- handler implementations
- transaction boundaries
- Turso tenant scoping
- domain service orchestration
- action execution envelopes

The web app owns:

- routing
- session and tenant context resolution
- UI composition
- transport wrappers around registry action execution

## Current State Summary

Completed or partially completed:

- SQLite schema generation exists.
- Turso tenant scope exists.
- `DataService` and many capability modules were adjusted away from SQL tenant filters.
- `@repo/registry` exists with entity and field projections.
- Capability runtime provides execution, discovery, AI tool generation, HTTP execution, idempotency, and dynamic entity operation resolution.

Remaining architectural debt:

- Capability metadata duplicates registry metadata.
- Dynamic CRUD depends on generated capability manifests.
- AI discovery still has legacy `taskScope`, `entity_commands`, and compatibility wrappers.
- Metadata routes/services still use old introspection and database-backed layout metadata.
- Multiple app routes still bypass action execution and import DB schema directly.

## Target Registry Action Model

Extend `packages/registry/src/types.ts` so every entity can define actions.

Required action fields:

```typescript
export interface RegistryActionDefinition {
  key: string;
  entityName: string;
  operation: string;
  kind: "read" | "create" | "update" | "archive" | "process";
  summary: LocalizedText;
  description?: LocalizedText;
  input: unknown;
  output: unknown;
  handlerId: string;
  writesEntities: readonly string[];
  sideEffects: readonly string[];
  idempotent: boolean;
  supportsDryRun: boolean;
  minRole: "tenant_user" | "tenant_admin";
  schemaVersion: number;
  projections: {
    api: { exposed: boolean };
    ui?: { placement?: string; icon?: string };
    ai?: {
      exposed: boolean;
      group?: string;
      activeByDefault?: boolean;
      confirmation: "none" | "required";
      useWhen: readonly string[];
      avoidWhen?: readonly string[];
      requiredContext?: readonly string[];
      resultShape?: string;
      toolName?: string;
    };
  };
  genericOperation?: {
    operation: "list" | "get" | "create" | "update" | "archive" | "delete";
    idParam?: string;
    filtersWrapped?: boolean;
  };
}
```

The exact type shape can be refined during implementation, but the important point is ownership: action metadata lives in `@repo/registry`, not `@repo/db/capabilities`.

## Target Execution Model

Add one server-side action runtime.

Required APIs:

```typescript
executeAction(actionKey, ctx, input);
getAction(actionKey);
listActions(filter);
actionDescriptor(actionKey);
resolveEntityOperation(entityName, operation);
```

The runtime should:

- load action metadata from `@repo/registry`
- resolve the server-only handler by `handlerId`
- validate input
- run inside `runInTenantScope`
- enforce role and exposure rules
- handle dry-run and idempotency where required
- return a stable result envelope

The existing capability result envelope can be reused during migration, but naming should move toward actions once consumers are migrated.

## Deletion Targets

Remove these after registry actions reach parity:

- `packages/db/src/capabilities/manifest-build.ts`
- `packages/db/src/capabilities/manifest.generated.ts`
- `packages/db/src/capabilities/entity-ops.ts`
- `packages/db/src/scripts/generate-capability-manifest.ts`
- package export `@repo/db/capabilities/manifest`
- `packages/db/src/capabilities/sync-entity-commands.ts`
- `packages/db/src/scripts/sync-capabilities.ts`
- capability-driven AI discovery through `entity_commands`
- client `aiCapabilityRegistry`
- legacy AI plan fallback endpoints
- compatibility wrapper comments and code in `/api/ai/$`
- old `/api/data` compatibility references
- route-level business DB schema imports where an action should exist

## Refactor Phases

### Phase 1: Registry Action Foundation

Add action types to `@repo/registry`.

Add registry APIs:

- `listActionDefinitions`
- `getActionDefinition`
- `listEntityActions`
- `resolveEntityOperation`
- `listAiActionDefinitions`
- `resolveActionProjection`

Acceptance criteria:

- Registry can answer which actions exist for an entity.
- Registry can answer list/get/create/update/archive operation shapes.
- Registry can answer AI-exposed actions without reading capability metadata.

### Phase 2: Server Action Runtime

Create server-side action execution in `@repo/db`.

Initial implementation may delegate to existing capability handlers internally, but metadata must come from registry actions.

Acceptance criteria:

- `executeAction` can execute at least CRUD/list actions.
- Input validation comes from the registry action contract.
- Execution context is still server-built and never accepts client `tenantId`.
- Existing Turso `runInTenantScope` behavior is preserved.

### Phase 3: Dynamic Entity CRUD Migration

Replace dynamic CRUD helpers:

- `apps/web/src/lib/entity-capabilities.ts`
- `packages/ui/lib/entity-capabilities.ts`

with registry action helpers.

Target naming:

- `entityList`
- `entityListPage`
- `entityGet`
- `entitySave`
- `entityDelete`

These may keep public function names temporarily, but implementation must resolve through registry actions, not capability manifests.

Acceptance criteria:

- No UI/shared UI code imports `@repo/db/capabilities/entity-ops`.
- No runtime dependency on `manifest.generated.ts`.
- Dynamic grids/forms resolve operation metadata from registry action projections.

### Phase 4: Delete Generated Capability Manifest

Remove generated entity capability manifest infrastructure.

Acceptance criteria:

- `manifest.generated.ts` deleted.
- manifest generation script deleted.
- `entity-ops.ts` deleted.
- package exports updated.
- guardrail test prevents reintroducing generated capability operation maps.

### Phase 5: AI Projection Migration

Move AI tool selection from capability metadata to registry action metadata.

Replace:

- `listAiCapabilities`
- `buildCapabilityTools`
- `selectOverlayCapabilities`
- client `aiCapabilityRegistry`
- `taskScope`-first planning

with:

- `listAiActionDefinitions`
- `buildRegistryActionTools`
- registry action groups
- action/result-driven review rendering

Acceptance criteria:

- AI tools are derived from registry action projections.
- Confirmation is driven by registry action metadata.
- Review cards are selected by `actionKey`, result kind, or registry projection, not `taskScope`.
- `entity_commands` is not used for AI command discovery.

### Phase 6: Remove `entity_commands` Sync Layer

Delete capability-to-command sync.

Tenant-specific customizations should become registry overlays, not synced command rows.

Acceptance criteria:

- `syncEntityCommands` deleted.
- `sync-capabilities` script deleted.
- AI discovery does not query `entityCommands`.
- Any remaining tenant-specific command behavior is represented as registry overlay data.

### Phase 7: Break Up Legacy AI Catch-All Route

Refactor `apps/web/src/routes/api/ai/$.ts`.

Move or delete:

- legacy plan validate/apply endpoints
- hybrid compatibility wrapper
- direct service orchestration that should be actions
- memory confirm/reject routes if they belong in actions
- hard-coded task support discovery

Acceptance criteria:

- `/api/ai/chat` and `/api/ai/execute` are the main AI execution routes.
- Catch-all route no longer contains legacy fallback endpoints.
- Mail review apply/validate runs through registry actions.
- Variant generation and other process flows run through registry actions.

### Phase 8: Metadata Projection Cleanup

Replace legacy metadata route behavior with registry projections.

Target replacements:

- fields endpoint -> registry field/form/list projection
- layout endpoint -> registry UI projection plus overlay
- settings registry -> registry module/entity projection
- designer fallback -> explicit unsupported feature removal or real overlay implementation

Acceptance criteria:

- Base UI layout data comes from `@repo/registry`.
- Metadata services do not introspect Postgres schema exports for normal runtime UI.
- Fallback designer response code is removed.
- Tenant overlays are thin and explicit.

### Phase 9: Route-Level Business API Cleanup

Convert remaining direct DB-schema business routes to registry actions.

Priority:

- article BOM/images/batches/serial/pricing routes
- document group admin routes
- setup initialize/year-end routes
- stats routes
- delivery address route
- shopware/import bootstrap routes
- metadata route leftovers

Acceptance criteria:

- Normal ERP operations do not import DB schema directly in app routes.
- App routes either resolve session/config context or call `executeAction`.
- Tenant filtering in SQL does not exist in Turso-native business routes.

### Phase 10: Retire Capability Package Surface

Once all consumers use registry actions:

- rename remaining internal execution adapter away from capabilities
- delete old capability metadata types
- move handlers out of capability modules
- remove capability terminology from app-facing APIs

Acceptance criteria:

- No `apps/web` or `packages/ui` imports from `@repo/db/capabilities`.
- No `packages/agent` dependency on capability descriptors.
- Capability modules no longer define metadata.
- Registry actions are the only action contract.

## Guardrails

Add tests or static checks for:

- no `@repo/db/capabilities` imports in `apps/web` or `packages/ui`
- no `manifest.generated` imports
- no `sync-capabilities` script
- no `entityCommands` use in AI discovery
- no `/api/data` business reads or writes
- no `Fallback legacy endpoints` in AI routes
- every registry entity with CRUD projection has executable registry actions
- every registry action with `projections.ai.exposed` has a valid input schema and tool name
- every registry action handler id resolves server-side
- every action that writes entities declares `writesEntities`

## Migration Rules

- Do not add another compatibility projection.
- Do not introduce new generated manifests for registry actions.
- Do not sync registry actions into database rows as a normal runtime path.
- Do not pass `tenantId` in action input.
- Do not write new direct business routes when an action should exist.
- Prefer deleting old code once the equivalent registry path is working.
- Keep public helper names temporarily only when needed to reduce UI churn.

## Success Criteria

The refactor is complete when:

- `@repo/registry` owns entities, projections, actions, validation, and AI exposure.
- UI dynamic CRUD resolves directly from registry action projections.
- AI tools are generated from registry action projections.
- `entity_commands` is no longer a capability sync target.
- generated capability manifests are deleted.
- catch-all AI compatibility behavior is removed.
- metadata base projections come from registry definitions.
- app business routes call registry actions instead of importing DB schema.
- capability metadata is gone or reduced to a private temporary adapter with no app-facing imports.

## First Implementation Slice

Start with the smallest slice that removes real bloat:

1. Add registry action definitions for generic CRUD/list operations.
2. Add `resolveEntityOperation` to `@repo/registry`.
3. Add `executeAction` in `@repo/db`, initially delegating to existing capability handlers.
4. Switch `apps/web/src/lib/entity-capabilities.ts` and `packages/ui/lib/entity-capabilities.ts` to registry operation resolution.
5. Delete `manifest.generated.ts`, `manifest-build.ts`, `entity-ops.ts`, and the manifest generation script.
6. Add guardrails preventing those files/imports from coming back.

This first slice removes the generated compatibility map and proves the registry can own operation projections without requiring a full rewrite of every domain handler.

## Implementation Status

Last updated: 2026-06-22.

Completed:

- Registry-owned generic entity action projection added in `@repo/registry`.
- Dynamic entity CRUD helpers in `apps/web` and `packages/ui` now resolve operations from registry action projection.
- DB-side generated capability manifest removed.
- DB-side entity operation resolver removed.
- Capability manifest generation script removed.
- Capability-to-`entity_commands` sync script and implementation removed.
- `@repo/db/actions` adapter added for registry-action execution, descriptors, JSON schema projection, and action type aliases.
- Agent tool builder now uses `@repo/db/actions` internally and exposes action-named APIs.
- `/api/ai/execute` now uses `buildActionTools`.
- AI command discovery no longer reads `entity_commands`; it projects commands from registry-backed actions.
- Legacy `/api/ai/plan` and `/api/ai/plans/*` compatibility endpoints removed.
- Metadata GET route now prefers registry projections for settings registry, fields, and grid layouts.
- Generated frontend SDK now emits `action(...)` and `ActionInput`/`ActionOutput` imports.
- Web server function internals execute through `executeAction`; `capability()` remains as a compatibility alias for existing call sites.
- Guardrails added to prevent the deleted manifest/sync layers from returning.
- Package typechecks pass for registry, DB, agent, UI, and web.

Remaining:

- Rename remaining app-facing `capability()` helper imports and query hook names to action terminology once call sites are migrated.
- Move route `/api/capabilities*` to `/api/actions*` or keep as deliberate backwards-compatible HTTP API with an explicit deprecation note.
- Convert remaining direct app business routes that still import DB schema:
  - `api/delivery-addresses/$deliveryAddressId`
  - `api/setup/initialize`
  - `api/setup/year-end`
  - `api/me/company`
  - `api/admin/document-groups/*`
  - `api/articles/$articleId/{images,bom,bom/$bomId,serial-numbers,batches}`
  - `api/stats/*`
  - selected admin/config routes that should be classified as true admin exceptions or actionized.
- Move legacy AI planning services (`ai-planning.ts` plan tables and command-key executor) behind registry actions or delete them if no longer used.
- Replace metadata write/designer fallback paths with a real registry overlay implementation.
- Move action definitions fully into `@repo/registry`; current action execution still bridges over existing capability handlers.
