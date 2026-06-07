<!-- intent-skills:start -->

## Skill Loading

Before substantial work:

- Skill check: run `pnpm dlx @tanstack/intent@latest list`, or use skills already listed in context.
- Skill guidance: if one local skill clearly matches the task, run `pnpm dlx @tanstack/intent@latest load <package>#<skill>` and follow the returned `SKILL.md`.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->

# slopware

Codex repo instructions. Keep startup context lean: read [`map.md`](map.md) only when codebase orientation or navigation is necessary, and load deeper docs only as needed.

## Startup

1. Read [`map.md`](map.md) only when you need fast orientation on routes, APIs, components, aliases, services, or commands.
2. Use `.agents/` as the canonical documentation source, but load only the one or two docs that match the task.
3. Never load `.agents/*` wholesale. First choose the relevant doc by task area, then verify against live code.
4. When docs and code disagree, trust live code for implementation shape and use `rg` to verify the current state.

## Stack

React 19 · TanStack Start/Router/Query · Drizzle ORM v1 · Better Auth · Tailwind v4 · Vite+ (`vp`)

## Non-Negotiable Rules

- CRITICAL: NEVER run linting (pnpm lint or local vp lint) multiple times or for intermediate small changes within a single turn. Only run linting ONCE at the very end of a milestone or prompt turn, when all edits are complete and ready for final validation.
- CRITICAL: To understand `@repo/ui` component APIs (e.g. `DataGrid`, `EntityMask`, `DocumentEditor`), ALWAYS read the auto-generated `.agents/ui-components.md` reference file instead of hunting through their massive `.tsx` implementation files. This saves context window token space and prevents API hallucinations.
- Do not run production builds unless build output or bundling is the issue.
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

- In Codex sessions, prefer the local `vp` binary from `node_modules/.bin/vp` for lint/check runs when `pnpm`/`corepack` is slow or unavailable.

## Database Access

- Local Postgres uses the `DATABASE_URL` in [`apps/web/.env`](apps/web/.env) and [`apps/web/.env.example`](apps/web/.env.example).
- Use `pnpm db:psql` for an interactive `psql` session.
- Use `pnpm db:sql -- "select id, email from \"user\" limit 5"` for one-off queries.
- Use `cat query.sql | pnpm db:sql` for longer statements.
- If `psql` is missing, install it with `sudo apt-get install postgresql-client`.

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

| Task Area                         | Read                                                                                                                                                                                                                                                   |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Fast orientation                  | [`map.md`](map.md), [`.agents/decision-index.md`](.agents/decision-index.md)                                                                                                                                                                           |
| Architecture invariants           | [`.agents/00_core_architecture.md`](.agents/00_core_architecture.md), [`.agents/01_project_foundation.md`](.agents/01_project_foundation.md), [`.agents/02_entity_introspection_and_generic_ui.md`](.agents/02_entity_introspection_and_generic_ui.md) |
| Frontend shell, shared UI, design | [`.agents/design.md`](.agents/design.md), [`.agents/designer.md`](.agents/designer.md)                                                                                                                                                                 |
| Auth, TypeScript, Workflow        | [`.agents/auth.md`](.agents/auth.md), [`.agents/typescript.md`](.agents/typescript.md), [`.agents/workflow.md`](.agents/workflow.md) (Use `@tanstack/intent` loaded skills for routing & data fetching)                                                |
| Database, migrations, tenancy     | [`.agents/postgres.md`](.agents/postgres.md), live Drizzle schema, and `.agents/schema.md` (index) or targeted tables under `.agents/schema/<table_name>.md`                                                                                           |
| Feature slices                    | Open the active `.agents/*.md` file for the slice being changed, then verify against live code.                                                                                                                                                        |

## Known Documentation Hygiene

- Treat [`.agents/schema.md`](.agents/schema.md) as a generated reference. Read targeted table sections only.
- Treat [`.agents/decision-index.md`](.agents/decision-index.md) as the current short-form decision summary.
- Treat [`.agents/archive/status.md`](.agents/archive/status.md) as historical transcript unless the user explicitly asks for conversation history.
- Treat [`.agents/archive/`](.agents/archive/) as historical-only documentation. Do not open archived docs unless you are explicitly investigating prior decisions.
- If a doc still references `.gemini/*`, resolve it to the equivalent `.agents/*` path.
