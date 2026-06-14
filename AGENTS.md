<!-- intent-skills:start -->

## Skill Loading

Before substantial work:

- Run `pnpm dlx @tanstack/intent@latest list` only when you need to discover a TanStack skill for a core runtime dependency used in this repo, especially `@tanstack/react-query`, `@tanstack/react-router`, `@tanstack/react-start`, `@tanstack/react-form`, `@tanstack/react-table`, `@tanstack/react-virtual`, `@tanstack/react-pacer`, `@tanstack/workflow-core`, or `@tanstack/ai`.
- If a matching local skill is already obvious from the request or context, load it directly with `pnpm dlx @tanstack/intent@latest load <package>#<skill>`; do not run `list` first.
- Skip TanStack skill discovery for unrelated changes, small edits, tooling packages like `@tanstack/devtools-*` and `@tanstack/eslint-plugin-*`, or `@tanstack/intent` itself unless the task explicitly concerns them.
- In monorepo work, do discovery once from the workspace root and prefer the most specific matching local skill; load additional skills only when the task spans multiple packages or concerns.

<!-- intent-skills:end -->

# slopware

Codex repo instructions. Keep startup context lean.

## Startup

1. Read `map.md` only when you need fast orientation on routes, APIs, components, aliases, services, or commands.
2. Use `.agents/` as the canonical documentation source, but load only the one or two docs that match the task.
3. Never load `.agents/*` wholesale. First choose the relevant doc by task area, then verify against live code.
4. When docs and code disagree, trust live code for implementation shape and use `rg` to verify the current state.

## Stack

React 19 · TanStack Start/Router/Query · Drizzle ORM · Better Auth · Tailwind v4 · Vite+ (`vp`)

## Rules

- Never run linting multiple times or for intermediate small changes within a single turn. Run it once at the end of the task, and only if actual code files (e.g. `.ts`, `.tsx`) were modified (never for markdown or documentation-only changes).
- No hard delete for business data. Archive with `PATCH archived true`.
- Tenant isolation is server-side only. Never trust client payloads for `tenantId`.
- All keyboard shortcuts go through `CommandProvider`. No ad hoc keydown business logic.

## Testing the platform (capabilities first, no bypass)

- For API/integration tests, use **only** the capability surface: `GET /api/capabilities`, `GET /api/capabilities/{key}`, `POST /api/capabilities/{key}/execute` — or in-process `executeCapability`. Quickstart, test login, client, and example: `AI_TESTING.md`.
- Never build auth bypasses, mock servers, or new routes for existing capabilities; never put `tenantId` in capability input.
- Unknown capability landscape → call discovery first. Missing capability → stop and report the gap instead of coding a substitute.


## Dev Commands

- Run dev: `npnm dev`
- Validate changes: `vp lint`
- Generate DB types/schema: `pnpm db generate`
- Run DB migrations: `pnpm db migrate`
- Add UI components: `pnpm ui add <component>`


## Database Access

- Local Postgres uses the `DATABASE_URL` in `apps/web/.env` and `apps/web/.env.example`.
- Use `pnpm db psql` for an interactive psql session.
- Use `pnpm db sql -- <query>` for one-off queries.
- Use `cat query.sql | pnpm db sql` for longer statements.

## Environment Constants

- Organization slug: `base`
- Tenant slug: `base`
- Tenant ID: `019e2889-5cd7-714b-9922-08a75fdfbaac`
- Company: `1000`
- For private local credentials, use the private project memory.

## Documentation Routing

- Use `map.md` for fast orientation only when needed.
- Use `.agents/00_core_architecture.md`, `.agents/01_project_foundation.md`, `.agents/02_entity_introspection_and_generic_ui.md` for architecture invariants.
- Use `.agents/design.md` and `.agents/designer.md` for frontend shell, shared UI, and design.
- Use `.agents/auth.md`, `.agents/typescript.md`, `.agents/workflow.md` for auth, TypeScript, and workflow.
- Use `.agents/postgres.md`, live Drizzle schema, and `.agents/schema.md` / targeted table docs for database, migrations, and tenancy.
- For feature slices, open the matching `.agents/<slice>.md` file, then verify against live code.
- Treat `.agents/schema.md` as generated reference, `.agents/decision-index.md` as the short-form decision summary, and `.agents/archive/` as historical-only docs.