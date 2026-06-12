# Decision Index

Current active decisions only. Keep this file short.

## Read Order

1. `map.md`
2. `.agents/00_core_architecture.md`
3. `.agents/01_project_foundation.md`
4. `.agents/02_entity_introspection_and_generic_ui.md`
5. `.agents/03_frontend_basedesign.md`

## Current Decisions

- Generic entity first: prefer `DataGrid`, `EntityMask`, lookup/dropdown behavior, `TriViewWorkspace`, and `DocumentEditor` before any custom screen.
- Custom UI is allowed only with a documented ergonomic or business exception.
- Shell localization lives in frontend base design; entity labels and helper text should resolve from effective metadata.
- Core specs define the intended platform contract; live code defines the current implementation shape.
- Shared AI overlay runtime: one temporary, zero-footprint overlay host for all AI-assisted flows, opened through `CommandProvider` and driven by server-side interpret / resolve / review / validate / apply contracts over effective metadata and focus context.
- Capability registry as the official mutation surface: code-first `defineCapability` registry in `@repo/db/capabilities`, one `executeCapability` path for UI/AI/tests/imports, `entity_commands` is only a projection synced on migrate, tenant context built server-side only (`07_api.md`).
- Archived docs are historical only and stay out of the default reading path.

## When To Open What

- Architecture invariants: `00`
- Module and platform contract: `01`
- Generic entity derivation and lookup behavior: `02`
- Shell, navigation, design, and routing: `03`
- Capability registry, execution API, capability testing: `07_api.md`
- Prior decisions or old handoffs: `.agents/archive/`
