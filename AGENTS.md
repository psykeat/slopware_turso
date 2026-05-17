# slopware

Codex repo instructions. Keep startup context lean: read the project map first, then load deeper docs only when the task needs them.

## Startup

1. Read [`map.md`](map.md) first. It is the fast project map for routes, APIs, components, aliases, services, and commands.
2. Use `.agents/` as the canonical project documentation folder. Load only the docs needed for the task.
3. Do not load `.agents/*` wholesale. Some docs are large references or historical checklists.
4. When docs and code disagree, verify with live code using `rg`. Architecture docs define product invariants; live code defines current implementation shape.

## Stack

React 19 · TanStack Start/Router/Query · Drizzle ORM v1 · Better Auth · Tailwind v4 · Vite+ (`vp`)

## Non-Negotiable Rules

- `pnpm lint` passing = changes are correct. Do not run production builds unless build output or bundling is the issue.
- No hard delete for business data. Archive with `PATCH { archived: true }`.
- Tenant isolation is server-side only. Never trust client payloads for `tenantId`.
- All keyboard shortcuts go through `CommandProvider`. No ad hoc `keydown` business logic.
- Dependencies go through `catalog:` in `pnpm-workspace.yaml`.
- UI icons: `lucide-react` for UI, `@icons-pack/react-simple-icons` for brands.
- Prefer `@repo/ui` components over local one-off components.
- Standard business UI is generic-first, metadata-aware, keyboard-first, and built from the shared component family.

## Dev Commands

```bash
sudo docker compose up -d && pnpm dev   # start environment
pnpm lint                                # validate changes
pnpm db generate && pnpm db migrate      # schema changes
pnpm ui add <component>                  # add shadcn primitive
pnpm tanstack search-docs "<q>" --library <lib> --json
```

## Environment Constants

| Key               | Value                                  |
| ----------------- | -------------------------------------- |
| Organization Slug | `base`                                 |
| Tenant Slug       | `base` (`isBase: true`)                |
| Company No        | `1000`                                 |
| Tenant ID         | `019e2889-5cd7-714b-9922-08a75fdfbaac` |

For private local credentials, use the private project memory.

## Documentation Routing

Use this table to choose context. Prefer live code for implementation details; open docs for product intent, invariants, and feature-specific decisions.

| Task Area | Read |
|---|---|
| Fast orientation | [`map.md`](map.md) |
| Architecture invariants | [`.agents/00_core_architecture.md`](.agents/00_core_architecture.md), [`.agents/01_project_foundation.md`](.agents/01_project_foundation.md), [`.agents/02_entity_introspection_and_generic_ui.md`](.agents/02_entity_introspection_and_generic_ui.md) |
| Frontend shell, shared UI, design | [`.agents/design.md`](.agents/design.md), [`.agents/03_frontend_basedesign.md`](.agents/03_frontend_basedesign.md); use [`.agents/04_redesign.md`](.agents/04_redesign.md) only for active checklist work |
| TanStack, auth, TypeScript, workflow | [`.agents/tanstack-patterns.md`](.agents/tanstack-patterns.md), [`.agents/auth.md`](.agents/auth.md), [`.agents/typescript.md`](.agents/typescript.md), [`.agents/workflow.md`](.agents/workflow.md) |
| Database, migrations, tenancy | [`.agents/postgres.md`](.agents/postgres.md), live Drizzle schema, and targeted sections of [`.agents/schema.md`](.agents/schema.md) |
| Feature slices | Open the matching numbered `.agents/*.md` file for the slice being changed, then verify against live code |

## Known Documentation Hygiene

- Treat [`.agents/schema.md`](.agents/schema.md) as a generated reference. Read targeted table sections only.
- Treat [`.agents/status.md`](.agents/status.md) as historical transcript unless the user explicitly asks for conversation history.
- If a doc still references `.gemini/*`, resolve it to the equivalent `.agents/*` path.
