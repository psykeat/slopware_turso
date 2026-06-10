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

React 19 · TanStack Start/Router/Query · Drizzle ORM v1 · Better Auth · Tailwind v4 · Vite+ (`vp`)

## Rules

- Never run linting multiple times or for intermediate small changes within a single turn. Run it once at the end of the task.
- Do not run production builds unless build output or bundling is the issue.
- No hard delete for business data. Archive with `PATCH archived true`.
- Tenant isolation is server-side only. Never trust client payloads for `tenantId`.
- All keyboard shortcuts go through `CommandProvider`. No ad hoc keydown business logic.
- Dependencies go through the catalog in `pnpm-workspace.yaml`.
- Use `lucide-react` for UI icons and `react-simple-icons` for brand icons.
- Prefer `repoui` components over local one-off components.

## Dev Commands

- Start local environment: `sudo docker compose up -d`
- Run dev: `pnpm dev`
- Validate changes: `pnpm lint`
- Generate DB types/schema: `pnpm db generate`
- Run DB migrations: `pnpm db migrate`
- Add UI components: `pnpm ui add <component>`
- Search TanStack docs: `pnpm tanstack search-docs q --library <lib> --json`
- If `pnpm` or Corepack is slow/unavailable, use the local `vp` binary from `node_modules/.bin/vp` for lint/check runs.

## Database Access

- Local Postgres uses the `DATABASE_URL` in `apps/web/.env` and `apps/web/.env.example`.
- Use `pnpm db psql` for an interactive psql session.
- Use `pnpm db sql -- <query>` for one-off queries.
- Use `cat query.sql | pnpm db sql` for longer statements.
- If `psql` is missing, install it with `sudo apt-get install postgresql-client`.

## Environment Constants

- Organization slug: `base`
- Tenant slug: `base`
- Tenant ID: `019e2889-5cd7-714b-9922-08a75fdfbaac`
- Company: `1000`
- For private local credentials, use the private project memory.

## Documentation Routing

- Use `map.md` for fast orientation only when needed.
- Use `.agents00corearchitecture.md`, `.agents01projectfoundation.md`, `.agents02entityintrospectionandgenericui.md` for architecture invariants.
- Use `.agentsdesign.md` and `.agentsdesigner.md` for frontend shell, shared UI, and design.
- Use `.agentsauth.md`, `.agentstypescript.md`, `.agentsworkflow.md` for auth, TypeScript, and workflow.
- Use `.agentspostgres.md`, live Drizzle schema, and `.agentsschema.md` / targeted table docs for database, migrations, and tenancy.
- For feature slices, open the active `.agents.md` file for the slice, then verify against live code.
- Treat `.agentsschema.md` as generated reference, `.agentsdecision-index.md` as the short-form decision summary, and `.agentsarchive*` as historical-only docs.

## Known Documentation Hygiene

- If a doc still references `.gemini`, resolve it to the equivalent `.agents` path.
- Keep docs short, specific, and task-oriented.