# slopware Project Instructions

This project is a TypeScript + React (TanStack Start) monorepo using pnpm and Vite+, with Drizzle ORM, shadcn/ui, and Better Auth.

## Core Mandates

- **Stack:** React 19, TanStack (Start, Router, Query, Form), Drizzle ORM v1, Better Auth.
- **Toolchain:** Use `vp` (Vite+) for dev, build, linting, and formatting.
- **UI Conventions:**
  - Prefer shared `@repo/ui` components.
  - Add primitives via `pnpm ui add <component>`.
  - Use `lucide-react` for UI icons (e.g. `import { Loader2Icon } from "lucide-react"`).
  - Use `@icons-pack/react-simple-icons` for brand icons (e.g. `SiGithub`).
- **Dependencies:** Use shared pnpm catalog versions (`pnpm-workspace.yaml`) via `catalog:`.
- **Validation:** If `pnpm lint` (`vp lint --type-aware --type-check`) passes, assume changes work. Don't build after every minor change.
- **Design System:** Use Stripe-inspired patterns from `.gemini/design.md` for all UI tasks. Prioritize data density, tabular figures, and the "Stripi" color palette for B2B interfaces.

## Workflows

### Development

- Start environment: `sudo docker compose up -d && pnpm dev`
- Database migrations: `pnpm db generate` and `pnpm db migrate`
- Auth schema: `pnpm auth:generate` if Better Auth config changes.

### Documentation & Tools

- **TanStack Docs:** Use `pnpm tanstack search-docs "<query>" --library <lib> --json`.
- **Shadcn CLI:** Use `vp run --filter=@repo/ui ui` or `pnpm ui`.
- **Better Auth CLI:** Use `vpx auth@latest secret` for secrets.

## Reference Patterns

- [TanStack Patterns](.gemini/tanstack-patterns.md): Routing, data fetching, server functions.
- [Auth Patterns](.gemini/auth.md): Route guards, middleware, session management.
- [TypeScript Conventions](.gemini/typescript.md): Type inference, casting rules.
- [Workflow Details](.gemini/workflow.md): Command references and validation approach.
- [Design Patterns](.gemini/design.md): Stripe-inspired UI system for B2B interfaces.
