# 06 - Inline Designer

## Goal

Replace the detached sheet-style Inline Designer with an in-place metadata editor that works directly inside the standard component family:

- `EntityMask`
- `DataGrid`
- `DocumentEditor`

The designer must edit declarative metadata only. It may preview local state changes, but it must not own security, tenant isolation, posting behavior, or database mutation logic.

## Why

The current designer experience is useful, but it is still centered around a separate foreground sheet and a small local delta model. That is enough for simple grid and field tweaks, but it does not scale to:

- nested layout trees
- conflict reconciliation
- JSONB field projection
- lifecycle-aware requiredness
- document-header layout editing
- structured patch application

The updated designer must behave like a first-class metadata surface embedded in the active workspace, not like a separate configuration dialog.

## Current State

The live implementation already has a foundation for this slice:

- `packages/ui/platform/designer-context.tsx` stores local design deltas and toggles design mode.
- `packages/ui/components/inline-designer.tsx` renders the current sheet-based editor and metadata history view.
- `packages/ui/components/entity-mask.tsx` already consumes designer state for field visibility and order.
- `packages/ui/components/data-grid.tsx` already consumes designer state for column visibility and order.
- `apps/web/src/routes/_auth/app/route.tsx` registers the design-mode command and mounts the inline designer shell.

This slice updates that baseline into a proper in-place system with structured patches, normalized layout nodes, and explicit conflict handling.

## Architectural Position

The designer is part of the platform metadata pipeline, not a custom app feature.

- Presentation and local ergonomic behavior are tenant-extensible.
- Validation, tenant isolation, posting, and command authority remain backend-controlled.
- The designer writes intent and patch operations, never final business state.
- Effective metadata is the only consumable runtime view for UI and orchestration.

## Canonical Scope

The in-place designer may edit:

- field labels, helper text, placeholders, visibility, readonly, requiredness, and display order
- grid columns, pinning, widths, formatting hints, and visibility
- group containers, tabs, frames, and recursive placement
- virtual JSONB field definitions and backing paths
- rule hooks, priorities, condition blocks, and action definitions
- conflict state and reconciliation notes

The in-place designer may not edit:

- security boundaries
- tenant membership or tenant isolation rules
- posting rules
- direct SQL
- raw unrestricted network calls
- derived-data mutation outside governed services

## Normalized Designer Contract

The metadata layer must resolve design-time configuration into a single normalized contract before the UI consumes it. The contract should be stable enough to support diffing, inheritance, reconciliation, and drag/drop.

### Stable identifiers

Every editable node must have a canonical identity key that survives reorderings and non-breaking schema changes.

The key should be stable across:

- base metadata updates
- organization overrides
- tenant overrides
- layout refactors
- metadata migrations

### Core node kinds

The normalized node contract must support these node kinds:

- `field-ref`
- `jsonb-field`
- `group-frame`
- `tab-container`
- `tab-pane`
- `column-container`
- `column`
- `grid-column`
- `surface`

### Required node attributes

Each node should carry:

- `id`
- `kind`
- `surface`
- `entityName`
- `parentId`
- `children`
- `placement`
- `displayOrder`
- `label`
- `visible`
- `readonly`
- `required`
- `styleTokenBinding`
- `ruleBinding`
- `conflictState`
- `versionInfo`

### Placement model

Placement must be recursive and deterministic.

- A node may contain child nodes.
- Child order must be explicit.
- Layout reconciliation must preserve stable identity even when visual position changes.
- Group containers and frames must be nestable.

## Surfaces

The designer must operate on explicit surfaces, not just generic "forms" or "grids".

Supported surfaces are:

- `triview-tree`
- `triview-grid`
- `triview-detail`
- `inspector-panel`
- `dependent-grid`
- `document-header`
- `document-lines`

## Versioning and Conflict Model

Tenant overrides must survive base schema changes without silently breaking the UI.

### Version lineage

Each persisted override should track:

- `baseVersion`
- `derivedFromVersion`
- `overrideMode`
- `conflictState`
- `reconciliationRequired`
- `supersededFieldRef`

### Conflict states

The effective metadata output must be able to mark nodes as:

- `clean`
- `deprecated`
- `tombstoned`
- `conflicted`
- `needs_review`

### State meaning

- `clean`: the node aligns with the current base contract.
- `deprecated`: the node is still readable but should be phased out.
- `tombstoned`: the base node disappeared and the layout reference is no longer renderable as normal UI.
- `conflicted`: the node has a structural or semantic mismatch with the current base.
- `needs_review`: the base contract changed and manual reconciliation is required.

### Reconciliation rule

The server resolves conflicts, not the client. The client can request reconciliation and preview suggested remaps, but it cannot self-promote a broken layout into active metadata.

## Runtime Contract

Design mode must be controlled through the standard platform runtime.

- Activation must go through `CommandProvider`.
- Active designer state must participate in `FocusProvider`.
- Escape handling must follow the platform-wide close order.
- No ad hoc `window` key handlers may own designer logic.

### Required focus behavior

When the designer is active:

- `focusState.area` should resolve to `designer`
- the active entity and surface should remain visible to the command system
- selection changes must be reflected in the inspector and in the focus state
- Escape must first cancel transient edits, then close the designer surface, then return focus to the underlying workspace

### Required commands

The following commands are the minimum contract:

- `designer.toggle`
- `designer.save`
- `designer.reset`
- `designer.apply`
- `designer.reconcile`
- `designer.close`

Commands may be context-sensitive, but they must be registered centrally and exposed through the standard command registry.

## Editing Behavior

### In-place selection

Clicking a field, column header, group frame, tab, or container must select the node in place and open the contextual inspector on the right.

Selection chrome should include:

- a subtle primary outline
- a drag handle where reordering is supported
- a canonical identity badge
- clear hover feedback

### Draft-first interaction

All designer interaction is local and preview-first.

- UI updates happen immediately in local draft state.
- Metadata patches are queued separately from runtime state changes.
- Saving persists a structured patch set.
- Applying promotes a validated draft to active metadata.

## Validation Model

Validation is layered and lifecycle-aware.

### Layer 1: Client guidance

The designer may provide advisory issues for:

- missing labels
- invalid token references
- invalid field paths
- inconsistent layout hints
- duplicate ordering conflicts

### Layer 2: Domain validation

The server must validate:

- effective metadata compatibility
- tenant scope
- base schema compatibility
- rule shape
- JSONB field path resolution
- command and capability references

### Layer 3: Database constraints

The database remains the final authority for:

- foreign keys
- nullability
- uniqueness
- tenant isolation
- archive semantics

## Virtual JSONB Fields

The designer must treat JSONB-backed custom fields as first-class metadata.

Required behavior:

- allow mapping to a stable backing path such as `customAttributes.delivery.postalGroup`
- project the virtual field into effective field definitions
- render the field through the same standard form and grid contracts as physical columns
- keep lookup, sorting, and validation behavior consistent with normal fields where supported

The designer must not expose unrestricted path editing without validation against the backing schema contract.

## Rule Model

Rules are hook-based and ordered.

### Supported hooks

- `onLoad`
- `onInput`
- `onSave`
- `onClose`

### Rule ordering

Rules must execute in deterministic order:

1. `priorityOrder` ascending
2. `ruleKey` ascending

### Allowed action classes

- local draft mutations
- visibility changes
- readonly changes
- requiredness changes
- issue raising and clearing
- capability resolution through server services
- validated command invocation

### Prohibited action classes

- raw SQL
- unrestricted network access
- direct data writes outside validated save/apply flows
- bypassing tenant isolation
- altering posting behavior or security behavior

## API Contract

The existing metadata routes remain the integration point, but designer writes must move to structured patches.

### Read

- `GET /api/metadata/designer/{entity}/{surface}`
- `GET /api/metadata/history/{entity}`

### Write

- `PATCH /api/metadata/designer/{entity}/{surface}`
- `POST /api/metadata/designer/{entity}/{surface}/apply`
- `POST /api/metadata/designer/{entity}/{surface}/reconcile`

### Patch shape

```json
{
  "baseVersion": "2026-05-15T10:53:06Z",
  "derivedFromVersion": "2026-05-15T10:53:06Z",
  "surface": "triview-detail",
  "ops": [
    { "op": "move", "nodeKey": "field:customerName", "parentKey": "group:header", "index": 1 },
    { "op": "set", "nodeKey": "field:customerName", "path": "visible", "value": true }
  ],
  "clientRevision": "rev-7b3c"
}
```

### Response shape

The server should return:

- updated effective contract
- lineage and version metadata
- conflict state
- review state
- auto-applied remaps
- required follow-up actions

## UI Behavior

The designer UI should remain compact and operational.

### Inspector duties

The right-side inspector is the main editor surface for:

- labels and localization
- visibility and ordering
- readonly and requiredness
- group and frame placement
- style token bindings
- rule bindings
- conflict review and reconciliation

### Visual overlays

When design mode is enabled, the active component should show lightweight chrome only.

- do not obscure the underlying workflow
- do not replace the base component with a separate edit view
- preserve normal keyboard navigation as much as possible
- keep the surface usable on desktop and smaller notebook layouts

### Shared component expectations

The designer must work inside the same shell, command, focus, and i18n model as the rest of the platform.

- `EntityMask` remains the generic detail surface.
- `DataGrid` remains the generic list surface.
- `DocumentEditor` remains the focused transactional document editor.
- `InspectorPanel` may be used for dependent detail, but not for a separate detached designer app.

## Non-Goals

The following are explicitly out of scope:

- free-form theme editing
- custom arbitrary code execution in the browser
- raw metadata table editing
- tenant switching logic
- posting workflow changes from the client
- security policy editing
- arbitrary designer-specific shortcuts outside `CommandProvider`

## Implementation Phases

### Phase 1: In-place selection and inspector core

- move the active designer experience from the sheet model to in-place overlays
- preserve the existing `DesignerProvider` as the state anchor
- wire selected node state into the inspector and focus manager

### Phase 2: Recursive layout nodes

- add a canonical node model for groups, tabs, columns, and nested frames
- support recursive tree rendering in `EntityMask`
- support group and column tree editing in `DataGrid`

### Phase 3: JSONB field projection

- allow field definitions to map to stable JSONB backing paths
- project virtual fields into effective metadata
- validate paths and types server-side

### Phase 4: Rules and reconciliation

- split runtime guidance from persisted metadata patches
- add structured patch application
- implement conflict review and reconciliation flows

### Phase 5: DocumentEditor extensions

- extend the same metadata contract into document headers
- keep line editing controlled and domain-safe
- limit designer edits to presentation and binding scope

## File Touchpoints

Expected areas of change:

- `packages/ui/platform/designer-context.tsx`
- `packages/ui/components/inline-designer.tsx`
- `packages/ui/components/entity-mask.tsx`
- `packages/ui/components/data-grid.tsx`
- `packages/ui/components/document-editor/*`
- `apps/web/src/routes/_auth/app/route.tsx`
- metadata services and API routes under `packages/db/src/services/` and `apps/web/src/routes/api/metadata/`
