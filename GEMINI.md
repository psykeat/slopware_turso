# slopware

**Read [`map.md`](map.md) first.** It has routes, APIs, components, patterns, and commands — everything needed to implement features without reading further.

## Stack

React 19 · TanStack Start/Router/Query · Drizzle ORM v1 · Better Auth · Tailwind v4 · Vite+ (vp)

## Non-Negotiable Rules

- `pnpm lint` passing = changes are correct. Don't build.
- No hard delete — PATCH `{ archived: true }` for business data.
- Tenant isolation is server-side only — never trust client payload for tenantId.
- All keyboard shortcuts go through `CommandProvider` — no ad hoc `keydown` handlers.
- Dependencies via `catalog:` in `pnpm-workspace.yaml` only.
- UI icons: `lucide-react` (UI) · `@icons-pack/react-simple-icons` (brands).
- Prefer `@repo/ui` components over local ones.

## Dev Commands

```bash
sudo docker compose up -d && pnpm dev   # start environment
pnpm lint                                # validate changes
pnpm db generate && pnpm db migrate     # schema changes
pnpm ui add <component>                  # add shadcn primitive
pnpm tanstack search-docs "<q>" --library <lib> --json
```

## Environment Constants (Base Tenant)

| Key | Value |
|---|---|
| Organization Slug | `base` |
| Tenant Slug | `base` (isBase: true) |
| Company No | `1000` |
| **Tenant ID** | **`019e2889-5cd7-714b-9922-08a75fdfbaac`** |

For other local credentials, refer to the private project memory.

## Deep Dives

| Topic | File |
|---|---|
| **Gap Analysis (DIF)** | [`.gemini/dif.md`](.gemini/dif.md) |
| Architecture invariants | [`.gemini/00_core_architecture.md`](.gemini/00_core_architecture.md) |
| TanStack patterns | [`.gemini/tanstack-patterns.md`](.gemini/tanstack-patterns.md) |
| Auth patterns | [`.gemini/auth.md`](.gemini/auth.md) |
| TypeScript conventions | [`.gemini/typescript.md`](.gemini/typescript.md) |
| Design token spec | [`.gemini/design.md`](.gemini/design.md) |
| DB schema reference | [`.gemini/schema.md`](.gemini/schema.md) |
| Postgres patterns | [`.gemini/postgres.md`](.gemini/postgres.md) |
| Redesign checklist | [`.gemini/04_redesign.md`](.gemini/04_redesign.md) |
| Documents & Stats | [`.gemini/05_documents.md`](.gemini/05_documents.md) |
