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
- Turso/libSQL is the target persistence architecture: physical database-per-tenant isolation, central tenant routing/config DB, `busy_timeout >= 5000 ms`, and SQLite-safe Drizzle bulk chunks. The live PostgreSQL adapter remains compatibility code during migration (`turso.md`, ADR 0004).
- TypeScript-first entity registry: domain-level entity knowledge belongs in `@repo/registry`; the official capability surface exposes it through `system.registry.*` read capabilities.
- Document email templates: tenant-scoped `email_template` + `email_template_binding`; binding resolution by specificity (documentType/company/language/identity); `{{placeholder}}` engine identical on server (`EmailTemplateService`) and client (`packages/ui/lib/template-preview.ts`); both send paths (Commandbar + AI) run through the same pipeline — see `email.md`.
- Fluent integration test seeding: prefer using `TestScenarioBuilder` in `packages/db/src/test-support/fixtures.ts` over manual raw table inserts or manual ID linking to construct multi-entity test states.
- Archived docs are historical only and stay out of the default reading path.

## When To Open What

- Architecture invariants: `00`
- Module and platform contract: `01`
- Generic entity derivation and lookup behavior: `02`
- Shell, navigation, design, and routing: `03`
- Capability registry, execution API, capability testing: `07_api.md`
- Turso/libSQL target and compatibility rules: `turso.md`
- E-Mail Belegversand, Vorlagen, Bindings, Seed, Capabilities: `email.md`
- Prior decisions or old handoffs: `.agents/archive/`
